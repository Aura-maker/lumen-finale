const fs = require('fs');
const path = require('path');

// LOADER PULITO E SEMPLICE - NESSUN CONFLITTO

const DATA_PATH = path.join(__dirname, '..', 'files', 'src', 'data');

// Carica configurazione indirizzi
const { TUTTE_LE_MATERIE } = require(path.join(DATA_PATH, 'materie-per-indirizzo.js'));

// Indirizzi liceo da supportare (TUTTI i licei)
const INDIRIZZI_LICEO = ['scientifico', 'classico', 'linguistico', 'artistico', 'scienze_umane'];

// Mappa file → ID materia per filtro (TUTTE LE 28 MATERIE)
const FILE_TO_MATERIA_ID = {
  'contenuti-completi-italiano.js': 'italiano',
  'contenuti-completi-storia.js': 'storia',
  'contenuti-completi-filosofia.js': 'filosofia',
  'contenuti-completi-latino.js': 'latino',
  'contenuti-completi-greco.js': 'greco',
  'contenuti-completi-matematica.js': 'matematica',
  'contenuti-completi-fisica.js': 'fisica',
  'contenuti-completi-scienze.js': 'scienze',
  'contenuti-completi-arte.js': 'arte',
  'contenuti-completi-inglese.js': 'inglese',
  'contenuti-completi-religione.js': 'religione',
  'contenuti-completi-informatica.js': 'informatica',
  'contenuti-completi-chimica.js': 'chimica',
  'contenuti-completi-diritto.js': 'diritto',
  'contenuti-completi-economia.js': 'economia',
  'contenuti-completi-elettronica.js': 'elettronica',
  'contenuti-completi-meccanica.js': 'meccanica',
  'contenuti-completi-sistemi.js': 'sistemi',
  'contenuti-completi-antropologia.js': 'antropologia',
  'contenuti-completi-psicologia.js': 'psicologia',
  'contenuti-completi-pedagogia.js': 'pedagogia',
  'contenuti-completi-sociologia.js': 'sociologia',
  // Varianti file (stesso ID)
  'contenuti-completi-inglese-ENGLISH.js': 'inglese',
  'contenuti-completi-inglese-FIXED.js': 'inglese',
  'contenuti-completi-italiano-AMPLIATO.js': 'italiano',
  'contenuti-completi-italiano-NEW.js': 'italiano',
  'contenuti-completi-storia-AMPLIATO.js': 'storia'
};

/**
 * Verifica se una materia è disponibile per almeno un liceo
 */
function isMateriaPerLiceo(materiaId) {
  const materia = TUTTE_LE_MATERIE[materiaId];
  if (!materia || !materia.indirizzi) return false;
  
  // Verifica se la materia è disponibile in almeno uno dei licei
  return materia.indirizzi.some(ind => INDIRIZZI_LICEO.includes(ind));
}

/**
 * Ottiene lista file da caricare (SOLO materie per licei)
 */
function getFilesForLiceo() {
  const files = [];
  
  console.log('\n🔍 === FILTRO MATERIE LICEI ===');
  console.log('Indirizzi liceo:', INDIRIZZI_LICEO);
  console.log('\nTOTALE FILE IN FILE_TO_MATERIA_ID:', Object.keys(FILE_TO_MATERIA_ID).length);
  console.log('GRECO in FILE_TO_MATERIA_ID?', Object.keys(FILE_TO_MATERIA_ID).includes('contenuti-completi-greco.js'));
  console.log('\nProcessing files:');
  
  for (const [fileName, materiaId] of Object.entries(FILE_TO_MATERIA_ID)) {
    const materia = TUTTE_LE_MATERIE[materiaId];
    
    if (!materia) {
      console.log(`❌ ${materiaId}: NON in TUTTE_LE_MATERIE`);
      continue;
    }
    
    // Check se materia è per licei
    const isLiceo = materia.indirizzi && materia.indirizzi.some(ind => INDIRIZZI_LICEO.includes(ind));
    
    if (isLiceo) {
      console.log(`✅ ${materiaId.padEnd(15)} → INCLUSA (${materia.indirizzi.join(', ')})`);
      files.push(fileName);
    } else {
      console.log(`❌ ${materiaId.padEnd(15)} → ESCLUSA (${materia.indirizzi.join(', ')})`);
    }
  }
  
  console.log(`\n📚 Risultato: ${files.length} materie per licei\n`);
  return files;
}

