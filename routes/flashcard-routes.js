/**
 * 🗂️ FLASHCARD ROUTES CON SM-2+ 
 * Sistema superiore ad Anki
 */

const express = require('express');
const router = express.Router();
const SM2Plus = require('../services/sm2-plus.service');
const AuthMiddleware = require('../middleware/auth.middleware');
const RateLimiter = require('../middleware/rate-limiter');
const Validation = require('../middleware/validation.middleware');

/**
 * POST /api/flashcards/review
 * Processa review con SM-2+ algorithm
 */
router.post('/review',
  AuthMiddleware.authenticate,
  RateLimiter.createGeneralLimiter(),
  Validation.validateBody({
    flashcardId: Validation.schemas.joi.string().required(),
    quality: Validation.schemas.joi.number().integer().min(0).max(5).required(),
    context: Validation.schemas.joi.object({
      timeOfDay: Validation.schemas.joi.boolean(),
      studyStreak: Validation.schemas.joi.number(),
      previousResult: Validation.schemas.joi.string(),
      subjectDifficulty: Validation.schemas.joi.number()
    })
  }),
  async (req, res) => {
    try {
      const { flashcardId, quality, context } = req.body;
      
      // Recupera flashcard dal DB
      const flashcard = await prisma.flashcard.findUnique({
        where: { id: flashcardId },
        include: { sm2Data: true }
      });
      
      if (!flashcard) {
        return res.status(404).json({
          success: false,
          error: 'Flashcard non trovata'
        });
      }
      
      // Calcola nuovi parametri SM-2+
      const newSM2 = SM2Plus.calculate(flashcard, quality, context);
      
      // Salva nel DB
      await prisma.flashcard.update({
        where: { id: flashcardId },
        data: {
          sm2Data: {
            upsert: {
              create: newSM2,
              update: newSM2
            }
          },
          lastReview: new Date(),
          totalReviews: { increment: 1 }
        }
      });
      
      // Track per analytics
      await prisma.studySession.create({
        data: {
          userId: req.userId,
          flashcardId,
          quality,
          easeFactor: newSM2.easeFactor,
          interval: newSM2.interval,
          timestamp: new Date()
        }
      });
      
      res.json({
        success: true,
        sm2: newSM2,
        nextReview: newSM2.nextReview,
        mastery: newSM2.stats.mastery,
        message: quality >= 3 
          ? `Ottimo! Prossima review tra ${newSM2.interval} giorni`
          : 'Riproviamo domani per consolidare'
      });
      
    } catch (error) {
      console.error('Errore review flashcard:', error);
      res.status(500).json({
        success: false,
        error: 'Errore durante la review'
      });
    }
  }
);

/**
 * GET /api/flashcards/due
 * Ottieni flashcards da ripassare oggi (con SM-2+)
 */
router.get('/due',
  AuthMiddleware.authenticate,
  async (req, res) => {
    try {
      const now = new Date();
      
      // Recupera flashcards con review <= oggi
      const dueCards = await prisma.flashcard.findMany({
        where: {
          userId: req.userId,
          OR: [
            { sm2Data: { nextReview: { lte: now } } },
            { sm2Data: null } // Nuove cards
          ]
        },
        include: {
          sm2Data: true,
          subject: true
        }
      });
      
      // Ottimizza sessione con SM-2+
      const maxTime = parseInt(req.query.maxTime) || 30;
      const optimized = SM2Plus.optimizeSession(dueCards, maxTime);
      
      res.json({
        success: true,
        due: optimized.cards,
        estimatedTime: optimized.estimatedTime,
        skipped: optimized.skipped,
        stats: SM2Plus.getAnalytics(dueCards)
      });
      
    } catch (error) {
      console.error('Errore recupero flashcards:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero flashcards'
      });
    }
  }
);

/**
 * GET /api/flashcards/stats
 * Statistiche avanzate SM-2+
 */
