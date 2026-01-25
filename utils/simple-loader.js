/**
 * LOADER SEMPLICE E DEFINITIVO
 * Carica SOLO da file JSON esistenti su Render
 * Materie hardcoded per licei
 */

const fs = require('fs');
const path = require('path');

// File JSON - percorsi REALI su Render
const QUIZ_FILE = path.join(__dirname, '..', 'files', 'src', 'data', 'quiz-generati', 'tutti-quiz.json');
const FLASHCARDS_FILE = path.join(__dirname, '..', 'files', 'src', 'data', 'flashcards', 'tutte-flashcards.json');

// Materie presenti nel JSON quiz (tutte)
const MATERIE_LICEI = [
  { name: 'Italiano', icon: '📚', color: '#E74C3C', description: 'Letteratura italiana' },
  { name: 'Storia', icon: '🏛️', color: '#4A148C', description: 'Storia antica e moderna' },
  { name: 'Filosofia', icon: '💭', color: '#1A237E', description: 'Filosofia occidentale' },
  { name: 'Arte', icon: '🎨', color: '#E65100', description: 'Storia dell\'arte' },
  { name: 'Matematica', icon: '🔢', color: '#0D47A1', description: 'Matematica' },
  { name: 'Scienze', icon: '🔬', color: '#1B5E20', description: 'Biologia' },
  { name: 'Latino', icon: '📘', color: '#6A1B9A', description: 'Lingua latina' },
  { name: 'Inglese', icon: '🇬🇧', color: '#C62828', description: 'Lingua inglese' },
  { name: 'Psicologia', icon: '🧠', color: '#311B92', description: 'Psicologia' },
  { name: 'Religione', icon: '✝️', color: '#BF360C', description: 'Religione' },
  { name: 'Fisica', icon: '⚛️', color: '#01579B', description: 'Fisica' },
  { name: 'Greco', icon: '🏺', color: '#004D40', description: 'Lingua greca antica' },
  { name: 'Pedagogia', icon: '👨‍🏫', color: '#6A4C93', description: 'Pedagogia' },
  { name: 'Francese', icon: '🇫🇷', color: '#0055A4', description: 'Lingua francese' },
  { name: 'Spagnolo', icon: '🇪🇸', color: '#C60B1E', description: 'Lingua spagnola' },
  { name: 'Tedesco', icon: '🇩🇪', color: '#000000', description: 'Lingua tedesca' }
];

// Indirizzi liceo
const INDIRIZZI_LICEO = ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'];

// Mappa materie agli indirizzi
const MATERIE_INDIRIZZI = {
  'italiano': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'storia': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'inglese': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'religione': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'matematica': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'fisica': ['scientifico', 'classico', 'linguistico'],
  'scienze': ['scientifico'],
  'chimica': ['artistico'],
  'filosofia': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'latino': ['scientifico', 'classico', 'linguistico', 'scienze_umane'],
  'greco': ['classico'],
  'arte': ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'],
  'psicologia': ['scienze_umane'],
  'pedagogia': ['scienze_umane'],
  'sociologia': ['scienze_umane'],
  'antropologia': ['scienze_umane']
};

function isMateriaPerLiceo(materiaId) {
  const indirizzi = MATERIE_INDIRIZZI[materiaId];
  if (!indirizzi) return false;
  return indirizzi.some(ind => INDIRIZZI_LICEO.includes(ind));
}

/**
 * Carica materie e topic di base
 */
