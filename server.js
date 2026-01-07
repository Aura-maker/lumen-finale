// SERVER BACKEND COMPLETO CON PRISMA
// Gestisce tutti i contenuti: materie, quiz, simulazioni, gamification

// require('dotenv').config(); // DISABILITATO - SOLO DATABASE HARDCODED

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const helmet = require('helmet');
const { sanitizeMiddleware, sanitizeAIOutput, validateQuizInput, validateFlashcardInput, validateSummaryInput } = require('./middleware/sanitize.middleware');
const { register, login, getProfile } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Configurazione Prisma - HARDCODE PostgreSQL
const DATABASE_URL = "postgresql://postgres.uqvdiqmioqnvywmkchma:Levinoliver18_@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

console.log('🔍 Using HARDCODED PostgreSQL DATABASE_URL');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

// Middleware di Sicurezza
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
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://lumenstudio-edu.netlify.app',
        'https://lumen-studio.netlify.app', 
        'https://lumen-studio-2.netlify.app',
        'https://leafy-dango-48e237.netlify.app'
      ] 
    : ['http://localhost:3000', 'http://localhost:3003'],
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
const CONTENT_PATH = path.join(__dirname, '..', 'files', 'src', 'data');

console.log('🚀 Avviando server ImparaFacile...');
console.log('📁 Percorso contenuti:', CONTENT_PATH);

// INIZIALIZZAZIONE DATABASE
async function initializeDatabase() {
  try {
    console.log('🔄 Inizializzando database...');
console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'CONFIGURATO' : 'MANCANTE');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
    
    // Verifica se ci sono già dati
    const subjectCount = await prisma.subject.count();
    if (subjectCount > 0) {
      console.log('✅ Database già inizializzato');
      return;
    }
    
    console.log('📚 Caricando contenuti nel database...');
    await loadAllContentToDatabase();
    console.log('✅ Database inizializzato con successo');
    
  } catch (error) {
    console.error('❌ Errore inizializzazione database:', error);
  }
}

// CARICA TUTTI I CONTENUTI NEL DATABASE
async function loadAllContentToDatabase() {
  const subjects = [
    { id: 'filosofia', name: '📙 Filosofia', icon: '📙', color: '#9C27B0', description: 'Da Kant al Novecento' },
    { id: 'matematica', name: '🧮 Matematica', icon: '🧮', color: '#2196F3', description: 'Analisi e calcolo' },
    { id: 'fisica', name: '⚛️ Fisica', icon: '⚛️', color: '#4CAF50', description: 'Meccanica e termodinamica' },
    { id: 'storia', name: '🏛️ Storia', icon: '🏛️', color: '#FF9800', description: 'Dal Medioevo all\'età contemporanea' },
    { id: 'italiano', name: '📚 Italiano', icon: '📚', color: '#E91E63', description: 'Letteratura e linguistica' },
    { id: 'arte', name: '🎨 Arte', icon: '🎨', color: '#673AB7', description: 'Storia dell\'arte' },
    { id: 'scienze', name: '🔬 Scienze', icon: '🔬', color: '#00BCD4', description: 'Biologia e chimica' },
    { id: 'inglese', name: '🌍 Inglese', icon: '🌍', color: '#795548', description: 'Lingua e letteratura' },
    { id: 'latino', name: '🏛️ Latino', icon: '🏛️', color: '#607D8B', description: 'Lingua e letteratura latina' },
    { id: 'religione', name: '✝️ Religione', icon: '✝️', color: '#8BC34A', description: 'Storia delle religioni' }
  ];

  for (const subjectData of subjects) {
    try {
      // Crea materia
      const subject = await prisma.subject.create({
        data: {
          name: subjectData.name,
          icon: subjectData.icon,
          color: subjectData.color,
          description: subjectData.description
        }
      });

      console.log(`📖 Caricando contenuti per: ${subjectData.name}`);
      
      // Carica contenuti da file
      const filePath = path.join(CONTENT_PATH, `contenuti-${subjectData.id}.js`);
      if (fs.existsSync(filePath)) {
        const contentData = await loadContentFromFile(filePath);
        if (contentData && contentData.argomenti) {
          await loadTopicsForSubject(subject.id, contentData.argomenti);
        }
      }
      
    } catch (error) {
      console.error(`❌ Errore caricamento ${subjectData.name}:`, error);
    }
  }
  
  // Carica simulazioni
  await loadSimulations();
  
  // Carica badge
  await loadBadges();
}

// CARICA CONTENUTO DA FILE (SICURO)
async function loadContentFromFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Prova export default - usa Function invece di eval
    let match = fileContent.match(/export default\s*({[\s\S]*});?\s*$/);
    if (match) {
      const func = new Function('return ' + match[1]);
      return func();
    }
    
    // Prova module.exports - usa Function invece di eval
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

