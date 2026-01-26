const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware per autenticazione (opzionale - per ora permissivo)
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    // Per ora continua senza bloccare
    req.userId = null;
    return next();
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'lumen-studio-secret-key-2024';
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    req.userId = null;
    next();
  }
}

// GET /api/gamification/profilo
router.get('/profilo', authMiddleware, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        email: true,
        xp: true,
        level: true,
        streak: true,
        createdAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({
      profilo: {
        ...user,
        xpPercentuale: ((user.xp % 100) / 100) * 100,
        prossimo_livello: user.level + 1
      }
    });
  } catch (error) {
    console.error('Errore profilo gamification:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// GET /api/gamification/notifiche
router.get('/notifiche', authMiddleware, async (req, res) => {
  try {
    // Per ora ritorna array vuoto - gamification completa richiederebbe tabella notifiche
    res.json({
      notifiche: [],
      non_lette: 0
    });
  } catch (error) {
    console.error('Errore notifiche gamification:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// GET /api/gamification-v2/sfide
router.get('/v2/sfide', authMiddleware, async (req, res) => {
  try {
    // Per ora ritorna array vuoto - sfide richiederebbero tabella dedicata
    res.json({
      sfide: [],
      disponibili: 0
    });
  } catch (error) {
    console.error('Errore sfide gamification:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/gamification/aggiungi-xp
router.post('/aggiungi-xp', authMiddleware, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    
    const { xp } = req.body;
    if (!xp || xp <= 0) {
      return res.status(400).json({ error: 'XP non valido' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    const nuovoXP = user.xp + xp;
    const nuovoLivello = Math.floor(nuovoXP / 100) + 1;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        xp: nuovoXP,
        level: nuovoLivello
      }
    });
    
    res.json({
      success: true,
      xp: updatedUser.xp,
      level: updatedUser.level,
      levelUp: nuovoLivello > user.level
    });
  } catch (error) {
    console.error('Errore aggiungi XP:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

module.exports = router;