async function loadSubjects(prisma) {
  console.log('\n📚 === CARICAMENTO MATERIE LICEI ===\n');
  
  const subjects = [];
  
  for (const materia of MATERIE_LICEI) {
    try {
      const subject = await prisma.subject.create({
        data: {
          name: materia.name,
          icon: materia.icon,
          color: materia.color,
          description: materia.description,
          topics: {
            create: {
              title: 'Generale',
              description: `Contenuti generali di ${materia.name}`,
              year: '5'
            }
          }
        },
        include: { topics: true }
      });
      
      subjects.push(subject);
      console.log(`✅ ${materia.name} (${subject.topics.length} topics)`);
    } catch (error) {
      console.error(`❌ ${materia.name}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Caricate ${subjects.length}/${MATERIE_LICEI.length} materie\n`);
  return subjects;
}

/**
 * Carica quiz da JSON
 */
async function loadQuizzes(prisma) {
  try {
    console.log('\n🎯 === CARICAMENTO QUIZ ===\n');
    
    if (!fs.existsSync(QUIZ_FILE)) {
      console.error('❌ File quiz non trovato:', QUIZ_FILE);
      return;
    }
  
  let data, quizzes;
  try {
    const fileContent = fs.readFileSync(QUIZ_FILE, 'utf8');
    data = JSON.parse(fileContent);
    quizzes = data.quiz || [];
  } catch (parseError) {
    console.error('❌ Errore parsing JSON quiz:', parseError.message);
    throw new Error(`Impossibile parsare tutti-quiz.json: ${parseError.message}`);
  }
  console.log(`📝 ${quizzes.length} quiz nel file\n`);
  
  // Cache subjects e topics
  const subjects = await prisma.subject.findMany({ include: { topics: true } });
  const subjectMap = new Map();
  const topicMap = new Map();
  
  subjects.forEach(s => {
    const key = s.name.toLowerCase().replace(/[^a-z]/g, '');
    subjectMap.set(key, s);
    s.topics.forEach(t => {
      const topicKey = t.title.toLowerCase().replace(/[^a-z]/g, '');
      topicMap.set(`${s.id}_${topicKey}`, t);
      if (topicKey === 'generale') {
        topicMap.set(`${s.id}_generale`, t);
      }
    });
  });
  
  console.log('📋 Materie mappate:');
  subjectMap.forEach((v, k) => console.log(`  ${k} -> ${v.name}`));
  
  console.log('\n📋 Topics "Generale" verificati:');
  let generaleCount = 0;
  subjects.forEach(s => {
    const generaleTopic = topicMap.get(`${s.id}_generale`);
    if (generaleTopic) {
      if (generaleCount < 10) console.log(`  ✅ ${s.name} -> topic id ${generaleTopic.id}`);
      generaleCount++;
    } else {
      console.error(`  ❌ ${s.name} -> TOPIC GENERALE MANCANTE!`);
    }
  });
  console.log(`\n✅ Cache: ${subjects.length} materie, ${generaleCount} topics Generale, ${topicMap.size} topics totali\n`);
  
  const BATCH_SIZE = 50;
  let loaded = 0;
  let skipped = 0;
  let noSubject = 0;
  let noTopic = 0;
  
  for (let i = 0; i < quizzes.length; i += BATCH_SIZE) {
    const batch = quizzes.slice(i, i + BATCH_SIZE);
    const quizData = [];
    
    for (const quiz of batch) {
      try {
        // Normalizza materia
        const materiaKey = (quiz.materia || '')
          .toLowerCase()
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[^a-z]/g, '');
        
        // Trova subject (filtro licei già applicato alle materie caricate)
        const subject = subjectMap.get(materiaKey) || 
                       Array.from(subjectMap.values()).find(s => 
                         s.name.toLowerCase().replace(/[^a-z]/g, '') === materiaKey
                       );
        
        if (!subject) {
          if (noSubject < 20) console.log(`  ⚠️ NO subject: '${quiz.materia}' -> '${materiaKey}'`);
          noSubject++;
          skipped++;
          continue;
        }
        
        // Usa topic "Generale"
        const topic = topicMap.get(`${subject.id}_generale`);
        if (!topic) {
          if (noTopic < 20) console.log(`  ⚠️ NO topic generale per: ${subject.name} (id=${subject.id})`);
          noTopic++;
          skipped++;
          continue;
        }
        
        const correctIndex = quiz.opzioni?.indexOf(quiz.rispostaCorretta) ?? 0;
        
        quizData.push({
          question: quiz.domanda,
          options: JSON.stringify(quiz.opzioni || []),
          correctAnswer: correctIndex >= 0 ? correctIndex : 0,
          explanation: quiz.spiegazione || '',
          difficulty: mapDifficulty(quiz.difficolta || quiz.livello),
          topicId: topic.id
        });
      } catch (err) {
        skipped++;
      }
    }
    
    if (quizData.length > 0) {
      try {
        const result = await prisma.quiz.createMany({ data: quizData });
        loaded += result.count;
        
        // VERIFICA che i quiz siano REALMENTE nel DB
        const actualCount = await prisma.quiz.count();
        
        console.log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${result.count} inseriti, DB totale: ${actualCount} (skipped: ${skipped})`);
        
        // Se discrepanza, log warning
        if (actualCount < loaded) {
          console.warn(`  ⚠️ DISCREPANZA: loaded=${loaded} ma DB ha solo ${actualCount} quiz!`);
        }
      } catch (err) {
        console.error(`  ❌ Errore batch ${Math.floor(i/BATCH_SIZE) + 1}:`, err.message);
        console.error(`     Stack:`, err.stack);
      }
    }
  }
  
  console.log(`\n📊 REPORT CARICAMENTO:`);
  console.log(`   Elaborati: ${loaded} quiz`);
  console.log(`   Skipped: ${skipped} (${noSubject} no subject, ${noTopic} no topic)`);
  
  // VERIFICA FINALE
  const finalCount = await prisma.quiz.count();
  console.log(`   ✅ DB FINALE: ${finalCount} quiz persistiti\n`);
  
  if (finalCount < loaded * 0.9) {
    console.error(`   ❌ PROBLEMA PERSISTENZA: Caricati ${loaded} ma DB ha solo ${finalCount}!`);
  } else {
    console.log(`   ✅ Persistenza OK (${((finalCount/loaded)*100).toFixed(1)}%)\n`);
  }
  
  return finalCount;
  } catch (error) {
    console.error('❌ ERRORE CRITICO in loadQuizzes:', error.message);
    console.error('Stack:', error.stack);
    // NON blocca il caricamento delle flashcards
    return 0;
  }
}

/**
 * Carica flashcards da JSON
 */
async function loadFlashcards(prisma) {
  try {
    console.log('\n🃏 === CARICAMENTO FLASHCARDS ===\n');
    
    if (!fs.existsSync(FLASHCARDS_FILE)) {
      console.error('❌ File flashcards non trovato:', FLASHCARDS_FILE);
      return;
    }
  
  let data, flashcards;
  try {
    const fileContent = fs.readFileSync(FLASHCARDS_FILE, 'utf8');
    data = JSON.parse(fileContent);
    flashcards = data.flashcards || [];
  } catch (parseError) {
    console.error('❌ Errore parsing JSON flashcards:', parseError.message);
    throw new Error(`Impossibile parsare tutte-flashcards.json: ${parseError.message}`);
  }
  console.log(`📝 ${flashcards.length} flashcards nel file\n`);
  
  // Cache subjects, topics, subtopics
  const subjects = await prisma.subject.findMany({ 
    include: { 
      topics: { 
        include: { subtopics: true } 
      } 
    } 
  });
  
  const subjectMap = new Map();
  const topicMap = new Map();
  const subtopicMap = new Map();
  
  subjects.forEach(s => {
    const key = s.name.toLowerCase().replace(/[^a-z]/g, '');
    subjectMap.set(key, s);
    
    s.topics.forEach(t => {
      topicMap.set(`${s.id}_generale`, t);
      
      t.subtopics.forEach(st => {
        subtopicMap.set(`${t.id}_${st.title.toLowerCase()}`, st);
      });
    });
  });
  
  console.log(`✅ Cache: ${subjects.length} materie\n`);
  
  const BATCH_SIZE = 100;
  let loaded = 0;
  let skipped = 0;
  
  for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
    const batch = flashcards.slice(i, i + BATCH_SIZE);
    const flashcardData = [];
    
    for (const fc of batch) {
      try {
        // Normalizza materia
        const materiaKey = (fc.materia || '')
          .toLowerCase()
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[^a-z]/g, '');
        
        // Trova subject (filtro licei già applicato alle materie caricate)
        const subject = subjectMap.get(materiaKey) || 
                       Array.from(subjectMap.values()).find(s => 
                         s.name.toLowerCase().replace(/[^a-z]/g, '') === materiaKey
                       );
        
        if (!subject) {
          skipped++;
          continue;
        }
        
        // Trova topic "Generale"
        let topic = topicMap.get(`${subject.id}_generale`);
        
        if (!topic) {
          skipped++;
          continue;
        }
        
        // Trova o crea subtopic "Generale"
        let subtopic = subtopicMap.get(`${topic.id}_generale`);
        
        if (!subtopic) {
          subtopic = await prisma.subtopic.create({
            data: {
              title: 'Generale',
              summary: 'Flashcards generali',
              content: '',
              topicId: topic.id
            }
          });
          subtopicMap.set(`${topic.id}_generale`, subtopic);
        }
        
        flashcardData.push({
          front: fc.fronte,
          back: fc.retro,
          subtopicId: subtopic.id
        });
      } catch (err) {
        if (skipped < 10) console.error(`  ⚠️ Errore flashcard processing: ${err.message}`);
        skipped++;
      }
    }
    
    if (flashcardData.length > 0) {
      try {
        const result = await prisma.flashcard.createMany({ data: flashcardData });
        loaded += result.count;
        console.log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${loaded}/${flashcards.length} flashcards`);
      } catch (err) {
        console.error(`  ❌ Errore batch ${Math.floor(i/BATCH_SIZE) + 1}:`, err.message);
        // Continua comunque
      }
    }
  }
  
  console.log(`\n✅ Caricate ${loaded}/${flashcards.length} flashcards\n`);
  } catch (error) {
    console.error('❌ ERRORE CRITICO in loadFlashcards:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Carica tutto
 */
async function loadAll(prisma) {
  console.log('\n🚀 === CARICAMENTO COMPLETO ===\n');
  
  // Pulisci DB
  console.log('🗑️ Pulizia database...');
  await prisma.progress.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.flashcard.deleteMany({});
  await prisma.subtopic.deleteMany({});
  await prisma.topic.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.simulation.deleteMany({});
  console.log('✅ DB pulito\n');
  
  // Carica in sequenza
  await loadSubjects(prisma);
  await loadQuizzes(prisma);
  await loadFlashcards(prisma);
  
  // Verifica finale
  const counts = {
    subjects: await prisma.subject.count(),
    topics: await prisma.topic.count(),
    quiz: await prisma.quiz.count(),
    flashcards: await prisma.flashcard.count()
  };
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RISULTATO FINALE:');
  console.log(`  Materie: ${counts.subjects}`);
  console.log(`  Topics: ${counts.topics}`);
  console.log(`  Quiz: ${counts.quiz}`);
  console.log(`  Flashcards: ${counts.flashcards}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return counts;
}

function mapDifficulty(level) {
  const map = {
    'base': 'easy',
    'facile': 'easy',
    'intermedio': 'medium',
    'medio': 'medium',
    'avanzato': 'hard',
    'difficile': 'hard'
  };
  return map[level?.toLowerCase()] || 'medium';
}

module.exports = { loadAll, loadSubjects, loadQuizzes, loadFlashcards };
