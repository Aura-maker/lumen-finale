/**
 * LOADER QUIZ SICURO - Insert 1 alla volta per debug
 */
const fs = require('fs');
const path = require('path');

async function loadQuizzesSafe(prisma) {
  console.log('\n🔥 === CARICAMENTO QUIZ SICURO (1 alla volta) ===\n');
  
  const QUIZ_FILE = path.join(__dirname, '..', 'files', 'src', 'data', 'quiz-generati', 'tutti-quiz.json');
  
  if (!fs.existsSync(QUIZ_FILE)) {
    console.error('❌ File non trovato:', QUIZ_FILE);
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8'));
  const quizzes = data.quiz || [];
  console.log(`📚 ${quizzes.length} quiz nel file\n`);
  
  // Cache subjects e topics
  const subjects = await prisma.subject.findMany({ include: { topics: true } });
  console.log(`📋 ${subjects.length} materie nel DB\n`);
  
  const subjectMap = new Map();
  const topicMap = new Map();
  
  subjects.forEach(s => {
    const key = s.name.toLowerCase().replace(/[^a-z]/g, '');
    subjectMap.set(key, s);
    s.topics.forEach(t => {
      topicMap.set(`${s.id}_generale`, t);
    });
  });
  
  let loaded = 0;
  let skipped = 0;
  const errors = {};
  
  // Prova solo i primi 100 per test
  const testQuizzes = quizzes.slice(0, 100);
  
  for (let i = 0; i < testQuizzes.length; i++) {
    const quiz = testQuizzes[i];
    
    try {
      const materiaKey = (quiz.materia || '').toLowerCase().replace(/[^a-z]/g, '');
      const subject = subjectMap.get(materiaKey);
      
      if (!subject) {
        errors[`no_subject_${materiaKey}`] = (errors[`no_subject_${materiaKey}`] || 0) + 1;
        skipped++;
        continue;
      }
      
      const topic = topicMap.get(`${subject.id}_generale`);
      
      if (!topic) {
        errors[`no_topic_${subject.name}`] = (errors[`no_topic_${subject.name}`] || 0) + 1;
        skipped++;
        if (skipped < 5) {
          console.log(`⚠️ ${subject.name} non ha topic "Generale"!`);
        }
        continue;
      }
      
      const correctIndex = quiz.opzioni?.indexOf(quiz.rispostaCorretta) ?? 0;
      
      // INSERT 1 alla volta
      await prisma.quiz.create({
        data: {
          question: quiz.domanda,
          options: JSON.stringify(quiz.opzioni || []),
          correctAnswer: correctIndex,
          explanation: quiz.spiegazione || '',
          difficulty: mapDifficulty(quiz.difficolta || quiz.livello),
          topicId: topic.id
        }
      });
      
      loaded++;
      
      if (loaded % 10 === 0) {
        console.log(`  ✅ ${loaded}/${testQuizzes.length}`);
      }
      
    } catch (err) {
      errors[err.message] = (errors[err.message] || 0) + 1;
      skipped++;
      if (skipped < 5) {
        console.error(`  ❌ ${quiz.domanda.substring(0, 50)}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n📊 RISULTATO:`);
  console.log(`   Caricati: ${loaded}/${testQuizzes.length}`);
  console.log(`   Skipped: ${skipped}\n`);
  
  if (Object.keys(errors).length > 0) {
    console.log('❌ ERRORI:');
    Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([err, cnt]) => console.log(`   ${err}: ${cnt}`));
    console.log('');
  }
  
  const finalCount = await prisma.quiz.count();
  console.log(`✅ DB FINALE: ${finalCount} quiz\n`);
  
  return finalCount;
}

function mapDifficulty(level) {
  const map = {
    'base': 'EASY',
    'facile': 'EASY',
    'intermedio': 'MEDIUM',
    'medio': 'MEDIUM',
    'avanzato': 'HARD',
    'difficile': 'HARD'
  };
  const mapped = map[level?.toLowerCase()];
  return mapped || 'MEDIUM';
}

module.exports = { loadQuizzesSafe };
