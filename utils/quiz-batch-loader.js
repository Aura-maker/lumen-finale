/**
 * CARICAMENTO QUIZ A BATCH - Evita timeout
 */
const fs = require('fs');
const path = require('path');

// Mappa COMPLETE per TUTTE le 25 materie nel JSON
const MATERIA_TO_TOPIC = {
  'italiano': 'topic_italiano_gen',
  'storia': 'topic_storia_gen',
  'filosofia': 'topic_filosofia_gen',
  'arte': 'topic_arte_gen',
  'storiadellarte': 'topic_arte_gen',
  'scienze': 'topic_scienze_gen',
  'latino': 'topic_latino_gen',
  'inglese': 'topic_inglese_gen',
  'psicologia': 'topic_psicologia_gen',
  'sociologia': 'topic_sociologia_gen',
  'religione': 'topic_religione_gen',
  'pedagogia': 'topic_pedagogia_gen',
  'informatica': 'topic_informatica_gen',
  'matematica': 'topic_matematica_gen',
  'fisica': 'topic_fisica_gen',
  'tedesco': 'topic_tedesco_gen',
  'spagnolo': 'topic_spagnolo_gen',
  'francese': 'topic_francese_gen',
  'sistemi': 'topic_sistemi_gen',
  'antropologia': 'topic_antropologia_gen',
  'chimica': 'topic_chimica_gen',
  'greco': 'topic_greco_gen',
  'diritto': 'topic_diritto_gen',
  'economia': 'topic_economia_gen',
  'elettronica': 'topic_elettronica_gen',
  'meccanica': 'topic_meccanica_gen'
};

function normalizeMateria(materia) {
  if (!materia || typeof materia !== 'string') return '';
  return materia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

function mapDifficulty(diff) {
  const d = (diff || '').toLowerCase();
  if (d.includes('facil') || d === 'easy') return 'EASY';
  if (d.includes('difficil') || d === 'hard') return 'HARD';
  return 'MEDIUM';
}

let cachedQuizzes = null;

// Cache topics per evitare query ripetute
const topicCache = new Map();

async function getOrCreateTopic(prisma, materiaKey, argomento) {
  const cacheKey = `${materiaKey}_${argomento}`;
  if (topicCache.has(cacheKey)) return topicCache.get(cacheKey);
  
  const subjectId = MATERIA_TO_TOPIC[materiaKey]?.replace('topic_', 'subj_').replace('_gen', '');
  if (!subjectId) return null;
  
  // 1. Cerca topic per argomento specifico
  let topic = await prisma.topic.findFirst({
    where: {
      subjectId,
      title: argomento
    }
  });
  
  // 2. Se non esiste, crealo
  if (!topic && argomento && argomento !== 'Generale') {
    try {
      topic = await prisma.topic.create({
        data: {
          title: argomento,
          description: `Contenuti di ${argomento}`,
          year: '5',
          subjectId
        }
      });
    } catch (err) {
      // Se fallisce creazione, usa Generale
    }
  }
  
  // 3. Fallback a topic "Generale"
  if (!topic) {
    topic = await prisma.topic.findFirst({
      where: {
        subjectId,
        title: 'Generale'
      }
    });
  }
  
  // 4. Se nemmeno Generale esiste, crealo
  if (!topic) {
    try {
      topic = await prisma.topic.create({
        data: {
          title: 'Generale',
          description: 'Contenuti generali',
          year: '5',
          subjectId
        }
      });
    } catch (err) {
      return null;
    }
  }
  
  if (topic) topicCache.set(cacheKey, topic.id);
  return topic?.id;
}

async function loadQuizBatch(prisma, offset = 0, limit = 500) {
  if (!cachedQuizzes) {
    const QUIZ_FILE = path.join(__dirname, '..', 'data', 'quiz-generati', 'tutti-quiz.json');
    const data = JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8'));
    cachedQuizzes = data.quiz || [];
  }
  
  const batch = cachedQuizzes.slice(offset, offset + limit);
  let loaded = 0;
  let skipped = 0;
  
  for (const quiz of batch) {
    try {
      const materiaKey = normalizeMateria(quiz.materia);
      const argomento = quiz.argomento || 'Generale';
      
      const topicId = await getOrCreateTopic(prisma, materiaKey, argomento);
      
      if (!topicId) {
        skipped++;
        continue;
      }
      
      const correctIndex = quiz.opzioni?.indexOf(quiz.rispostaCorretta) ?? 0;
      
      await prisma.quiz.create({
        data: {
          question: quiz.domanda,
          options: JSON.stringify(quiz.opzioni || []),
          correctAnswer: correctIndex >= 0 ? correctIndex : 0,
          explanation: quiz.spiegazione || '',
          difficulty: mapDifficulty(quiz.difficolta || quiz.livello),
          topicId
        }
      });
      
      loaded++;
    } catch (err) {
      if (skipped < 5) {
        console.error(`  ⚠️ Skip quiz: ${quiz.domanda?.substring(0, 50)}... - ${err.message}`);
      }
      skipped++;
    }
  }
  
  return {
    offset,
    limit,
    loaded,
    skipped,
    total: cachedQuizzes.length,
    hasMore: (offset + limit) < cachedQuizzes.length
  };
}

module.exports = { loadQuizBatch };
