/**
 * CARICAMENTO QUIZ VIA SQL DIRETTO - BYPASS COMPLETO DEL MATCHING
 * Usa INSERT SQL raw per bypassare tutti i problemi di matching
 */

const fs = require('fs');
const path = require('path');

// Mappa materie -> topic IDs (dalle materie create con SQL)
const MATERIA_TO_TOPIC = {
  'italiano': 'topic_italiano_gen',
  'storia': 'topic_storia_gen',
  'filosofia': 'topic_filosofia_gen',
  'matematica': 'topic_matematica_gen',
  'fisica': 'topic_fisica_gen',
  'scienze': 'topic_scienze_gen',
  'latino': 'topic_latino_gen',
  'greco': 'topic_greco_gen',
  'inglese': 'topic_inglese_gen',
  'arte': 'topic_arte_gen',
  'francese': 'topic_francese_gen',
  'spagnolo': 'topic_spagnolo_gen',
  'tedesco': 'topic_tedesco_gen',
  'religione': 'topic_religione_gen',
  'pedagogia': 'topic_pedagogia_gen',
  'psicologia': 'topic_psicologia_gen',
  // Alias comuni
  'storiadellarte': 'topic_arte_gen',
  'storiaarte': 'topic_arte_gen',
  'artistica': 'topic_arte_gen'
};

function normalizeMateria(materia) {
  if (!materia || typeof materia !== 'string') return '';
  return materia
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Rimuovi accenti
    .replace(/[^a-z]/g, '');
}

function mapDifficulty(diff) {
  const d = (diff || '').toLowerCase();
  if (d.includes('facil') || d === 'easy') return 'EASY';
  if (d.includes('medi') || d === 'medium') return 'MEDIUM';
  if (d.includes('difficil') || d === 'hard') return 'HARD';
  return 'MEDIUM';
}

async function caricaQuizDiretto(prisma) {
  console.log('\n🔥 === CARICAMENTO QUIZ SQL DIRETTO ===\n');
  
  const QUIZ_FILE = path.join(__dirname, '..', 'files', 'src', 'data', 'quiz-generati', 'tutti-quiz.json');
  
  if (!fs.existsSync(QUIZ_FILE)) {
    throw new Error(`File quiz non trovato: ${QUIZ_FILE}`);
  }
  
  console.log('📂 Lettura file quiz...');
  const data = JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8'));
  const quizzes = data.quiz || [];
  console.log(`✅ ${quizzes.length} quiz trovati\n`);
  
  // Pulisci quiz esistenti
  console.log('🗑️ Pulizia quiz esistenti...');
  await prisma.$executeRaw`DELETE FROM "Quiz"`;
  console.log('✅ Quiz puliti\n');
  
  let loaded = 0;
  let skipped = 0;
  const stats = {};
  const firstSkips = [];
  
  console.log('📝 Inserimento quiz via SQL...\n');
  
  for (const quiz of quizzes) {
    try {
      const materiaKey = normalizeMateria(quiz.materia);
      const topicId = MATERIA_TO_TOPIC[materiaKey];
      
      if (!topicId) {
        if (!stats[materiaKey]) stats[materiaKey] = 0;
        stats[materiaKey]++;
        if (firstSkips.length < 20) {
          firstSkips.push({ materia: quiz.materia, normalized: materiaKey });
        }
        skipped++;
        continue;
      }
      
      const correctIndex = quiz.opzioni?.indexOf(quiz.rispostaCorretta) ?? 0;
      const difficulty = mapDifficulty(quiz.difficolta || quiz.livello);
      
      // INSERT SQL DIRETTO
      await prisma.$executeRaw`
        INSERT INTO "Quiz" (
          question, 
          options, 
          "correctAnswer", 
          explanation, 
          difficulty, 
          "topicId",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${quiz.domanda},
          ${JSON.stringify(quiz.opzioni || [])},
          ${correctIndex >= 0 ? correctIndex : 0},
          ${quiz.spiegazione || ''},
          ${difficulty}::"Difficulty",
          ${topicId},
          NOW(),
          NOW()
        )
      `;
      
      loaded++;
      
      if (loaded % 500 === 0) {
        console.log(`  ✅ ${loaded}/${quizzes.length} (${skipped} skipped)`);
      }
      
    } catch (err) {
      skipped++;
      if (skipped < 5) {
        console.error(`  ⚠️ Skip: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✅ COMPLETATO: ${loaded}/${quizzes.length} quiz caricati`);
  console.log(`   Skipped: ${skipped}\n`);
  
  if (skipped > 0) {
    console.log('⚠️ PRIMI 20 SKIP (per debug):');
    firstSkips.forEach(s => console.log(`  "${s.materia}" -> "${s.normalized}"`));
    console.log('');
    
    console.log('📊 TOP 10 materie skippate:');
    Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([mat, cnt]) => console.log(`  ${mat}: ${cnt}`));
    console.log('');
  }
  
  return { loaded, skipped, total: quizzes.length };
}

module.exports = { caricaQuizDiretto };
