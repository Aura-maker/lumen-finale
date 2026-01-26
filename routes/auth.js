const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'lumen-studio-secret-key-2024';

// Registrazione utente
async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    // Validazione
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email e password sono richiesti' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'La password deve essere di almeno 6 caratteri' 
      });
    }

    // Controlla se utente esiste già
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username o email già utilizzati' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crea utente
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        xp: 0,
        level: 1,
        streak: 0
      },
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

    // Genera JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Utente registrato con successo',
      user,
      token
    });

  } catch (error) {
    console.error('Errore registrazione:', error);
    res.status(500).json({ 
      error: 'Errore durante la registrazione' 
    });
  }
}

// Login utente
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validazione
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email e password sono richiesti' 
      });
    }

    // Trova utente
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Email o password non validi' 
      });
    }

    // Verifica password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Email o password non validi' 
      });
    }

    // Genera JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Rimuovi password dalla response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login effettuato con successo',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ 
      error: 'Errore durante il login' 
    });
  }
}

// Get user profile
async function getProfile(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token non fornito' 
      });
    }

    // Verifica token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Trova utente
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        xp: true,
        level: true,
        streak: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'Utente non trovato' 
      });
    }

    res.json({ user });

  } catch (error) {
    console.error('Errore get profile:', error);
    res.status(401).json({ 
      error: 'Token non valido' 
    });
  }
}

// Configura le route
router.post('/registrati', register);
router.post('/login', login);
router.get('/me', getProfile);

module.exports = router;