// Alias per backward compatibility
function getFilesForLiceo_DEPRECATED() {
  return getFilesForLiceo();
}

/**
 * Carica un singolo file contenuti
 */
function loadFile(fileName) {
  try {
    const filePath = path.join(DATA_PATH, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${fileName}: file non trovato`);
      return null;
    }

    // Usa require() direttamente
    delete require.cache[require.resolve(filePath)];
    const contentData = require(filePath);
    
    // Valida struttura
    if (!contentData || !contentData.materia || !Array.isArray(contentData.argomenti)) {
      console.log(`❌ ${fileName}: struttura non valida`);
      return null;
    }

    console.log(`✅ ${fileName.padEnd(35)} → ${contentData.materia.nome} (${contentData.argomenti.length} arg)`);
    return contentData;
  } catch (error) {
    console.error(`❌ ${fileName}: ERRORE - ${error.message}`);
    return null;
  }
}

/**
 * Carica SOLO materie per LICEI
 */
async function caricaMaterie(prisma) {
  console.log('\n📚 === CARICAMENTO MATERIE PER LICEI ===\n');
  console.log(`🎯 Indirizzi supportati: ${INDIRIZZI_LICEO.join(', ')}\n`);
  
  const MATERIE_FILES = getFilesForLiceo();
  let totMaterie = 0;
  let totArgomenti = 0;
  let totSottoargomenti = 0;

  console.log(`\n🔄 Elaborazione ${MATERIE_FILES.length} file...\n`);
  
  for (const fileName of MATERIE_FILES) {
    console.log(`\n━━━ ${fileName} ━━━`);
    const contentData = loadFile(fileName);
    if (!contentData) {
      console.log(`⚠️ SKIP: contentData null per ${fileName}`);
      continue;
    }

    try {
      // Crea materia
      const subject = await prisma.subject.create({
        data: {
          name: contentData.materia.nome,
          icon: contentData.materia.icona || '📘',
          color: contentData.materia.colore || '#4A148C',
          description: contentData.materia.descrizione || ''
        }
      });

      totMaterie++;
      console.log(`✅ MATERIA CREATA: ${subject.name} (ID: ${subject.id})`);

      // Carica argomenti
      console.log(`  📚 Caricamento ${contentData.argomenti.length} argomenti...`);
      for (const argomento of contentData.argomenti) {
        if (!argomento.titolo) continue;

        const topic = await prisma.topic.create({
          data: {
            title: argomento.titolo,
            description: argomento.descrizione || '',
            year: argomento.annoRiferimento || '5',
            subjectId: subject.id
          }
        });

        totArgomenti++;
        console.log(`  • Argomento: ${topic.title}`);

        // Carica sottoargomenti
        if (Array.isArray(argomento.sottoargomenti)) {
          for (const sottoarg of argomento.sottoargomenti) {
            if (!sottoarg.titolo) continue;

            await prisma.subtopic.create({
              data: {
                title: sottoarg.titolo,
                summary: sottoarg.riassunto ? sottoarg.riassunto.substring(0, 500) : '',
                content: sottoarg.riassunto || '',
                topicId: topic.id
              }
            });

            totSottoargomenti++;
            console.log(`    - ${sottoarg.titolo} (${sottoarg.riassunto ? sottoarg.riassunto.length : 0} char)`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ ERRORE CRITICO ${fileName}:`, error.message);
      console.error(`   Stack:`, error.stack);
      // NON INTERROMPERE - continua con i prossimi file
    }
    
    console.log(`✅ Completato ${fileName}\n`);
  }

  const finalCounts = {
    subjects: await prisma.subject.count(),
    topics: await prisma.topic.count(),
    subtopics: await prisma.subtopic.count()
  };

  console.log(`\n✅ === CARICAMENTO COMPLETATO ===`);
  console.log(`📊 Caricate ${totMaterie} materie, ${totArgomenti} argomenti, ${totSottoargomenti} sottoargomenti`);
  console.log(`🔍 VERIFICA DB: ${finalCounts.subjects} subjects, ${finalCounts.topics} topics, ${finalCounts.subtopics} subtopics\n`);

  return { materie: totMaterie, argomenti: totArgomenti, sottoargomenti: totSottoargomenti, finalCounts };
}