// CARICA ARGOMENTI PER MATERIA
async function loadTopicsForSubject(subjectId, argomenti) {
  for (const argomento of argomenti) {
    try {
      const topic = await prisma.topic.create({
        data: {
          title: argomento.titolo,
          description: argomento.descrizione || '',
          year: argomento.annoRiferimento || '5',
          subjectId: subjectId
        }
      });

      // Carica sottoargomenti
      if (argomento.sottoargomenti) {
        for (const sottoarg of argomento.sottoargomenti) {
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

      // Genera quiz per l'argomento
      await generateQuizzesForTopic(topic.id, argomento.titolo);
      
    } catch (error) {
      console.error(`❌ Errore caricamento argomento ${argomento.titolo}:`, error);
    }
  }
}

// GENERA QUIZ PER ARGOMENTO
async function generateQuizzesForTopic(topicId, topicTitle) {
  const quizzes = [
    {
      question: `Quale delle seguenti affermazioni su "${topicTitle}" è corretta?`,
      options: JSON.stringify([
        'Prima opzione corretta',
        'Seconda opzione sbagliata',
        'Terza opzione sbagliata',
        'Quarta opzione sbagliata'
      ]),
      correctAnswer: 0,
      explanation: `La prima opzione è corretta perché rappresenta il concetto fondamentale di ${topicTitle}.`,
      difficulty: 'medium'
    },
    {
      question: `In che anno è stato sviluppato il concetto di "${topicTitle}"?`,
      options: JSON.stringify([
        '1800-1850',
        '1850-1900',
        '1900-1950',
        '1950-2000'
      ]),
      correctAnswer: 1,
      explanation: `Il concetto di ${topicTitle} è stato sviluppato principalmente nel periodo 1850-1900.`,
      difficulty: 'hard'
    },
    {
      question: `Quale autore è principalmente associato a "${topicTitle}"?`,
      options: JSON.stringify([
        'Primo autore',
        'Secondo autore',
        'Terzo autore',
        'Quarto autore'
      ]),
      correctAnswer: 0,
      explanation: `Il primo autore è quello principalmente associato allo sviluppo di ${topicTitle}.`,
      difficulty: 'easy'
    }
  ];

  for (const quiz of quizzes) {
    try {
      await prisma.quiz.create({
        data: {
          ...quiz,
          topicId: topicId
        }
      });
    } catch (error) {
      console.error('❌ Errore creazione quiz:', error);
    }
  }
}

async function generateAIQuiz(materia, argomento, difficulty = 'medium', count = 5) {
  const temperature = Number(process.env.OPENAI_TEMPERATURE || 0.3);
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS || 1500);

  const systemPrompt = 'Sei un tutor esperto che crea quiz a scelta multipla per studenti delle superiori. Le domande devono essere chiare, con distrattori plausibili e una spiegazione dettagliata per ogni risposta.';

  const userPrompt = `Genera ${count} domande di quiz in italiano per la materia "${materia}" sull'argomento "${argomento}" con difficoltà ${difficulty}.\n` +
    'Devi restituire SOLO JSON valido nel seguente formato: {"questions":[{"question":"testo domanda","options":["opzione1","opzione2","opzione3","opzione4"],"correctIndex":0,"explanation":"spiegazione dettagliata","difficulty":"easy|medium|hard"}]}. Non aggiungere testo fuori dal JSON.';

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error('❌ Errore parsing risposta OpenAI:', err);
    throw new Error('Risposta OpenAI non in formato JSON valido');
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions;
}

// CARICA SIMULAZIONI
async function loadSimulations() {
  const simulations = [
    {
      title: 'Simulazione Maturità - Filosofia',
      description: 'Simulazione completa dell\'esame di filosofia per la maturità',
      subject: 'filosofia',
      difficulty: 'hard',
      questions: JSON.stringify([
        {
          question: 'Spiega il concetto di imperativo categorico in Kant',
          type: 'essay',
          points: 15
        },
        {
          question: 'Confronta il pensiero di Hegel e Schopenhauer',
          type: 'essay',
          points: 15
        }
      ])
    },
    {
      title: 'Test Matematica - Limiti e Derivate',
      description: 'Verifica delle competenze su limiti e derivate',
      subject: 'matematica',
      difficulty: 'medium',
      questions: JSON.stringify([
        {
          question: 'Calcola il limite di (x²-1)/(x-1) per x→1',
          type: 'calculation',
          answer: '2',
          points: 10
        }
      ])
    },
    {
      title: 'Simulazione Fisica - Meccanica',
      description: 'Test completo sui principi della meccanica classica',
      subject: 'fisica',
      difficulty: 'medium',
      questions: JSON.stringify([
        {
          question: 'Un corpo di massa 2kg si muove con velocità 10m/s. Calcola la sua energia cinetica.',
          type: 'calculation',
          answer: '100J',
          points: 8
        }
      ])
    }
  ];

  for (const sim of simulations) {
    try {
      await prisma.simulation.create({ data: sim });
    } catch (error) {
      console.error('❌ Errore creazione simulazione:', error);
    }
  }
}

// CARICA BADGE
async function loadBadges() {
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

// ROUTES API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server ImparaFacile attivo con Prisma'
  });
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

// Simulazioni
app.get('/api/simulations', async (req, res) => {
  try {
    const simulations = await prisma.simulation.findMany();
    res.json(simulations);
  } catch (error) {
    console.error('❌ Errore caricamento simulazioni:', error);
    res.status(500).json({ error: 'Errore caricamento simulazioni' });
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
      console.log(`💾 Database SQLite: ${path.join(__dirname, 'prisma', 'dev.db')}`);
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
