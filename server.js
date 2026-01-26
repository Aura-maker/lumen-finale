// BACKEND MINIMALE GARANTITO FUNZIONANTE
// Solo endpoint essenziali: materie, quiz, flashcards, simulazioni

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 10000;
const prisma = new PrismaClient();

// CORS configurato per supportare credentials (withCredentials: true da axios)
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://lumenedu.netlify.app',
      'http://localhost:3000',
      'http://localhost:4000'
    ];
    // Permetti richieste senza origin (Postman, curl, ecc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permetti comunque per compatibilità
    }
  },
  credentials: true, // Necessario per withCredentials: true
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'ImparaFacile Backend Running',
    endpoints: [
      'GET /health',
      'POST /api/auth/registrati',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/_debug/counts',
      'GET /api/_debug/populate-fixed-ids',
      'GET /api/_debug/quiz-batch',
      'GET /api/materie',
      'GET /api/quiz-ultimate/veloce',
      'GET /api/flashcards',
      'GET /api/simulazioni'
    ]
  });
});

// ==================== AUTH ROUTES ====================
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes caricati');
} catch (error) {
  console.error('❌ ERRORE caricamento auth routes:', error.message);
}

// ==================== GAMIFICATION ROUTES ====================
try {
  const gamificationRoutes = require('./routes/gamification');
  app.use('/api/gamification', gamificationRoutes);
  app.use('/api/gamification-v2', gamificationRoutes);
  console.log('✅ Gamification routes caricati');
} catch (error) {
  console.error('❌ ERRORE caricamento gamification routes:', error.message);
}

