/**
 * 🔍 SEARCH ROUTES - Ricerca globale contenuti
 * Ricerca in riassunti, quiz, flashcard con collegamenti
 */

const express = require('express');
const router = express.Router();

// Database helper
let db = null;
try {
  const { PrismaClient } = require('@prisma/client');
  db = new PrismaClient();
} catch (e) {}

// Auth middleware
const authenticateUser = (req, res, next) => {
  req.userId = req.user?.id || req.headers['x-user-id'] || 'demo-user';
  next();
};

/**
 * GET /api/search/global
 * Ricerca globale in tutti i contenuti
 */
router.get('/global', authenticateUser, async (req, res) => {
  try {
    const { q, filter = 'all', limit = 20 } = req.query;
    const userId = req.userId;

    if (!q || q.length < 2) {
      return res.json({ results: [], total: 0 });
    }

    const query = q.toLowerCase();
    const results = {
      riassunti: [],
      quiz: [],
      flashcards: [],
      collegamenti: [],
      total: 0
    };

    // Cerca in database
    if (db) {
      try {
        // Cerca Quiz
        if (filter === 'all' || filter === 'quiz') {
          const quizResults = await db.domanda.findMany({
            where: {
              OR: [
                { testo: { contains: query, mode: 'insensitive' } },
                { spiegazione: { contains: query, mode: 'insensitive' } }
              ]
            },
            include: {
              quiz: {
                include: { argomento: { include: { materia: true } } }
              }
            },
            take: parseInt(limit)
          });

          results.quiz = quizResults.map(d => ({
            id: d.id,
            domanda: d.testo,
            spiegazione: d.spiegazione,
            materia: d.quiz?.argomento?.materia?.nome,
            argomento: d.quiz?.argomento?.titolo,
            difficolta: 3
          }));
        }

        // Cerca Flashcard
        if (filter === 'all' || filter === 'flashcards') {
          const flashcardResults = await db.flashcard.findMany({
            where: {
              OR: [
                { fronte: { contains: query, mode: 'insensitive' } },
                { retro: { contains: query, mode: 'insensitive' } }
              ]
            },
            include: {
              argomento: { include: { materia: true } }
            },
            take: parseInt(limit)
          });

          results.flashcards = flashcardResults.map(f => ({
            id: f.id,
            fronte: f.fronte,
            retro: f.retro,
            materia: f.argomento?.materia?.nome,
            argomento: f.argomento?.titolo
          }));
        }

        // Cerca Argomenti (riassunti)
        if (filter === 'all' || filter === 'riassunti') {
          const argomentiResults = await db.argomento.findMany({
            where: {
              OR: [
                { titolo: { contains: query, mode: 'insensitive' } },
                { descrizione: { contains: query, mode: 'insensitive' } }
              ]
            },
            include: { materia: true },
            take: parseInt(limit)
          });

          results.riassunti = argomentiResults.map(a => ({
            id: a.id,
            titolo: a.titolo,
            materia: a.materia?.nome,
            argomento: a.titolo,
            snippet: a.descrizione?.substring(0, 200) || ''
          }));
        }

      } catch (dbErr) {
        console.error('DB search error:', dbErr);
      }
    }

    // Genera collegamenti interdisciplinari
    if (filter === 'all' || filter === 'collegamenti') {
      results.collegamenti = generaCollegamenti(query);
    }

    // Calcola totale
    results.total = results.riassunti.length + results.quiz.length + 
                    results.flashcards.length + results.collegamenti.length;

    // Salva ricerca
    if (db && userId !== 'demo-user') {
      try {
        await db.ricercaRecente.create({
          data: {
            utenteId: userId,
            query: q,
            filtri: { filter },
            risultati: results.total
          }
        });
      } catch (e) {}
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/search/recent
 * Ricerche recenti dell'utente
 */
router.get('/recent', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    let recent = [];

    if (db && userId !== 'demo-user') {
      try {
        const searches = await db.ricercaRecente.findMany({
          where: { utenteId: userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          distinct: ['query']
        });
        recent = searches.map(s => s.query);
      } catch (e) {}
    }

    res.json(recent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/search/popular
 * Ricerche più popolari
 */
router.get('/popular', async (req, res) => {
  try {
    // Ricerche popolari statiche per studenti di maturità
    const popular = [
      'Leopardi pessimismo',
      'Derivate e integrali',
      'Seconda guerra mondiale',
      'DNA e genetica',
      'Kant critica ragion pura',
      'Ungaretti ermetismo',
      'Equazioni secondo grado',
      'Rivoluzione francese',
      'Relativita Einstein',
      'Pirandello maschere'
    ];

    res.json(popular);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search/click
 * Registra click su risultato (per analytics)
 */
router.post('/click', authenticateUser, async (req, res) => {
  try {
    const { query, resultId, type } = req.body;
    const userId = req.userId;

    // Log per analytics
    if (db && userId !== 'demo-user') {
      try {
        await db.activityLog.create({
          data: {
            utenteId: userId,
            tipo: 'search_click',
            dettagli: { query, resultId, type }
          }
        });
      } catch (e) {}
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === HELPER FUNCTIONS ===

function generaCollegamenti(query) {
  // Collegamenti interdisciplinari basati su keyword
  const collegamentiDB = {
    'tempo': {
      tema: 'Il Tempo',
      materie: [
        { materia: 'Filosofia', argomento: 'Bergson e la durata' },
        { materia: 'Fisica', argomento: 'Relatività e tempo' },
        { materia: 'Italiano', argomento: 'Tempo in Ungaretti' },
        { materia: 'Arte', argomento: 'Dalì e gli orologi molli' }
      ]
    },
    'guerra': {
      tema: 'La Guerra',
      materie: [
        { materia: 'Storia', argomento: 'Prima/Seconda Guerra Mondiale' },
        { materia: 'Italiano', argomento: 'Letteratura di trincea' },
        { materia: 'Filosofia', argomento: 'Hannah Arendt' },
        { materia: 'Arte', argomento: 'Guernica di Picasso' }
      ]
    },
    'natura': {
      tema: 'Uomo e Natura',
      materie: [
        { materia: 'Italiano', argomento: 'Leopardi - Dialogo della Natura' },
        { materia: 'Filosofia', argomento: 'Schelling e filosofia della natura' },
        { materia: 'Scienze', argomento: 'Ecologia e ambiente' },
        { materia: 'Arte', argomento: 'Romanticismo e paesaggio' }
      ]
    },
    'progresso': {
      tema: 'Il Progresso',
      materie: [
        { materia: 'Storia', argomento: 'Rivoluzione Industriale' },
        { materia: 'Italiano', argomento: 'Verga e il progresso' },
        { materia: 'Filosofia', argomento: 'Positivismo' },
        { materia: 'Fisica', argomento: 'Scoperte scientifiche 900' }
      ]
    },
    'alienazione': {
      tema: 'Alienazione',
      materie: [
        { materia: 'Filosofia', argomento: 'Marx e alienazione' },
        { materia: 'Italiano', argomento: 'Pirandello - crisi identità' },
        { materia: 'Arte', argomento: 'Espressionismo' },
        { materia: 'Storia', argomento: 'Società di massa' }
      ]
    },
    'infinito': {
      tema: 'L\'Infinito',
      materie: [
        { materia: 'Italiano', argomento: 'Leopardi - L\'Infinito' },
        { materia: 'Matematica', argomento: 'Limiti e infinito' },
        { materia: 'Filosofia', argomento: 'Hegel e l\'Assoluto' },
        { materia: 'Fisica', argomento: 'Universo e cosmologia' }
      ]
    }
  };

  const results = [];
  const queryLower = query.toLowerCase();

  // Cerca corrispondenze
  Object.entries(collegamentiDB).forEach(([key, value]) => {
    if (queryLower.includes(key) || key.includes(queryLower)) {
      results.push({
        id: key,
        ...value
      });
    }
  });

  // Se non trova, suggerisci basandosi sul contesto
  if (results.length === 0) {
    // Cerca parole chiave nelle materie
    Object.entries(collegamentiDB).forEach(([key, value]) => {
      const allText = value.materie.map(m => m.argomento.toLowerCase()).join(' ');
      if (allText.includes(queryLower)) {
        results.push({
          id: key,
          ...value
        });
      }
    });
  }

  return results.slice(0, 3);
}

module.exports = router;
