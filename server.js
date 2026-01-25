// SERVER BACKEND COMPLETO CON PRISMA
// Gestisce tutti i contenuti: materie, quiz, simulazioni, gamification

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const helmet = require('helmet');
const { sanitizeMiddleware, sanitizeAIOutput, validateQuizInput, validateFlashcardInput, validateSummaryInput } = require('./middleware/sanitize.middleware');
const { register, login, getProfile } = require('./routes/auth');
const { loadAllContent, clearContentTables } = require('./utils/content-manager');
const { getMaterieIndirizzo } = require('./data/config/indirizzi-scolastici');

const app = express();
const PORT = process.env.PORT || 4000;

// Configurazione Prisma - POSTGRESQL DEFINITIVO
const prisma = new PrismaClient();

console.log('🔍 Using PostgreSQL - hardcoded in schema');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

const parseQuizOptions = (options) => {
  try {
    if (Array.isArray(options)) return options;
    return JSON.parse(options || '[]');
  } catch {
    return [];
  }
};

// Middleware di Sicurezza
// Trust proxy per Render - NECESSARIO per rate limiter
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://lumen-studio-api-2.onrender.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS non permesso'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-indirizzo']
}));

// Rate limiting (ottimizzato per studenti)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 1000, // 1000 richieste per IP (adatto per studio intensivo)
  message: { error: 'Troppe richieste, riprova tra pochi minuti' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting per health check e static files
    return req.url === '/health' || req.url.startsWith('/static/');
  }
});

// Rate limiting più stretto per API sensibili
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 tentativi login/registrazione
  message: { error: 'Troppi tentativi di autenticazione' },
});

app.use(limiter);
app.use(sanitizeMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ROUTES DI AUTENTICAZIONE
app.post('/api/auth/registrati', register);
app.post('/api/auth/login', login);
app.get('/api/auth/me', getProfile);

// TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend funzionante!', timestamp: new Date() });
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Lumen Studio Backend' });
});

// Percorso ai contenuti
const CONTENT_PATH = path.join(__dirname, 'files', 'src', 'data');

console.log(' Avviando server ImparaFacile...');
console.log(' Percorso contenuti:', CONTENT_PATH);

// INIZIALIZZAZIONE DATABASE - DISABILITATA per evitare reset
async function initializeDatabase() {
  try {
    console.log(' Verificando database...');
    console.log(' DATABASE_URL:', process.env.DATABASE_URL ? 'CONFIGURATO' : 'MANCANTE');
    console.log(' NODE_ENV:', process.env.NODE_ENV);
    
    // Verifica counts
    const subjectCount = await prisma.subject.count();
    const topicCount = await prisma.topic.count();
    const quizCount = await prisma.quiz.count();
    
    console.log(`📊 DB Status: ${subjectCount} materie, ${topicCount} topics, ${quizCount} quiz`);
    console.log('✅ Usa /api/_debug/load-tutto-new per caricare manualmente');
    
    // NON CARICARE AUTOMATICAMENTE - causa reset continui
    // await loadAllContent(prisma);
    
  } catch (error) {
    console.error('❌ Errore verifica database:', error);
  }
}

// Tutte le funzioni di caricamento contenuti sono ora in utils/content-manager.js

// ROUTES API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server ImparaFacile attivo con Prisma'
  });
});

// Debug: conteggi tabelle principali
app.get('/api/_debug/counts', async (req, res, next) => {
  try {
    const [materie, argomenti, quiz, domande, flashcards] = await Promise.all([
      prisma.subject.count(),
      prisma.topic.count(),
      prisma.subtopic.count(),
      prisma.quiz.count(),
      prisma.flashcard.count()
    ]);
    res.json({ materie, argomenti, subtopics: argomenti, quiz, flashcards });
  } catch (err) { next(err); }
});

// Debug: contenuto completo database
app.get('/api/_debug/content', async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            subtopics: true,
            quizzes: true
          }
        }
      }
    });
    res.json({ subjects, totalSubjects: subjects.length });
  } catch (err) { next(err); }
});

// Debug: verifica file contenuti esistono
app.get('/api/_debug/files', (req, res) => {
  const basePath = path.join(__dirname, 'files', 'src', 'data');
  const quizFile = path.join(basePath, 'quiz-generati', 'tutti-quiz.json');
  const flashcardsFile = path.join(basePath, 'flashcards', 'tutte-flashcards.json');
  const simulationsDir = path.join(basePath, 'simulazioni-esame');
  
  const result = {
    basePath,
    basePathExists: fs.existsSync(basePath),
    files: {
      quiz: {
        path: quizFile,
        exists: fs.existsSync(quizFile),
        size: fs.existsSync(quizFile) ? fs.statSync(quizFile).size : 0
      },
      flashcards: {
        path: flashcardsFile,
        exists: fs.existsSync(flashcardsFile),
        size: fs.existsSync(flashcardsFile) ? fs.statSync(flashcardsFile).size : 0
      },
      simulations: {
        path: simulationsDir,
        exists: fs.existsSync(simulationsDir),
        files: fs.existsSync(simulationsDir) ? fs.readdirSync(simulationsDir).length : 0
      }
    }
  };
  
  res.json(result);
});

