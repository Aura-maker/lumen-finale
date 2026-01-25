const fs = require('fs');
const path = require('path');

const QUIZ_FILE = path.join(__dirname, '..', 'files', 'tutti-quiz.json');
const DATA_PATH = path.join(__dirname, '..', 'files', 'src', 'data');

// Carica configurazione indirizzi per filtro
const { TUTTE_LE_MATERIE } = require(path.join(DATA_PATH, 'materie-per-indirizzo.js'));
const INDIRIZZI_LICEO = ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'];

/**
 * Verifica se una materia è disponibile per almeno un liceo
 */
function isMateriaPerLiceo(materiaId) {
  const materia = TUTTE_LE_MATERIE[materiaId];
  if (!materia || !materia.indirizzi) return false;
  return materia.indirizzi.some(ind => INDIRIZZI_LICEO.includes(ind));
}

async function loadAllQuizzes(prisma) {
  try {
    console.log('🔍 Quiz loader avviato...');
    console.log('📂 Path quiz file:', QUIZ_FILE);
    
    if (!fs.existsSync(QUIZ_FILE)) {
      console.error('❌ File quiz NON TROVATO:', QUIZ_FILE);
      return;
    }

    console.log('✅ File quiz trovato, lettura in corso...');
    const data = JSON.parse(fs.readFileSync(QUIZ_FILE, 'utf8'));
    const quizzes = data.quiz || [];
    
    console.log(`📝 Caricamento ${quizzes.length} quiz da tutti-quiz.json...`);
    
    // OTTIMIZZAZIONE: Cache subjects e topics in memoria
    console.log('📦 Caricamento subjects e topics in cache...');
    const subjects = await prisma.subject.findMany({
      include: { topics: true }
    });
    
    const subjectMap = new Map();
    const topicMap = new Map();
    
    subjects.forEach(s => {
      // Normalizza rimuovendo emoji, spazi, caratteri speciali
      const key = s.name.toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // rimuove emoji
        .replace(/[^\w]/g, '') // rimuove tutto tranne lettere/numeri
        .trim();
      subjectMap.set(key, s);
      
      s.topics.forEach(t => {
        const tKey = `${s.id}_${t.title.toLowerCase().replace(/[^\w]/g, '')}`;
        topicMap.set(tKey, t);
      });
    });
    
    console.log(`✅ Cache pronta: ${subjects.length} materie, ${topicMap.size} topics`);
    
    // Batch insert: BATCH RIDOTTO per garantire persistenza
    const BATCH_SIZE = 50;
    let loaded = 0;
    let skipped = 0;
    
    console.log(`🚀 Inizio caricamento ${quizzes.length} quiz in batch da ${BATCH_SIZE}...`);
    
    for (let i = 0; i < quizzes.length; i += BATCH_SIZE) {
      const batch = quizzes.slice(i, i + BATCH_SIZE);
      const quizData = [];
      
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(quizzes.length/BATCH_SIZE)}: elaborazione ${i}-${Math.min(i+BATCH_SIZE, quizzes.length)}...`);
      
      for (const quiz of batch) {
        try {
          // FILTRO LICEO: Attivo e corretto
          const materiaKey = (quiz.materia || '').toLowerCase()
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // rimuove emoji
            .replace(/[^\w]/g, '') // rimuove caratteri speciali
            .trim();
          
          if (!isMateriaPerLiceo(materiaKey)) {
            skipped++;
            continue;
          }
          
          // Trova subject da cache (cerca per nome normalizzato)
          const subject = subjectMap.get(materiaKey) || 
                         Array.from(subjectMap.values()).find(s => 
                           s.name.toLowerCase().replace(/[^a-z]/g, '') === materiaKey
                         );
          
          if (!subject) {
            skipped++;
            continue;
          }

          // Cerca topic ESISTENTE (NON crea automaticamente per non sovrascrivere contenuti reali)
          let topic = topicMap.get(`${subject.id}_${(quiz.argomento || '').toLowerCase().replace(/[^\w]/g, '')}`);
          if (!topic) {
            topic = await prisma.topic.findFirst({
              where: {
                title: quiz.argomento,
                subject: { id: subject.id }
              }
            });
            
            // Se topic non esiste, cerca topic "Generale" o salta
            if (!topic) {
              const generalKey = `${subject.id}:generale`;
              let generalTopic = topicMap.get(generalKey);
              
              if (!generalTopic) {
                generalTopic = await prisma.topic.findFirst({
                  where: {
                    title: { contains: 'Generale', mode: 'insensitive' },
                    subject: { id: subject.id }
                  }
                });
                
                // Crea topic "Quiz Generale" solo se non esiste
                if (!generalTopic) {
                  generalTopic = await prisma.topic.create({
                    data: {
                      title: 'Quiz Generale',
                      description: `Quiz generali per ${subject.name}`,
                      year: '5',
                      subjectId: subject.id
                    }
                  });
                }
                topicMap.set(generalKey, generalTopic);
              }
              topic = generalTopic;
              console.log(`⚠️ Quiz "${quiz.argomento}" → topic "Quiz Generale"`);
            }
            
            topicMap.set(`${subject.id}_${(quiz.argomento || '').toLowerCase().replace(/[^\w]/g, '')}`, topic);
          }

          // Prepara dati quiz
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
          console.error(`⚠️ SKIP quiz: ${quiz.domanda?.substring(0, 50)}... - Errore: ${err.message}`);
          skipped++;
        }
      }
      
      // Batch insert con gestione errori e delay per persistenza
      if (quizData.length > 0) {
        try {
          await prisma.quiz.createMany({ data: quizData, skipDuplicates: true });
          loaded += quizData.length;
          console.log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${loaded}/${quizzes.length} quiz caricati (${skipped} skipped)`);
          
          // DELAY per garantire persistenza DB
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`  ❌ Errore batch ${Math.floor(i/BATCH_SIZE) + 1}:`, err.message);
        }
      }
    }

    console.log(`✅ Caricati ${loaded} quiz reali`);
  } catch (error) {
    console.error('❌ Errore caricamento quiz:', error);
  }
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

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { loadAllQuizzes };
