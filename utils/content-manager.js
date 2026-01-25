const fs = require('fs');
const path = require('path');

const CONTENT_PATH = path.join(__dirname, '..', 'files', 'src', 'data');
const SUBJECT_FILE_PATTERN = /^contenuti.*\.js$/i;
const EXCLUDED_PREFIXES = ['contenuti-tutte-materie', 'quiz-', 'flashcards-', 'contenuti-COMPLETI-AMPLIATI'];

const SUBJECT_DEFINITIONS = buildSubjectDefinitions();

function loadContentFromFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    let match = fileContent.match(/export default\s*({[\s\S]*});?\s*$/);
    if (match) {
      const func = new Function('return ' + match[1]);
      return func();
    }

    match = fileContent.match(/module\.exports\s*=\s*({[\s\S]*});?\s*$/);
    if (match) {
      const func = new Function('return ' + match[1]);
      return func();
    }

    return null;
  } catch (error) {
    console.error('❌ Errore lettura file:', error);
    return null;
  }
}

function buildSubjectDefinitions() {
  const files = getContentFiles();
  const subjectsMap = {};

  for (const file of files) {
    if (isExcludedFile(file)) continue;

    const subjectId = normalizeSubjectKey(file);
    if (!subjectId) continue;

    const priority = getPriorityScore(file);
    const current = subjectsMap[subjectId];

    if (!current || priority > current.priority) {
      subjectsMap[subjectId] = { file, priority };
    }
  }

  return Object.entries(subjectsMap)
    .map(([id, info]) => ({ id, file: info.file }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getContentFiles() {
  try {
    if (!fs.existsSync(CONTENT_PATH)) return [];
    return fs.readdirSync(CONTENT_PATH)
      .filter(file => SUBJECT_FILE_PATTERN.test(file));
  } catch (error) {
    console.warn('⚠️ Impossibile leggere cartella contenuti:', error.message);
    return [];
  }
}

function isExcludedFile(fileName) {
  return EXCLUDED_PREFIXES.some(prefix => fileName.toLowerCase().startsWith(prefix));
}

function normalizeSubjectKey(fileName) {
  if (!fileName) return null;
  let key = fileName.replace(/\.js$/i, '');

  key = key.replace(/^contenuti-/i, '');
  key = key.replace(/^completi-/i, '');
  key = key.replace(/^completo-/i, '');
  key = key.replace(/-completo/i, '');
  key = key.replace(/-completi/i, '');
  key = key.replace(/-completa/i, '');
  key = key.replace(/-AMPLIATO/i, '');
  key = key.replace(/-AMPLIATI/i, '');
  key = key.replace(/-AMPLIATA/i, '');
  key = key.replace(/-NEW/i, '');
  key = key.replace(/-FINALE/i, '');
  key = key.replace(/-TUTTI/i, '');
  key = key.replace(/-TUTTE/i, '');
  key = key.replace(/-p\d+$/i, '');

  key = key.trim().toLowerCase();
  if (!key || key.includes('tutte-materie')) {
    return null;
  }

  return key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getPriorityScore(fileName) {
  let score = 0;
  const lower = fileName.toLowerCase();

  if (lower.includes('completi') || lower.includes('completo')) score += 10;
  if (lower.includes('ampliato')) score += 5;
  if (lower.includes('new')) score += 3;
  if (lower.includes('finale') || lower.includes('definitivo')) score += 2;
  if (lower.includes('parte') || lower.match(/-p\d+/)) score -= 1;

  return score;
}

function formatSubjectName(subjectId) {
  return subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function loadTopicsForSubject(prisma, subjectId, argomenti) {
  for (const argomento of argomenti) {
    try {
      // Validazione: salta argomenti senza titolo
      if (!argomento.titolo || argomento.titolo.trim() === '') {
        console.warn(`⚠️ Argomento senza titolo saltato`);
        continue;
      }
      
      const topic = await prisma.topic.create({
        data: {
          title: argomento.titolo,
          description: argomento.descrizione || '',
          year: argomento.annoRiferimento || '5',
          subjectId: subjectId
        }
      });

      if (Array.isArray(argomento.sottoargomenti)) {
        for (const sottoarg of argomento.sottoargomenti) {
          // Validazione: salta sottoargomenti senza titolo
          if (!sottoarg.titolo || sottoarg.titolo.trim() === '') {
            console.warn(`⚠️ Sottoargomento senza titolo saltato`);
            continue;
          }
          
          await prisma.subtopic.create({
            data: {
              title: sottoarg.titolo,
              summary: sottoarg.riassunto ? sottoarg.riassunto.substring(0, 500) : '',
              content: sottoarg.riassunto || '',
              topicId: topic.id
            }
          });
        }
      }

      await generateQuizzesForTopic(prisma, topic.id, argomento.titolo);
    } catch (error) {
      console.error(`❌ Errore caricamento argomento ${argomento.titolo}:`, error);
    }
  }
}

async function generateQuizzesForTopic(prisma, topicId, topicTitle) {
  // Placeholder - i quiz reali vengono caricati da loadAllQuizzes in quiz-loader.js
  // Questa funzione ora non fa nulla, i quiz vengono caricati separatamente
}

async function loadSimulations(prisma) {
  // Placeholder - le simulazioni reali vengono caricate da loadAllSimulations in simulations-loader.js
}

async function loadBadges(prisma) {
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
      console.error('❌ Errore creazione badge:', error);
    }
  }
}

async function loadAllContent(prisma) {
  console.log(`📦 Materie disponibili: ${SUBJECT_DEFINITIONS.length}`);

  // 1. Carica SOLO materie e argomenti REALI con riassunti
  for (const subjectDef of SUBJECT_DEFINITIONS) {
    try {
      const filePath = path.join(CONTENT_PATH, subjectDef.file);
      const contentData = loadContentFromFile(filePath);

      if (!contentData || !Array.isArray(contentData.argomenti)) {
        console.warn(`⚠️ File ${subjectDef.file} non contiene argomenti validi`);
        continue;
      }

      const metadata = buildSubjectMetadata(subjectDef.id, contentData);

      const subject = await prisma.subject.create({
        data: {
          name: metadata.name,
          icon: metadata.icon,
          color: metadata.color,
          description: metadata.description
        }
      });

      console.log(`📖 Caricando contenuti per: ${metadata.name} (${subjectDef.file})`);
      await loadTopicsForSubject(prisma, subject.id, contentData.argomenti);
    } catch (error) {
      console.error(`❌ Errore caricamento ${subjectDef.file}:`, error);
    }
  }

  // 2. Carica badge
  await loadBadges(prisma);
  
  // 3. Carica simulazioni (non sovrascrive topic)
  const { loadAllSimulations } = require('./simulations-loader');
  await loadAllSimulations(prisma);
  
  console.log('✅ Contenuti REALI caricati (materie, argomenti, sottoargomenti, simulazioni)');
  console.log('⚠️ Quiz e flashcards NON caricati - usare endpoint separati');
}

function buildSubjectMetadata(subjectId, contentData) {
  const materia = contentData?.materia || {};
  const defaultName = formatSubjectName(subjectId);

  return {
    name: materia.nome || defaultName,
    icon: materia.icona || materia.icon || '📘',
    color: materia.colore || materia.coloreHex || '#4A148C',
    description: materia.descrizione || materia.description || `Percorso completo ${defaultName}`
  };
}

async function clearContentTables(prisma) {
  console.log('🧹 Pulizia tabelle contenuti...');
  await prisma.progress.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.subtopic.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.badge.deleteMany();
}

module.exports = {
  CONTENT_PATH,
  loadAllContent,
  clearContentTables
};
