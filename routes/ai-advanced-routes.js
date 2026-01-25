/**
 * 🤖 API ROUTES - AI ADVANCED
 * Routes per tutti i servizi AI avanzati
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Import servizi
const aiService = require('../services/ai-service');
const estraiCreaService = require('../services/estrai-crea-service');
const quizGenerator = require('../services/quiz-generator-advanced');
const flashcardsGenerator = require('../services/flashcards-generator-advanced');
const myContentsService = require('../services/my-contents-service');
const intelligentMapsService = require('../services/intelligent-maps-service');

// Configurazione upload
const upload = multer({
  dest: path.join(__dirname, '../uploads/temp'),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato'), false);
    }
  }
});

// Middleware autenticazione (placeholder)
const authenticateUser = (req, res, next) => {
  // In produzione: implementare vera autenticazione
  req.userId = req.headers['x-user-id'] || req.user?.id || 'test-user';
  next();
};

// === TEST OPENAI ===

/**
 * GET /api/ai/test-openai
 * Test rapido per verificare che OpenAI funzioni
 */
router.get('/test-openai', async (req, res) => {
  try {
    console.log('🧪 Test OpenAI richiesto');
    
    const testResult = await aiService.generateContent({
      type: 'extract-exercise',
      prompt: 'Risolvi questa semplice equazione: x + 5 = 12. Fornisci la soluzione in formato JSON con passaggi.'
    });
    
    res.json({
      success: true,
      message: 'OpenAI funziona correttamente!',
      test_result: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Errore test OpenAI:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test OpenAI fallito'
    });
  }
});

// === ESTRAI E CREA ===

/**
 * POST /api/ai/estrai-crea
 * Estrai e crea contenuti da foto/testo
 */
