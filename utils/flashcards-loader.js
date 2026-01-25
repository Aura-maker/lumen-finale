const fs = require('fs');
const path = require('path');

const FLASHCARDS_FILE = path.join(__dirname, '..', 'files', 'tutte-flashcards.json');
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

async function loadAllFlashcards(prisma) {
  try {
    if (!fs.existsSync(FLASHCARDS_FILE)) {
      console.warn('⚠️ File flashcards non trovato:', FLASHCARDS_FILE);
      return;
    }

    const data = JSON.parse(fs.readFileSync(FLASHCARDS_FILE, 'utf8'));
    const flashcards = data.flashcards || [];
    
    console.log(`🃏 Caricamento ${flashcards.length} flashcards...`);
    
    // Cache subjects e topics
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
      const key = s.name.toLowerCase().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[^\w]/g, '').trim();
      subjectMap.set(key, s);
      
      s.topics.forEach(t => {
        const tKey = `${s.id}_${t.title.toLowerCase().replace(/[^\w]/g, '')}`;
        topicMap.set(tKey, t);
        
        if (t.subtopics) {
          t.subtopics.forEach(st => {
            const stKey = `${t.id}_${st.title.toLowerCase().replace(/[^\w]/g, '')}`;
            subtopicMap.set(stKey, st);
          });
        }
      });
    });
    
    console.log(`✅ Cache: ${subjects.length} materie`);
    
    // Batch insert - RIDOTTO per persistenza
    const BATCH_SIZE = 100;
    let loaded = 0;
    let skipped = 0;
    
    for (let i = 0; i < flashcards.length; i += BATCH_SIZE) {
      const batch = flashcards.slice(i, i + BATCH_SIZE);
      const flashcardData = [];
      
      for (const fc of batch) {
        try {
          // NORMALIZZA nome materia (rimuovi emoji, spazi, caratteri speciali)
          const materiaId = (fc.materia || '')
            .toLowerCase()
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // rimuove emoji
            .replace(/[^a-z]/g, '') // rimuove TUTTO tranne lettere
            .trim();

          // FILTRO LICEO: Verifica se materia è per licei
          if (!isMateriaPerLiceo(materiaId)) {
            skipped++;
            continue;
          }
          
          const matKey = materiaId;
          const subject = subjectMap.get(matKey);
          
          if (!subject) {
            skipped++;
            continue;
          }

          const argKey = `${subject.id}_${(fc.argomento || '').toLowerCase().replace(/[^\w]/g, '')}`;
          let topic = topicMap.get(argKey);
          
          // Se topic non esiste, usa "Flashcards Generale"
          if (!topic) {
            const generalKey = `${subject.id}_flashcardsgen erale`;
            topic = topicMap.get(generalKey);
            
            if (!topic) {
              topic = await prisma.topic.create({
                data: {
                  title: 'Flashcards Generale',
                  description: `Flashcards per ${subject.name}`,
                  year: '5',
                  subjectId: subject.id
                }
              });
              topicMap.set(generalKey, topic);
            }
          }

          const stKey = `${topic.id}_generale`;
          let subtopic = subtopicMap.get(stKey);
          
          if (!subtopic) {
            subtopic = await prisma.subtopic.create({
              data: {
                title: 'Generale',
                summary: 'Flashcards generali',
                content: '',
                topicId: topic.id
              }
            });
            subtopicMap.set(stKey, subtopic);
          }

          flashcardData.push({
            front: fc.fronte,
            back: fc.retro,
            subtopicId: subtopic.id
          });
        } catch (err) {
          skipped++;
        }
      }
      
      if (flashcardData.length > 0) {
        try {
          await prisma.flashcard.createMany({ data: flashcardData, skipDuplicates: true });
          loaded += flashcardData.length;
          console.log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${loaded} flashcards`);
          
          // DELAY per garantire persistenza DB
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`  ❌ Errore batch:`, err.message);
        }
      }
    }

    console.log(`✅ Caricate ${loaded} flashcards (skipped: ${skipped})`);
  } catch (error) {
    console.error('❌ Errore caricamento flashcards:', error);
  }
}

module.exports = { loadAllFlashcards };