// Debug: OBSOLETO - Usa populate-fixed-ids invece
// app.get('/api/_debug/load-tutto-new', async (req, res) => {
//   try {
//     delete require.cache[require.resolve('./utils/simple-loader')];
//     const { loadAll } = require('./utils/simple-loader');
//     const counts = await loadAll(prisma);
//     res.json({ success: true, message: 'Tutto caricato', counts });
//   } catch (error) {
//     console.error('❌ Errore:', error);
//     res.status(500).json({ success: false, error: error.message, stack: error.stack });
//   }
// });

// Debug: Caricamento SOLO materie
app.get('/api/_debug/load-step1-subjects', async (req, res) => {
  try {
    const { loadSubjects } = require('./utils/simple-loader');
    
    // Pulisci
    await prisma.progress.deleteMany({});
    await prisma.quiz.deleteMany({});
    await prisma.flashcard.deleteMany({});
    await prisma.subtopic.deleteMany({});
    await prisma.topic.deleteMany({});
    await prisma.subject.deleteMany({});
    
    await loadSubjects(prisma);
    
    const counts = {
      subjects: await prisma.subject.count(),
      topics: await prisma.topic.count(),
      subtopics: await prisma.subtopic.count(),
      quiz: await prisma.quiz.count(),
      flashcards: await prisma.flashcard.count(),
      simulations: await prisma.simulation.count()
    };
    
    res.json({ success: true, message: 'Materie caricate', counts });
  } catch (error) {
    console.error('❌ Errore:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug: Caricamento STEP 2 - Quiz
app.get('/api/_debug/load-step2-quiz', async (req, res) => {
  try {
    const { loadQuizzes } = require('./utils/simple-loader');
    await loadQuizzes(prisma);
    const count = await prisma.quiz.count();
    res.json({ success: true, message: 'Quiz caricati', quizLoaded: count });
  } catch (error) {
    console.error('❌ Errore:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Caricamento SOLO flashcards
app.get('/api/_debug/load-step3-flashcards', async (req, res) => {
  try {
    const { loadFlashcards } = require('./utils/simple-loader');
    await loadFlashcards(prisma);
    const count = await prisma.flashcard.count();
    res.json({ success: true, message: 'Flashcards caricate', flashcardsLoaded: count });
  } catch (error) {
    console.error('❌ Errore:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug: EMERGENZA - Popolamento SQL diretto
app.get('/api/_debug/sql-emergency', async (req, res) => {
  try {
    console.log('🚨 EMERGENZA: Uso SQL diretto per popolare materie');
    const { popolaConSQL } = require('./utils/sql-populator');
    const counts = await popolaConSQL(prisma);
    res.json({ 
      success: true, 
      message: 'Materie inserite via SQL diretto', 
      counts,
      next: 'Ora chiama /api/_debug/load-step2-quiz e /api/_debug/load-step3-flashcards'
    });
  } catch (error) {
    console.error('❌ Errore SQL:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug: QUIZ SQL DIRETTO - Bypass matching rotto
app.get('/api/_debug/quiz-sql-direct', async (req, res) => {
  try {
    console.log('🔥 CARICAMENTO QUIZ SQL DIRETTO - Bypass matching');
    const { caricaQuizDiretto } = require('./utils/sql-quiz-direct');
    const result = await caricaQuizDiretto(prisma);
    res.json({ 
      success: true, 
      message: `${result.loaded} quiz caricati via SQL diretto`, 
      ...result
    });
  } catch (error) {
    console.error('❌ Errore quiz SQL:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug: QUIZ BATCH - Carica 500 alla volta per evitare timeout
app.get('/api/_debug/quiz-batch', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || '0');
    const limit = parseInt(req.query.limit || '500');
    
    const { loadQuizBatch } = require('./utils/quiz-batch-loader');
    const result = await loadQuizBatch(prisma, offset, limit);
    
    res.json({ 
      success: true, 
      ...result,
      nextUrl: result.hasMore ? `/api/_debug/quiz-batch?offset=${offset + limit}&limit=${limit}` : null
    });
  } catch (error) {
    console.error('❌ Errore quiz batch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: TEST SAFE - Carica 100 quiz 1 alla volta per debug
app.get('/api/_debug/quiz-safe-test', async (req, res) => {
  try {
    console.log('🔍 TEST SAFE: Carico 100 quiz 1 alla volta...');
    const { loadQuizzesSafe } = require('./utils/quiz-direct-safe');
    const count = await loadQuizzesSafe(prisma);
    res.json({ success: true, quizLoaded: count, message: 'Test completato - controlla logs' });
  } catch (error) {
    console.error('❌ Errore test safe:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: POPULATE FIXED IDS - Crea materie+topics con ID fissi per batch-loader
app.get('/api/_debug/populate-fixed-ids', async (req, res) => {
  try {
    console.log('🔥 POPOLAMENTO CON ID FISSI...');
    const { populateWithFixedIds } = require('./utils/populate-with-fixed-ids');
    const counts = await populateWithFixedIds(prisma);
    res.json({ 
      success: true, 
      message: 'DB popolato con ID fissi', 
      counts,
      next: 'Ora chiama /api/_debug/quiz-batch?offset=0&limit=500 e continua con offset crescente'
    });
  } catch (error) {
    console.error('❌ Errore populate fixed:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

// Debug: Caricamento STEP 4 - Simulazioni
app.get('/api/_debug/load-step4-simulations', async (req, res) => {
  try {
    console.log('🔄 STEP 4: Caricamento simulazioni...');
    const { loadAllSimulations } = require('./utils/simulations-loader');
    await loadAllSimulations(prisma);
    const count = await prisma.simulation.count();
    res.json({ success: true, message: 'Step 4 completato', simulationsLoaded: count });
  } catch (error) {
    console.error('❌ Errore step 4:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Carica solo materie e argomenti
async function loadSubjectsOnly(prisma) {
  const path = require('path');
  const fs = require('fs');
  const CONTENT_PATH = path.join(__dirname, 'files', 'src', 'data');
  
  const files = fs.readdirSync(CONTENT_PATH).filter(f => /^contenuti.*\.js$/i.test(f));
  console.log(`📦 Trovati ${files.length} file contenuti`);
  
  for (const file of files.slice(0, 28)) { // Prime 28 materie
    try {
      const filePath = path.join(CONTENT_PATH, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const match = fileContent.match(/export default\s*({[\s\S]*});?\s*$/);
      if (!match) continue;
      
      const contentData = new Function('return ' + match[1])();
      if (!contentData?.materia) continue;
      
      const subject = await prisma.subject.create({
        data: {
          name: contentData.materia.nome || 'Materia',
          icon: contentData.materia.icona || '📘',
          color: contentData.materia.colore || '#4A148C',
          description: contentData.materia.descrizione || ''
        }
      });
      
      console.log(`✓ ${subject.name}`);
      
      // Carica argomenti
      if (Array.isArray(contentData.argomenti)) {
        for (const arg of contentData.argomenti.slice(0, 10)) { // Max 10 argomenti per materia
          const topic = await prisma.topic.create({
            data: {
              title: arg.titolo,
              description: arg.descrizione || '',
              year: '5',
              subjectId: subject.id
            }
          });
          
          // Sottoargomenti
          if (Array.isArray(arg.sottoargomenti)) {
            for (const sub of arg.sottoargomenti.slice(0, 5)) {
              await prisma.subtopic.create({
                data: {
                  title: sub.titolo,
                  summary: (sub.riassunto || '').substring(0, 500),
                  content: sub.riassunto || '',
                  topicId: topic.id
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Errore ${file}:`, error.message);
    }
  }
  
  // Badges
  const badges = [
    { name: 'Primo Quiz', description: 'Completa il tuo primo quiz', icon: '🏆' },
    { name: 'Studioso', description: 'Completa 10 quiz', icon: '📚' }
  ];
  for (const badge of badges) {
    await prisma.badge.create({ data: badge });
  }
}

// DEBUG: Test matching flashcards
app.get('/api/_debug/test-flashcards-match', async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const flashcardsFile = path.join(__dirname, 'files', 'src', 'data', 'flashcards', 'tutte-flashcards.json');
    const data = JSON.parse(fs.readFileSync(flashcardsFile, 'utf8'));
    const flashcards = data.flashcards || [];
    
    const subjects = await prisma.subject.findMany();
    const subjectMap = new Map();
    subjects.forEach(s => {
      const key = s.name.toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[^\w]/g, '')
        .trim();
      subjectMap.set(key, s.name);
    });
    
    const materieCounts = {};
    const matched = {};
    const unmatched = {};
    
    flashcards.slice(0, 100).forEach(f => {
      const materia = f.materia || 'unknown';
      materieCounts[materia] = (materieCounts[materia] || 0) + 1;
      
      const matKey = materia.toLowerCase().replace(/[^\w]/g, '');
      if (subjectMap.has(matKey)) {
        matched[materia] = subjectMap.get(matKey);
      } else {
        unmatched[materia] = matKey;
      }
    });
    
    res.json({
      totalFlashcards: flashcards.length,
      dbSubjects: subjects.map(s => s.name),
      materieCounts,
      matched,
      unmatched
    });
  } catch (error) {
    next(error);
  }
});

// Debug: FORCE RELOAD - carica TUTTI i contenuti anche se DB già inizializzato
app.get('/api/_debug/force-reload', async (req, res, next) => {
  // Invia subito una response per evitare timeout
  res.json({ 
    success: true, 
    message: 'Caricamento avviato in background. Controlla /api/_debug/counts tra 3-5 minuti.',
    status: 'processing'
  });

  // Esegui caricamento in background con gestione errori dettagliata
  (async () => {
    try {
      console.log('🔄 FORCE RELOAD richiesto - cancellazione e ricaricamento completo...');
      
      // Cancella tutto
      console.log('🧹 Pulizia database...');
      await clearContentTables(prisma);
      console.log('✅ Database pulito');
      
      // Ricarica tutto
      console.log('📚 Caricamento TUTTI i contenuti...');
      await loadAllContent(prisma);
      
      // Conta risultati
      const counts = {
        subjects: await prisma.subject.count(),
        topics: await prisma.topic.count(),
        subtopics: await prisma.subtopic.count(),
        quizzes: await prisma.quiz.count(),
        flashcards: await prisma.flashcard.count(),
        simulations: await prisma.simulation.count(),
        badges: await prisma.badge.count()
      };
      
      console.log('✅ FORCE RELOAD completato:', counts);
      console.log(`📊 TOTALE CONTENUTI: ${counts.quizzes + counts.flashcards + counts.simulations}`);
    } catch (err) { 
      console.error('❌ Errore force reload:', err);
      console.error('Stack:', err.stack);
    }
  })();
});

// Alias per compatibilità frontend
app.get('/api/materie', async (req, res) => {
  try {
    const indirizzo = req.headers['x-indirizzo'] || req.query.indirizzo || 'scientifico';
    const materieIndirizzo = getMaterieIndirizzo(indirizzo).map(m => m.toLowerCase());

    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            subtopics: true,
            quizzes: true
          }
        }
      }
    });

    const filteredSubjects = subjects.filter(s =>
      materieIndirizzo.includes(s.name.replace(/[^\w\s]/gi, '').trim().toLowerCase())
    );

    // Formato response per compatibilità frontend
    const materie = filteredSubjects.map(s => {
      // Rimuovi emoji e simboli dal nome per routing
      const cleanName = s.name.replace(/[^\w\s]/gi, '').trim().toLowerCase();
      
      // Formatta topics per frontend
      const topics = s.topics?.map(t => {
        const sottoargomenti = Array.isArray(t.subtopics) && t.subtopics.length > 0
          ? t.subtopics.map(sub => ({
              id: sub.id,
              name: sub.title,
              titolo: sub.title,
              content: sub.content || '',
              riassunto: sub.summary || sub.content || ''
            }))
          : [];
        
        return {
          id: t.id,
          name: t.title,
          titolo: t.title,
          descrizione: t.description || '',
          sottoargomenti: sottoargomenti
        };
      }) || [];
      
      return {
        id: s.id,
        name: cleanName,
        nome: s.name, // Nome completo con emoji
        icon: s.icon || '📚', // icon (non icona) per frontend
        descrizione: s.description || '',
        totaleArgomenti: topics.length,
        totaleSottoargomenti: topics.reduce((acc, t) => acc + (t.sottoargomenti?.length || 0), 0),
        argomenti: topics // argomenti per frontend
      };
    });

    res.json({ materie, indirizzo });
  } catch (error) {
    console.error('❌ Errore lista materie:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// Dettaglio singola materia (supporta nome o ID)
app.get('/api/materie/:nameOrId', async (req, res) => {
  try {
    let { nameOrId } = req.params;
    nameOrId = decodeURIComponent(nameOrId);
    
    // Rimuovi emoji dal parametro di ricerca
    const cleanSearch = nameOrId.replace(/[^\w\s]/gi, '').trim();
    
    // Cerca per ID o per nome (anche con emoji)
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            subtopics: true,
            quizzes: true
          }
        }
      }
    });
    
    const subject = subjects.find(s => {
      const cleanName = s.name.replace(/[^\w\s]/gi, '').trim();
      return s.id === nameOrId || 
             cleanName.toLowerCase() === cleanSearch.toLowerCase() ||
             s.name.toLowerCase().includes(cleanSearch.toLowerCase());
    });
    
    if (!subject) {
      return res.status(404).json({ error: 'Materia non trovata' });
    }
    
    // Formatta response per compatibilità frontend
    const formattedSubject = {
      ...subject,
      argomenti: subject.topics?.map(t => ({
        id: t.id,
        titolo: t.title,
        descrizione: t.description || '',
        sottoargomenti: t.subtopics?.map(sub => ({
          id: sub.id,
          titolo: sub.title,
          riassunto: sub.summary || sub.content || '',
          descrizione: sub.description || ''
        })) || []
      })) || []
    };
    
    res.json(formattedSubject);
  } catch (error) {
    console.error('❌ Errore dettaglio materia:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// Gamification routes per compatibilità
app.get('/api/gamification/profilo', async (req, res) => {
  try {
    // Per ora restituisci profilo utente di default o dati gamification
    res.json({
      utente: {
        id: 'default',
        nome: 'Studente',
        livello: 1,
        xp: 0,
        streak: 0
      },
      gamification: {
        livello: 1,
        xp: 0,
        xpPerProssimoLivello: 100,
        streak: 0,
        badge: []
      },
      statistiche: {
        quizCompletati: 0,
        flashcardsStudiate: 0,
        streak: 0
      },
      materie: {}
    });
  } catch (error) {
    console.error('❌ Errore gamification profilo:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

app.get('/api/gamification/notifiche', async (req, res) => {
  try {
    res.json([
      {
        id: 1,
        tipo: 'benvenuto',
        titolo: 'Benvenuto su Lumen Studio!',
        messaggio: 'Inizia il tuo percorso di apprendimento',
        letta: false,
        timestamp: Date.now()
      }
    ]);
  } catch (error) {
    console.error('❌ Errore gamification notifiche:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// Lista materie
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            subtopics: true,
            quizzes: true
          }
        }
      }
    });
    res.json(subjects);
  } catch (error) {
    console.error('❌ Errore lista materie:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// Contenuto materia
app.get('/api/content/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    
    const subjectData = await prisma.subject.findFirst({
      where: {
        OR: [
          { name: { contains: subject } },
          { name: { contains: subject.charAt(0).toUpperCase() + subject.slice(1) } }
        ]
      },
      include: {
        topics: {
          include: {
            subtopics: true,
            quizzes: true
          }
        }
      }
    });

    if (!subjectData) {
      return res.status(404).json({ error: 'Materia non trovata' });
    }

    // Formatta per compatibilità
    const formattedData = {
      materia: {
        nome: subjectData.name,
        descrizione: subjectData.description,
        colore: subjectData.color
      },
      argomenti: subjectData.topics.map(topic => ({
        id: topic.id,
        titolo: topic.title,
        descrizione: topic.description,
        annoRiferimento: topic.year,
        sottoargomenti: topic.subtopics.map(sub => ({
          titolo: sub.title,
          riassunto: sub.content
        }))
      }))
    };

    res.json(formattedData);
  } catch (error) {
    console.error('❌ Errore caricamento contenuto:', error);
    res.status(500).json({ error: 'Errore caricamento contenuto' });
  }
});

// Quiz per argomento
app.get('/api/quiz/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const quizzes = await prisma.quiz.findMany({
      where: { topicId },
      include: { topic: true }
    });

    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz.id,
      question: quiz.question,
      options: JSON.parse(quiz.options),
      correct: quiz.correctAnswer,
      explanation: quiz.explanation,
      difficulty: quiz.difficulty
    }));

    res.json(formattedQuizzes);
  } catch (error) {
    console.error('❌ Errore caricamento quiz:', error);
    res.status(500).json({ error: 'Errore caricamento quiz' });
  }
});

// Genera quiz
app.post('/api/quiz/generate', async (req, res) => {
  try {
    const { subject, topic, difficulty = 'medium', count = 5 } = req.body;
    
    // Trova topic nel database
    const topicData = await prisma.topic.findFirst({
      where: {
        title: { contains: topic },
        subject: {
          name: { contains: subject }
        }
      },
      include: { quizzes: true }
    });

    if (topicData && topicData.quizzes.length > 0) {
      const quizzes = topicData.quizzes
        .filter(q => q.difficulty === difficulty)
        .slice(0, count)
        .map(quiz => ({
          id: quiz.id,
          question: quiz.question,
          options: JSON.parse(quiz.options),
          correct: quiz.correctAnswer,
          explanation: quiz.explanation,
          difficulty: quiz.difficulty
        }));

      res.json({
        subject,
        topic,
        difficulty,
        questions: quizzes
      });
    } else {
      // Fallback con quiz generici
      res.json({
        subject,
        topic,
        difficulty,
        questions: []
      });
    }
  } catch (error) {
    console.error('❌ Errore generazione quiz:', error);
    res.status(500).json({ error: 'Errore generazione quiz' });
  }
});

app.get('/api/ai/test-openai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY non configurata' });
    }

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Sei un semplice checker di stato API e devi rispondere solo con JSON.' },
        { role: 'user', content: 'Rispondi solo con {"ok":true}.' }
      ],
      temperature: 0,
      max_tokens: 20,
      response_format: { type: 'json_object' }
    });

    let payload;
    try {
      payload = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch {
      payload = { ok: true };
    }

    res.json({ success: true, openai: payload });
  } catch (error) {
    console.error('❌ Errore test OpenAI:', error);
    res.status(500).json({ success: false, error: 'Errore test OpenAI' });
  }
});

app.post('/api/ai/generate-intelligent-quiz', async (req, res) => {
  try {
    const { materia, argomento, difficulty = 'medium', count = 5 } = req.body || {};

    // Validazione input migliorata
    if (!materia || typeof materia !== 'string' || materia.length < 2 || materia.length > 50) {
      return res.status(400).json({ success: false, error: 'Materia non valida (2-50 caratteri)' });
    }

    if (!argomento || typeof argomento !== 'string' || argomento.length < 3 || argomento.length > 100) {
      return res.status(400).json({ success: false, error: 'Argomento non valido (3-100 caratteri)' });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ success: false, error: 'Difficoltà non valida' });
    }

    if (typeof count !== 'number' || count < 1 || count > 20) {
      return res.status(400).json({ success: false, error: 'Numero quiz non valido (1-20)' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY non configurata' });
    }

    const questions = await generateAIQuiz(materia, argomento, difficulty, count);

    // Sanitizza output AI
    const sanitizedQuestions = questions.map(q => ({
      ...q,
      question: sanitizeAIOutput(q.question),
      explanation: sanitizeAIOutput(q.explanation),
      options: q.options.map(opt => sanitizeAIOutput(opt))
    }));

    // Valida ogni quiz generato
    for (const quiz of sanitizedQuestions) {
      const validation = validateQuizInput(quiz);
      if (!validation.isValid) {
        console.warn('Quiz generato non valido:', validation.errors);
        continue; // Skip quiz invalidi
      }
    }

    res.json({
      success: true,
      materia: sanitizeAIOutput(materia),
      argomento: sanitizeAIOutput(argomento),
      difficulty,
      count: sanitizedQuestions.length,
      questions: sanitizedQuestions
    });
  } catch (error) {
    console.error('❌ Errore generazione quiz AI:', error);
    res.status(500).json({ success: false, error: 'Errore generazione quiz AI' });
  }
});

app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { materia, argomento, sottoargomento, difficulty = 'medium', count = 5 } = req.body || {};
    const fullArgomento = sottoargomento ? `${argomento} - ${sottoargomento}` : argomento;

    if (!materia || !fullArgomento) {
      return res.status(400).json({ success: false, error: 'Materia e argomento sono obbligatori' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY non configurata' });
    }

    const questions = await generateAIQuiz(materia, fullArgomento, difficulty, count);

    res.json({
      success: true,
      materia,
      argomento: fullArgomento,
      difficulty,
      count: questions.length,
      questions
    });
  } catch (error) {
    console.error('❌ Errore generazione quiz AI (legacy):', error);
    res.status(500).json({ success: false, error: 'Errore generazione quiz AI' });
  }
});

// Flashcards per topic
app.get('/api/flashcards/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const flashcards = await prisma.flashcard.findMany({
      where: { topicId },
      include: { topic: { include: { subject: true } } }
    });

    res.json(flashcards.map(fc => ({
      id: fc.id,
      front: fc.front,
      back: fc.back,
      difficulty: fc.difficulty,
      topic: fc.topic.title,
      subject: fc.topic.subject.name
    })));
  } catch (error) {
    console.error('❌ Errore caricamento flashcards:', error);
    res.status(500).json({ error: 'Errore caricamento flashcards' });
  }
});

// Flashcards per materia
app.get('/api/flashcards/subject/:subject', async (req, res) => {
  try {
    const { subject } = req.params;
    const { difficulty, limit } = req.query;
    
    // Prima trova la materia
    const subjects = await prisma.subject.findMany();
    const cleanSearch = subject.toLowerCase().trim();
    const matchedSubject = subjects.find(s => {
      const cleanName = s.name.replace(/[^\w\s]/gi, '').trim();
      return cleanName.toLowerCase() === cleanSearch ||
             cleanName.toLowerCase().includes(cleanSearch) ||
             s.name.toLowerCase().includes(cleanSearch);
    });
    
    if (!matchedSubject) {
      return res.status(404).json({ error: 'Materia non trovata', flashcards: [] });
    }
    
    const where = {
      subtopic: {
        topic: {
          subjectId: matchedSubject.id
        }
      }
    };
    
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const flashcards = await prisma.flashcard.findMany({
      where,
      include: { 
        subtopic: { 
          include: { 
            topic: { 
              include: { subject: true } 
            } 
          } 
        } 
      },
      take: limit ? parseInt(limit) : undefined
    });

    res.json({
      flashcards: flashcards.map(fc => ({
        id: fc.id,
        fronte: fc.front,
        retro: fc.back,
        difficulty: fc.difficulty,
        argomento: fc.subtopic?.topic?.title || '',
        sottoargomento: fc.subtopic?.title || ''
      })),
      totale: flashcards.length
    });
  } catch (error) {
    console.error('❌ Errore caricamento flashcards per materia:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Errore caricamento flashcards', details: error.message });
  }
});

// Tutte le flashcards con filtri (FILTRO INDIRIZZO RIMOSSO - CAUSAVA 0 RISULTATI)
app.get('/api/flashcards', async (req, res) => {
  try {
    const { random, difficulty, limit, offset } = req.query;
    
    const where = {};
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const flashcards = await prisma.flashcard.findMany({
      where,
      include: { 
        subtopic: { 
          include: { 
            topic: {
              include: { subject: true }
            }
          } 
        } 
      },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
      orderBy: random === 'true' ? { createdAt: 'desc' } : undefined
    });

    const total = await prisma.flashcard.count({ where });

    res.json({
      flashcards: flashcards.map(fc => ({
        id: fc.id,
        front: fc.front,
        back: fc.back,
        subtopic: fc.subtopic?.title || '',
        topic: fc.subtopic?.topic?.title || '',
        materia: fc.subtopic?.topic?.subject?.name || ''
      })),
      total,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
  } catch (error) {
    console.error('❌ Errore caricamento flashcards:', error);
    res.status(500).json({ error: 'Errore caricamento flashcards', details: error.message });
  }
});

// Shuffle array helper
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Quiz Ultimate - Quiz veloce casuale con filtro indirizzo
app.get('/api/quiz-ultimate/veloce', async (req, res) => {
  try {
    const { numDomande = 10 } = req.query;
    const indirizzo = req.headers['x-indirizzo'] || req.query.indirizzo || 'scientifico';
    const materieIndirizzo = getMaterieIndirizzo(indirizzo).map(m => m.toLowerCase());
    const limit = parseInt(numDomande);

    // Prendi molti più quiz per poi randomizzare e filtrare
    const allQuizzes = await prisma.quiz.findMany({
      take: limit * 20,
      include: {
        topic: {
          include: { subject: true }
        }
      }
    });

    // Filtra per indirizzo
    const filtered = allQuizzes.filter(q => {
      const subjectName = q.topic?.subject?.name || '';
      const cleanName = subjectName.replace(/[^\w\s]/gi, '').trim().toLowerCase();
      return materieIndirizzo.includes(cleanName);
    });

    // Randomizza e prendi solo il numero richiesto
    const quizzes = shuffleArray(filtered).slice(0, limit);

    res.json({
      success: true,
      quiz: quizzes.map(q => {
        const originalOptions = parseQuizOptions(q.options);
        const opzioni = shuffleArray([...originalOptions]);
        const correctIdx = q.correctAnswer;
        const rispostaCorretta = typeof correctIdx === 'number'
          ? originalOptions[correctIdx]
          : correctIdx;
        return {
          id: q.id,
          domanda: q.question,
          opzioni,
          rispostaCorretta,
          spiegazione: q.explanation,
          materia: q.topic?.subject?.name || 'Generale',
          argomento: q.topic?.title || 'Vari'
        };
      })
    });
  } catch (error) {
    console.error('❌ Errore quiz veloce:', error);
    res.status(500).json({ error: 'Errore caricamento quiz' });
  }
});

// Quiz Ultimate - Quiz per materia
app.get('/api/quiz-ultimate/materia/:materiaId', async (req, res) => {
  try {
    const { materiaId } = req.params;
    const { numDomande = 10 } = req.query;
    const limit = parseInt(numDomande);

    const quizzes = await prisma.quiz.findMany({
      where: {
        topic: {
          subject: {
            OR: [
              { id: materiaId },
              { name: { contains: materiaId, mode: 'insensitive' } }
            ]
          }
        }
      },
      take: limit,
      include: {
        topic: {
          include: { subject: true }
        }
      }
    });

    res.json({
      success: true,
      quiz: quizzes.map(q => {
        const opzioni = shuffleArray(parseQuizOptions(q.options));
        const correctIdx = q.correctAnswer;
        const originalOptions = parseQuizOptions(q.options);
        const rispostaCorretta = typeof correctIdx === 'number'
          ? originalOptions[correctIdx]
          : correctIdx;
        return {
          id: q.id,
          domanda: q.question,
          opzioni,
          rispostaCorretta,
          spiegazione: q.explanation,
          materia: q.topic?.subject?.name || 'Generale',
          argomento: q.topic?.title || 'Vari'
        };
      })
    });
  } catch (error) {
    console.error('❌ Errore quiz per materia:', error);
    res.status(500).json({ error: 'Errore caricamento quiz' });
  }
});

app.get('/api/simulazioni', async (req, res) => {
  try {
    const { materia, page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (materia) {
      where.subject = { contains: materia, mode: 'insensitive' };
    }
    const [simulazioni, totale] = await Promise.all([
      prisma.simulation.findMany({
        where,
        take: parseInt(limit),
        skip,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.simulation.count({ where })
    ]);
    res.json({
      simulazioni: simulazioni.map((s, index) => {
        let domande = [];
        let numeroDomande = 0;
        
        try {
          if (s.questions) {
            let parsed;
            if (typeof s.questions === 'string') {
              parsed = JSON.parse(s.questions);
            } else {
              parsed = s.questions;
            }
            
            // Estrai array domande dall'oggetto JSON
            if (Array.isArray(parsed)) {
              domande = parsed;
            } else if (parsed && typeof parsed === 'object') {
              // Cerca domande nei campi comuni
              domande = parsed.domande || parsed.questions || parsed.problemi || [];
            }
          }
          numeroDomande = Array.isArray(domande) ? domande.length : 0;
        } catch (e) {
          console.error('Errore parsing domande simulazione', s.id, ':', e.message);
          domande = [];
          numeroDomande = 0;
        }
        
        return {
          id: s.id,
          numero: skip + index + 1,
          titolo: s.title,
          descrizione: s.description,
          materia: s.subject,
          difficolta: s.difficulty,
          numeroDomande: numeroDomande,
          domande: domande
        };
      }),
      totale,
      pagina: parseInt(page),
      limitPerPagina: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Errore simulazioni:', error);
    res.status(500).json({ error: 'Errore caricamento simulazioni' });
  }
});

// Simulazioni legacy
app.get('/api/simulations', async (req, res) => {
  try {
    const { subject, difficulty } = req.query;
    
    const where = {};
    if (subject) {
      where.subject = { contains: subject, mode: 'insensitive' };
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const simulations = await prisma.simulation.findMany({ where });
    res.json(simulations);
  } catch (error) {
    console.error('❌ Errore caricamento simulazioni:', error);
    res.status(500).json({ error: 'Errore caricamento simulazioni' });
  }
});

// Simulazione per ID
app.get('/api/simulations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const simulation = await prisma.simulation.findUnique({
      where: { id }
    });

    if (!simulation) {
      return res.status(404).json({ error: 'Simulazione non trovata' });
    }

    res.json(simulation);
  } catch (error) {
    console.error('❌ Errore caricamento simulazione:', error);
    res.status(500).json({ error: 'Errore caricamento simulazione' });
  }
});

// Badge
app.get('/api/badges', async (req, res) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (error) {
    console.error('❌ Errore caricamento badge:', error);
    res.status(500).json({ error: 'Errore caricamento badge' });
  }
});

// Salva progresso (CON VALIDAZIONE)
app.post('/api/progress/save', async (req, res) => {
  try {
    const { userId = 'default', subjectId, topicId, score, timeSpent } = req.body;
    
    // Validazione input
    if (!subjectId || !topicId) {
      return res.status(400).json({ error: 'subjectId e topicId sono obbligatori' });
    }
    
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({ error: 'score deve essere un numero tra 0 e 100' });
    }
    
    if (typeof timeSpent !== 'number' || timeSpent < 0) {
      return res.status(400).json({ error: 'timeSpent deve essere un numero positivo' });
    }
    
    // Sanitizza userId
    const sanitizedUserId = userId ? String(userId).replace(/[^a-zA-Z0-9_-]/g, '') : 'default';
    
    const progress = await prisma.progress.create({
      data: {
        userId: sanitizedUserId,
        subjectId: String(subjectId).replace(/[^a-zA-Z0-9_-]/g, ''),
        topicId: String(topicId).replace(/[^a-zA-Z0-9_-]/g, ''),
        score,
        timeSpent,
        completed: score >= 60
      }
    });

    res.json({ 
      success: true, 
      progress,
      message: 'Progresso salvato'
    });
  } catch (error) {
    console.error('❌ Errore salvataggio progresso:', error);
    res.status(500).json({ error: 'Errore salvataggio progresso' });
  }
});

// Statistiche utente
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const stats = await prisma.progress.groupBy({
      by: ['subjectId'],
      where: { userId },
      _avg: { score: true },
      _count: { id: true },
      _sum: { timeSpent: true }
    });

    res.json(stats);
  } catch (error) {
    console.error('❌ Errore statistiche:', error);
    res.status(500).json({ error: 'Errore statistiche' });
  }
});

// Gestione errori
app.use((error, req, res, next) => {
  console.error('❌ Errore server:', error);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Avvio server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server ImparaFacile avviato su porta ${PORT}`);
      console.log(`📡 API disponibili su http://localhost:${PORT}/api`);
      console.log(`💾 Database PostgreSQL: Supabase Cloud`);
      console.log('✅ Sistema completo attivo!');
    });
  } catch (error) {
    console.error('❌ Errore avvio server:', error);
    process.exit(1);
  }
}

// Cleanup
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

startServer();

module.exports = app;