router.post('/estrai-crea', authenticateUser, upload.single('image'), async (req, res) => {
  try {
    console.log('📸 Richiesta estrai-crea ricevuta');
    
    const input = {
      type: req.file ? 'image' : 'text',
      content: req.file ? req.file.path : req.body.text,
      materia: req.body.materia,
      argomento: req.body.argomento
    };
    
    const options = {
      generateQuiz: req.body.generateQuiz !== 'false',
      generateFlashcards: req.body.generateFlashcards !== 'false',
      generateVarianti: req.body.generateVarianti !== 'false',
      generateMappa: req.body.generateMappa === 'true'
    };
    
    const result = await estraiCreaService.processInput(input, options);
    
    // Salva in "I miei contenuti" se richiesto
    if (req.body.saveToMyContents === 'true') {
      if (result.quiz && result.quiz.length > 0) {
        for (const quiz of result.quiz) {
          await myContentsService.saveContent(req.userId, 'quiz', quiz);
        }
      }
      
      if (result.flashcards && result.flashcards.length > 0) {
        for (const flashcard of result.flashcards) {
          await myContentsService.saveContent(req.userId, 'flashcard', flashcard);
        }
      }
    }
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('❌ Errore estrai-crea:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === GENERAZIONE QUIZ ===

/**
 * POST /api/ai/generate-quiz
 * Genera quiz massivi da contenuti
 */
router.post('/generate-quiz', authenticateUser, async (req, res) => {
  try {
    console.log('🎯 Generazione quiz massiva');
    
    const options = {
      materia: req.body.materia,
      argomento: req.body.argomento,
      quizPerSottoargomento: req.body.quizPerSottoargomento || 20,
      difficolta: req.body.difficolta,
      tipologie: req.body.tipologie
    };
    
    const result = await quizGenerator.generateMassiveQuizzes(options);
    
    // Salva automaticamente
    if (req.body.autoSave === 'true') {
      const saveResults = await myContentsService.batchSaveContents(
        req.userId,
        result.quiz.map(q => ({
          type: 'quiz',
          content: q,
          options: { collezioni: ['Quiz Generati'] }
        }))
      );
      
      result.saved = saveResults.success.length;
    }
    
    res.json({
      success: true,
      totale: result.quiz.length,
      stats: result.stats,
      saved: result.saved || 0
    });
    
  } catch (error) {
    console.error('❌ Errore generazione quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/generate-intelligent-quiz
 * Genera un piccolo set di quiz intelligenti per uso interattivo
 */
router.post('/generate-intelligent-quiz', authenticateUser, async (req, res) => {
  try {
    const { materia, argomento, difficulty = 'intermedio', count = 5 } = req.body;

    if (!materia || !argomento) {
      return res.status(400).json({
        success: false,
        error: 'materia e argomento sono obbligatori'
      });
    }

    const safeCount = Math.max(1, Math.min(parseInt(count, 10) || 5, 10));

    const basePrompt = `
Genera UNA sola domanda a scelta multipla per studenti di liceo.
Materia: ${materia}
Argomento specifico: ${argomento}
Difficoltà: ${difficulty}

Requisiti:
- Domanda chiara, non banale, in italiano corretto
- Esattamente 4 opzioni, una sola corretta
- Distrattori plausibili basati su errori comuni
- Spiegazione dettagliata della risposta corretta

Rispondi SOLO con un JSON nel formato:
{
  "domanda": "testo della domanda",
  "opzioni": ["A", "B", "C", "D"],
  "risposta_corretta": 0,
  "spiegazione": "spiegazione dettagliata",
  "difficolta": "${difficulty}"
}`;

    const items = Array.from({ length: safeCount }).map(() => ({
      prompt: basePrompt,
      materia
    }));

    const batchResults = await aiService.processBatch(items, 'generate-quiz', {
      batchSize: Math.min(safeCount, 3),
      delayMs: 800
    });

    const questions = [];

    for (const result of batchResults) {
      if (!result.success || !result.data) continue;

      const raw = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!raw || !raw.domanda || !Array.isArray(raw.opzioni)) continue;

      questions.push({
        question: raw.domanda,
        options: raw.opzioni,
        correctIndex: typeof raw.risposta_corretta === 'number' ? raw.risposta_corretta : 0,
        explanation: raw.spiegazione || '',
        difficulty: raw.difficolta || difficulty,
        materia,
        argomento
      });
    }

    if (questions.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Impossibile generare quiz AI in questo momento'
      });
    }

    res.json({
      success: true,
      questions
    });
  } catch (error) {
    console.error('❌ Errore generate-intelligent-quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/search-quiz
 * Ricerca quiz generati
 */
router.get('/search-quiz', authenticateUser, async (req, res) => {
  try {
    const query = req.query.q || '';
    const filters = {
      materia: req.query.materia,
      difficolta: req.query.difficolta,
      tipo: req.query.tipo
    };
    
    const results = quizGenerator.searchQuizzes(query, filters);
    
    res.json({
      success: true,
      results,
      total: results.length
    });
    
  } catch (error) {
    console.error('❌ Errore ricerca quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === GENERAZIONE FLASHCARDS ===

/**
 * POST /api/ai/generate-flashcards
 * Genera flashcards massive da contenuti
 */
router.post('/generate-flashcards', authenticateUser, async (req, res) => {
  try {
    console.log('🎴 Generazione flashcards massiva');
    
    const options = {
      materia: req.body.materia,
      argomento: req.body.argomento,
      flashcardsPerSottoargomento: req.body.flashcardsPerSottoargomento || 40,
      includiImmaginiAI: req.body.includiImmagini === 'true'
    };
    
    const result = await flashcardsGenerator.generateMassiveFlashcards(options);
    
    // Salva automaticamente
    if (req.body.autoSave === 'true') {
      const saveResults = await myContentsService.batchSaveContents(
        req.userId,
        result.flashcards.map(f => ({
          type: 'flashcard',
          content: f,
          options: { collezioni: ['Flashcards Generate'] }
        }))
      );
      
      result.saved = saveResults.success.length;
    }
    
    res.json({
      success: true,
      totale: result.flashcards.length,
      mazzi: result.mazzi.length,
      stats: result.stats,
      saved: result.saved || 0
    });
    
  } catch (error) {
    console.error('❌ Errore generazione flashcards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/update-sm2
 * Aggiorna algoritmo SM2 per spaced repetition
 */
router.post('/update-sm2', authenticateUser, async (req, res) => {
  try {
    const { flashcardId, quality } = req.body;
    
    // Recupera flashcard
    const profile = await myContentsService.getUserProfile(req.userId);
    const flashcard = profile.flashcards.find(f => f.id === flashcardId);
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard non trovata'
      });
    }
    
    // Aggiorna SM2
    flashcard.sm2 = flashcardsGenerator.updateSM2(flashcard, quality);
    
    // Salva
    await myContentsService.updateContent(req.userId, 'flashcard', flashcardId, flashcard);
    
    res.json({
      success: true,
      sm2: flashcard.sm2
    });
    
  } catch (error) {
    console.error('❌ Errore update SM2:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === MY CONTENTS ===

/**
 * GET /api/ai/my-contents
 * Ottieni profilo contenuti utente
 */
router.get('/my-contents', authenticateUser, async (req, res) => {
  try {
    const profile = await myContentsService.getUserProfile(req.userId);
    const stats = await myContentsService.getUserStats(req.userId);
    
    res.json({
      success: true,
      profile: {
        id: profile.id,
        collections: Object.keys(profile.collections),
        stats
      }
    });
    
  } catch (error) {
    console.error('❌ Errore my contents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/my-contents/save
 * Salva contenuto
 */
router.post('/my-contents/save', authenticateUser, async (req, res) => {
  try {
    const { type, content, options } = req.body;
    
    const result = await myContentsService.saveContent(
      req.userId,
      type,
      content,
      options
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore salvataggio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/ai/my-contents/:type/:id
 * Aggiorna contenuto
 */
router.put('/my-contents/:type/:id', authenticateUser, async (req, res) => {
  try {
    const { type, id } = req.params;
    const updates = req.body;
    
    const result = await myContentsService.updateContent(
      req.userId,
      type,
      id,
      updates
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore aggiornamento:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/ai/my-contents/:type/:id
 * Elimina contenuto
 */
router.delete('/my-contents/:type/:id', authenticateUser, async (req, res) => {
  try {
    const { type, id } = req.params;
    
    const result = await myContentsService.deleteContent(
      req.userId,
      type,
      id
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore eliminazione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/my-contents/search
 * Ricerca contenuti
 */
router.post('/my-contents/search', authenticateUser, async (req, res) => {
  try {
    const { query, filters } = req.body;
    
    const results = await myContentsService.searchContents(
      req.userId,
      query,
      filters
    );
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('❌ Errore ricerca:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/my-contents/export
 * Esporta contenuti
 */
router.post('/my-contents/export', authenticateUser, async (req, res) => {
  try {
    const { format, options } = req.body;
    
    const result = await myContentsService.exportContents(
      req.userId,
      format,
      options
    );
    
    // Determina content-type
    let contentType = 'application/json';
    if (format === 'csv') contentType = 'text/csv';
    else if (format === 'pdf') contentType = 'application/pdf';
    else if (format === 'html') contentType = 'text/html';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="export.${format}"`);
    res.send(result);
    
  } catch (error) {
    console.error('❌ Errore export:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/my-contents/share
 * Condividi contenuto
 */
router.post('/my-contents/share', authenticateUser, async (req, res) => {
  try {
    const { type, contentId, options } = req.body;
    
    const result = await myContentsService.shareContent(
      req.userId,
      type,
      contentId,
      options
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore condivisione:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/share/:shareId
 * Accedi a contenuto condiviso
 */
router.get('/share/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const password = req.query.password;
    
    const metadata = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || 'direct'
    };
    
    const result = await myContentsService.accessSharedContent(
      shareId,
      password,
      metadata
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore accesso share:', error);
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});

// === INTELLIGENT MAPS ===

/**
 * POST /api/ai/maps/create
 * Crea nuova mappa intelligente
 */
router.post('/maps/create', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    console.log('🗺️ Creazione mappa intelligente');
    
    let input;
    if (req.file) {
      input = { file: req.file.path };
    } else if (req.body.url) {
      input = req.body.url;
    } else if (req.body.text) {
      input = req.body.text;
    } else if (req.body.materia && req.body.argomento) {
      input = {
        materia: req.body.materia,
        argomento: req.body.argomento
      };
    } else {
      throw new Error('Input mancante');
    }
    
    const options = {
      nome: req.body.nome,
      descrizione: req.body.descrizione,
      materia: req.body.materia,
      livello: req.body.livello,
      public: req.body.public === 'true',
      collaborative: req.body.collaborative === 'true'
    };
    
    const result = await intelligentMapsService.createIntelligentMap(input, options);
    
    // Salva in my contents se richiesto
    if (req.body.saveToMyContents === 'true' && result.success) {
      await myContentsService.saveContent(
        req.userId,
        'mappa',
        result.map,
        { collezioni: ['Mappe Intelligenti'] }
      );
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Errore creazione mappa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/maps/:mapId
 * Ottieni mappa
 */
router.get('/maps/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    const map = intelligentMapsService.maps.get(mapId);
    
    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Mappa non trovata'
      });
    }
    
    res.json({
      success: true,
      map
    });
    
  } catch (error) {
    console.error('❌ Errore recupero mappa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/maps/:mapId/diagnostic
 * Avvia test diagnostico
 */
router.post('/maps/:mapId/diagnostic', authenticateUser, async (req, res) => {
  try {
    const { mapId } = req.params;
    const options = req.body;
    
    const diagnostic = await intelligentMapsService.runDiagnosticTest(
      req.userId,
      mapId,
      options
    );
    
    res.json({
      success: true,
      diagnostic
    });
    
  } catch (error) {
    console.error('❌ Errore test diagnostico:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/maps/:mapId/progress
 * Traccia progresso
 */
router.post('/maps/:mapId/progress', authenticateUser, async (req, res) => {
  try {
    const { mapId } = req.params;
    const { nodeId, action, result } = req.body;
    
    const progress = await intelligentMapsService.trackProgress(
      req.userId,
      mapId,
      nodeId,
      action,
      result
    );
    
    res.json({
      success: true,
      progress
    });
    
  } catch (error) {
    console.error('❌ Errore tracking progresso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai/maps/:mapId/custom-path
 * Crea percorso personalizzato
 */
router.post('/maps/:mapId/custom-path', authenticateUser, async (req, res) => {
  try {
    const { mapId } = req.params;
    const { obiettivo, vincoli } = req.body;
    
    const customPath = await intelligentMapsService.createCustomPath(
      mapId,
      obiettivo,
      vincoli
    );
    
    res.json({
      success: true,
      path: customPath
    });
    
  } catch (error) {
    console.error('❌ Errore creazione percorso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/maps/:mapId/export
 * Esporta mappa
 */
router.get('/maps/:mapId/export', async (req, res) => {
  try {
    const { mapId } = req.params;
    const format = req.query.format || 'json';
    
    const result = await intelligentMapsService.exportMap(mapId, format);
    
    let contentType = 'application/json';
    if (format === 'opml') contentType = 'application/xml';
    else if (format === 'svg') contentType = 'image/svg+xml';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="map.${format}"`);
    res.send(result);
    
  } catch (error) {
    console.error('❌ Errore export mappa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/dashboard
 * Dashboard utente AI
 */
router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    const dashboard = await intelligentMapsService.getUserDashboard(req.userId);
    const stats = await myContentsService.getDetailedStats(req.userId);
    
    res.json({
      success: true,
      dashboard: {
        ...dashboard,
        contenuti: stats
      }
    });
    
  } catch (error) {
    console.error('❌ Errore dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