// ==================== DEBUG: COUNTS ====================
app.get('/api/_debug/counts', async (req, res) => {
  try {
    const counts = {
      materie: await prisma.subject.count(),
      argomenti: await prisma.topic.count(),
      sottoargomenti: await prisma.subtopic.count(),
      quiz: await prisma.quiz.count(),
      flashcards: await prisma.flashcard.count(),
      simulazioni: await prisma.simulation.count(),
      utenti: await prisma.user.count()
    };
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEBUG: POPULATE FIXED IDS ====================
app.get('/api/_debug/populate-fixed-ids', async (req, res) => {
  try {
    console.log('🔥 POPOLAMENTO CON ID FISSI...');
    const { populateWithFixedIds } = require('./utils/populate-with-fixed-ids');
    const counts = await populateWithFixedIds(prisma);
    res.json({ 
      success: true, 
      message: 'DB popolato con ID fissi',
      counts 
    });
  } catch (error) {
    console.error('Errore populate:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ==================== DEBUG: QUIZ BATCH ====================
app.get('/api/_debug/quiz-batch', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset || '0');
    const limit = parseInt(req.query.limit || '500');
    
    const { loadQuizBatch } = require('./utils/quiz-batch-loader');
    const result = await loadQuizBatch(prisma, offset, limit);
    
    res.json({ 
      success: true,
      loaded: result.loaded,
      skipped: result.skipped,
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Errore quiz batch:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEBUG: GENERATE FLASHCARDS ====================
app.get('/api/_debug/generate-flashcards', async (req, res) => {
  try {
    console.log('🃏 GENERAZIONE FLASHCARDS...');
    const { generateFlashcardsFromQuizzes } = require('./utils/flashcards-generator');
    const result = await generateFlashcardsFromQuizzes(prisma);
    res.json({ success: true, message: 'Flashcards generate', ...result });
  } catch (error) {
    console.error('Errore flashcards:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DEBUG: GENERATE SIMULATIONS ====================
app.get('/api/_debug/generate-simulations', async (req, res) => {
  try {
    console.log('📝 GENERAZIONE SIMULAZIONI...');
    const { generateSimulationsFromQuizzes } = require('./utils/flashcards-generator');
    const result = await generateSimulationsFromQuizzes(prisma);
    res.json({ success: true, message: 'Simulazioni generate', ...result });
  } catch (error) {
    console.error('Errore simulazioni:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== API: MATERIE ====================
app.get('/api/materie', async (req, res) => {
  try {
    const indirizzo = req.headers['x-indirizzo'] || req.query.indirizzo || 'scientifico';
    
    // Carica configurazione indirizzi
    const { getMaterieIndirizzo } = require('./data/config/indirizzi-scolastici');
    const materieIndirizzo = getMaterieIndirizzo(indirizzo).map(m => m.toLowerCase());
    
    // Normalizza nome materia
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const allSubjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            subtopics: true
          }
        }
      }
    });
    
    // Filtra materie per indirizzo
    const filtered = allSubjects.filter(s => 
      materieIndirizzo.some(m => normalize(m) === normalize(s.name))
    );
    
    // Formatta per frontend
    const formatted = filtered.map(subj => ({
      id: subj.id,
      nome: subj.name,
      icona: subj.icon || '📚',
      colore: subj.color || '#4A90E2',
      descrizione: subj.description || '',
      argomenti: subj.topics.map(topic => ({
        id: topic.id,
        titolo: topic.title,
        descrizione: topic.description || '',
        anno: topic.year || '5',
        sottoargomenti: topic.subtopics.map(sub => ({
          id: sub.id,
          titolo: sub.title,
          riassunto: sub.summary || ''
        }))
      }))
    }));
    
    res.json({ materie: formatted });
  } catch (error) {
    console.error('Errore /api/materie:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== API: QUIZ ====================
app.get('/api/quiz-ultimate/veloce', async (req, res) => {
  try {
    const { numDomande = 10, materiaId } = req.query;
    const indirizzo = req.headers['x-indirizzo'] || req.query.indirizzo || 'scientifico';
    
    const { getMaterieIndirizzo } = require('./data/config/indirizzi-scolastici');
    const materieIndirizzo = getMaterieIndirizzo(indirizzo).map(m => m.toLowerCase());
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Trova subject IDs per indirizzo
    const allSubjects = await prisma.subject.findMany();
    const subjectIds = allSubjects
      .filter(s => materieIndirizzo.some(m => normalize(m) === normalize(s.name)))
      .map(s => s.id);
    
    const where = materiaId 
      ? { topic: { subjectId: materiaId } }
      : { topic: { subjectId: { in: subjectIds } } };
    
    const totalQuiz = await prisma.quiz.count({ where });
    const skip = Math.floor(Math.random() * Math.max(0, totalQuiz - parseInt(numDomande)));
    
    const quizzes = await prisma.quiz.findMany({
      where,
      take: parseInt(numDomande),
      skip,
      include: {
        topic: {
          include: { subject: true }
        }
      }
    });
    
    const formatted = quizzes.map(q => ({
      id: q.id,
      domanda: q.question,
      opzioni: JSON.parse(q.options || '[]'),
      rispostaCorretta: q.correctAnswer,
      spiegazione: q.explanation || '',
      difficolta: q.difficulty || 'media',
      materia: q.topic?.subject?.name || '',
      argomento: q.topic?.title || ''
    }));
    
    res.json({ quiz: formatted, totale: totalQuiz });
  } catch (error) {
    console.error('Errore /api/quiz-ultimate/veloce:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== API: FLASHCARDS ====================
app.get('/api/flashcards', async (req, res) => {
  try {
    const { materiaId, argomentoId, limit = 20 } = req.query;
    
    const where = {};
    if (argomentoId) {
      where.subtopicId = argomentoId;
    }
    
    const flashcards = await prisma.flashcard.findMany({
      where,
      take: parseInt(limit),
      include: {
        subtopic: {
          include: {
            topic: {
              include: { subject: true }
            }
          }
        }
      }
    });
    
    const formatted = flashcards.map(f => ({
      id: f.id,
      fronte: f.front,
      retro: f.back,
      materia: f.subtopic?.topic?.subject?.name || '',
      argomento: f.subtopic?.topic?.title || ''
    }));
    
    res.json({ flashcards: formatted });
  } catch (error) {
    console.error('Errore /api/flashcards:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== API: SIMULAZIONI ====================
app.get('/api/simulazioni', async (req, res) => {
  try {
    const { materiaId } = req.query;
    
    const where = materiaId ? { subjectId: materiaId } : {};
    
    const simulations = await prisma.simulation.findMany({
      where
    });
    
    const formatted = simulations.map(s => ({
      id: s.id,
      titolo: s.title,
      descrizione: s.description || '',
      materiaId: s.subjectId || '',
      domande: JSON.parse(s.questions || '[]'),
      tipologia: s.type || 'maturita'
    }));
    
    res.json({ simulazioni: formatted });
  } catch (error) {
    console.error('Errore /api/simulazioni:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ImparaFacile Backend LIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Port: ${PORT}
🗄️  DB: PostgreSQL (Prisma)
🌍 CORS: Permissivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