router.get('/stats',
  AuthMiddleware.authenticate,
  async (req, res) => {
    try {
      const allCards = await prisma.flashcard.findMany({
        where: { userId: req.userId },
        include: { sm2Data: true }
      });
      
      const analytics = SM2Plus.getAnalytics(allCards);
      
      // Aggiungi statistiche personali
      const sessions = await prisma.studySession.findMany({
        where: {
          userId: req.userId,
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Ultimi 30 giorni
          }
        }
      });
      
      const personalStats = {
        totalReviews: sessions.length,
        avgQuality: sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length || 0,
        streak: calculateStreak(sessions),
        bestStreak: calculateBestStreak(sessions),
        studyTime: calculateStudyTime(sessions),
        heatmap: generateHeatmap(sessions)
      };
      
      res.json({
        success: true,
        analytics,
        personal: personalStats
      });
      
    } catch (error) {
      console.error('Errore statistiche:', error);
      res.status(500).json({
        success: false,
        error: 'Errore recupero statistiche'
      });
    }
  }
);

/**
 * POST /api/flashcards/predict
 * Predici performance futura
 */
router.post('/predict',
  AuthMiddleware.authenticate,
  Validation.validateBody({
    flashcardId: Validation.schemas.joi.string().required(),
    days: Validation.schemas.joi.number().min(1).max(365).default(30)
  }),
  async (req, res) => {
    try {
      const { flashcardId, days } = req.body;
      
      const flashcard = await prisma.flashcard.findUnique({
        where: { id: flashcardId },
        include: { sm2Data: true }
      });
      
      if (!flashcard) {
        return res.status(404).json({
          success: false,
          error: 'Flashcard non trovata'
        });
      }
      
      const predictions = SM2Plus.predictPerformance(flashcard, days);
      
      res.json({
        success: true,
        predictions,
        recommendation: predictions.find(p => p.recommended)
      });
      
    } catch (error) {
      console.error('Errore predizione:', error);
      res.status(500).json({
        success: false,
        error: 'Errore calcolo predizioni'
      });
    }
  }
);

/**
 * POST /api/flashcards/reset-leech
 * Reset flashcard "leech" (difficili)
 */
router.post('/reset-leech/:id',
  AuthMiddleware.authenticate,
  async (req, res) => {
    try {
      const flashcard = await prisma.flashcard.update({
        where: { 
          id: req.params.id,
          userId: req.userId 
        },
        data: {
          sm2Data: {
            update: {
              lapses: 0,
              isLeech: false,
              easeFactor: 2.5,
              interval: 1
            }
          }
        }
      });
      
      res.json({
        success: true,
        message: 'Flashcard resettata con successo',
        flashcard
      });
      
    } catch (error) {
      console.error('Errore reset leech:', error);
      res.status(500).json({
        success: false,
        error: 'Errore reset flashcard'
      });
    }
  }
);

// Helper functions
function calculateStreak(sessions) {
  // Calcola streak corrente di giorni consecutivi
  const today = new Date().toDateString();
  let streak = 0;
  let currentDate = new Date();
  
  while (true) {
    const dateStr = currentDate.toDateString();
    const hasStudied = sessions.some(s => 
      new Date(s.timestamp).toDateString() === dateStr
    );
    
    if (!hasStudied && dateStr !== today) break;
    if (hasStudied) streak++;
    
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return streak;
}

function calculateBestStreak(sessions) {
  // Implementazione per calcolare il miglior streak
  // ... codice omesso per brevità
  return 0;
}

function calculateStudyTime(sessions) {
  // Stima tempo studio basato su numero review
  return sessions.length * 1.5; // 1.5 minuti per card in media
}

function generateHeatmap(sessions) {
  // Genera dati per heatmap stile GitHub
  const heatmap = {};
  
  sessions.forEach(session => {
    const date = new Date(session.timestamp).toISOString().split('T')[0];
    heatmap[date] = (heatmap[date] || 0) + 1;
  });
  
  return heatmap;
}

module.exports = router;
