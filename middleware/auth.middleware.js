/**
 * 🔐 MIDDLEWARE AUTENTICAZIONE JWT PROFESSIONALE
 * Supera Duolingo/Quizlet in sicurezza
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configurazione sicura
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_NEVER_USE_DEFAULT';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'CHANGE_THIS_REFRESH_SECRET';
const ACCESS_TOKEN_EXPIRY = '15m'; // Token breve per sicurezza
const REFRESH_TOKEN_EXPIRY = '7d';

class AuthMiddleware {
  /**
   * 🛡️ Verifica JWT con multi-layer security
   */
  static async authenticate(req, res, next) {
    try {
      // 1. Estrai token da multiple fonti (header, cookie)
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token mancante',
          code: 'NO_TOKEN'
        });
      }

      // 2. Verifica e decode JWT
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 3. Controllo blacklist (token revocati)
      const isBlacklisted = await AuthMiddleware.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          error: 'Token revocato',
          code: 'TOKEN_REVOKED'
        });
      }

      // 4. Verifica utente ancora attivo nel DB
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          nome: true,
          role: true,
          active: true,
          lastActivity: true
        }
      });

      if (!user || !user.active) {
        return res.status(401).json({
          success: false,
          error: 'Utente non autorizzato',
          code: 'USER_UNAUTHORIZED'
        });
      }

      // 5. Aggiorna last activity
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActivity: new Date() }
      });

      // 6. Attach user a request
      req.user = user;
      req.userId = user.id;
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token scaduto',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Token non valido',
          code: 'INVALID_TOKEN'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Errore autenticazione',
        code: 'AUTH_ERROR'
      });
    }
  }

  /**
   * 🔑 Genera coppia access/refresh token
   */
  static generateTokenPair(userId, additionalClaims = {}) {
    const accessToken = jwt.sign(
      { userId, ...additionalClaims },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  /**
   * 🔄 Refresh access token
   */
  static async refreshToken(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token mancante'
        });
      }

      // Verifica refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      
      // Genera nuova coppia
      const tokens = AuthMiddleware.generateTokenPair(decoded.userId);
      
      // Salva refresh token nel DB (opzionale per tracking)
      await prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: decoded.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      res.json({
        success: true,
        ...tokens
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Refresh token non valido'
      });
    }
  }

  /**
   * 🚫 Revoca token (logout)
   */
  static async revokeToken(req, res) {
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (token) {
        // Aggiungi a blacklist
        await prisma.blacklistedToken.create({
          data: {
            token,
            revokedAt: new Date()
          }
        });
      }

      res.json({
        success: true,
        message: 'Logout effettuato'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Errore durante il logout'
      });
    }
  }

  /**
   * 🎯 Middleware per ruoli specifici
   */
  static requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Non autenticato'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Ruolo non autorizzato',
          required: allowedRoles,
          current: req.user.role
        });
      }

      next();
    };
  }

  /**
   * 🔍 Estrai token da request
   */
  static extractToken(req) {
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Check cookies
    if (req.cookies && req.cookies.accessToken) {
      return req.cookies.accessToken;
    }

    // 3. Check query params (per WebSocket)
    if (req.query && req.query.token) {
      return req.query.token;
    }

    return null;
  }

  /**
   * 🚫 Controlla se token è nella blacklist
   */
  static async isTokenBlacklisted(token) {
    try {
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token }
      });
      return !!blacklisted;
    } catch {
      return false;
    }
  }

  /**
   * 🛡️ Middleware per endpoint AI costosi
   */
  static async authenticateAI(req, res, next) {
    // Prima autenticazione standard
    await AuthMiddleware.authenticate(req, res, async () => {
      // Poi controlli aggiuntivi per AI
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.userId },
          select: {
            id: true,
            aiCredits: true,
            subscription: true
          }
        });

        // Controllo crediti AI
        if (!user.subscription && user.aiCredits <= 0) {
          return res.status(402).json({
            success: false,
            error: 'Crediti AI esauriti',
            code: 'NO_AI_CREDITS'
          });
        }

        // Decrementa crediti se non premium
        if (!user.subscription) {
          await prisma.user.update({
            where: { id: user.id },
            data: { aiCredits: user.aiCredits - 1 }
          });
        }

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Errore verifica crediti AI'
        });
      }
    });
  }
}

module.exports = AuthMiddleware;