/**
 * Carica simulazioni
 */
async function caricaSimulazioni(prisma) {
  console.log('\n🎯 === CARICAMENTO SIMULAZIONI ===\n');
  
  const { loadAllSimulations } = require('./simulations-loader');
  await loadAllSimulations(prisma);
}

/**
 * Carica quiz (NON crea topic, usa solo esistenti)
 */
async function caricaQuiz(prisma) {
  console.log('\n⚠️ caricaQuiz DISABILITATO - USA simple-loader.js invece\n');
  console.log('Chiama /api/_debug/load-tutto-new per usare il nuovo loader\n');
  // NON usare quiz-loader vecchio
}

/**
 * Carica flashcards (NON crea subtopic, usa solo esistenti)
 */
async function caricaFlashcards(prisma) {
  console.log('\n⚠️ caricaFlashcards DISABILITATO - USA simple-loader.js invece\n');
  console.log('Chiama /api/_debug/load-tutto-new per usare il nuovo loader\n');
  // NON usare flashcards-loader vecchio
}

/**
 * Carica badge
 */
async function caricaBadges(prisma) {
  const badges = [
    { name: 'Primo Quiz', description: 'Completa il tuo primo quiz', icon: '🏆' },
    { name: 'Studioso', description: 'Completa 10 quiz', icon: '📚' },
    { name: 'Esperto', description: 'Completa 50 quiz', icon: '🎓' },
    { name: 'Maestro', description: 'Completa 100 quiz', icon: '👨‍🏫' },
    { name: 'Streak 7', description: 'Studia per 7 giorni consecutivi', icon: '🔥' },
    { name: 'Perfezionista', description: 'Ottieni 100% in 5 quiz', icon: '⭐' }
  ];

  for (const badge of badges) {
    try {
      await prisma.badge.create({ data: badge });
    } catch (error) {
      // Ignora duplicati
    }
  }
}

/**
 * Pulisce tutto il database
 */
async function pulisciDatabase(prisma) {
  console.log('\n🧹 === PULIZIA DATABASE ===\n');
  
  await prisma.progress.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.subtopic.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.badge.deleteMany();
  
  console.log('✅ Database pulito\n');
}

/**
 * CARICAMENTO COMPLETO IN SEQUENZA
 */
async function caricaTutto(prisma) {
  console.log('\n🚀 === CARICAMENTO COMPLETO INIZIATO ===\n');
  
  const start = Date.now();
  
  // 1. Pulisci
  await pulisciDatabase(prisma);
  
  // 2. Carica materie e contenuti REALI
  const stats = await caricaMaterie(prisma);
  
  // 3. Carica badge
  await caricaBadges(prisma);
  
  // 4. Carica simulazioni
  await caricaSimulazioni(prisma);
  
  // 5. Carica quiz (senza creare topic)
  await caricaQuiz(prisma);
  
  // 6. Carica flashcards (senza creare subtopic)
  await caricaFlashcards(prisma);
  
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✅ === COMPLETATO IN ${duration}s ===\n`);
  
  return stats;
}

module.exports = {
  caricaTutto,
  caricaMaterie,
  caricaQuiz,
  caricaFlashcards,
  caricaSimulazioni,
  pulisciDatabase
};
