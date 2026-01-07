/**
 * 🚦 RATE LIMITER PROFESSIONALE
 * Sistema multi-tier come Duolingo Premium
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Redis client (fallback to memory se non disponibile)
let redisClient;
try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  });
} catch (error) {
  console.warn('⚠️ Redis non disponibile, uso memoria locale per rate limiting');
}

/**
 * 🎯 Rate limiter configurabili per tier utente
 */
class RateLimiterMiddleware {
  
  /**
   * 📊 Limiti per tipo di utente
   */
  static LIMITS = {
    FREE: {
      windowMs: 15 * 60 * 1000, // 15 minuti
      standard: 100,            // 100 richieste generali
      ai: 10,                   // 10 richieste AI
      quiz: 50,                 // 50 generazioni quiz
      uploads: 5                // 5 upload
    },
    PREMIUM: {
      windowMs: 15 * 60 * 1000,
      standard: 1000,          // 10x free
      ai: 100,                 // 10x free
      quiz: 500,               // 10x free
      uploads: 50              // 10x free
    },
    UNLIMITED: {
      windowMs: 15 * 60 * 1000,
      standard: 10000,
      ai: 1000,
      quiz: 5000,
      uploads: 500
    }
  };

  /**
   * 🌐 Rate limiter generale
   */
  static createGeneralLimiter() {
    return rateLimit({
      store: redisClient ? new RedisStore({
        client: redisClient,
        prefix: 'rl:general:'
      }) : undefined,
      windowMs: 15 * 60 * 1000,
      max: async (req) => {
        const tier = await RateLimiterMiddleware.getUserTier(req);
        return RateLimiterMiddleware.LIMITS[tier].standard;
      },
      message: {
        success: false,
        error: 'Troppe richieste, riprova tra qualche minuto',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip
    });
  }

  /**
   * 🤖 Rate limiter per AI endpoints
   */
  static createAILimiter() {
    return rateLimit({
      store: redisClient ? new RedisStore({
        client: redisClient,
        prefix: 'rl:ai:'
      }) : undefined,
      windowMs: 15 * 60 * 1000,
      max: async (req) => {
        const tier = await RateLimiterMiddleware.getUserTier(req);
        return RateLimiterMiddleware.LIMITS[tier].ai;
      },
      message: {
        success: false,
        error: 'Limite AI raggiunto. Passa a Premium per più richieste!',
        code: 'AI_RATE_LIMIT_EXCEEDED',
        upgradeUrl: '/pricing'
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      skip: async (req) => {
        // Skip per admin
        return req.user?.role === 'ADMIN';
      },
      handler: async (req, res) => {
        const tier = await RateLimiterMiddleware.getUserTier(req);
        res.status(429).json({
          success: false,
          error: 'Limite AI raggiunto',
          currentTier: tier,
          limits: RateLimiterMiddleware.LIMITS[tier],
          upgradeUrl: tier === 'FREE' ? '/pricing' : null,
          retryAfter: res.getHeader('Retry-After')
        });
      }
    });
  }

  /**
   * 📝 Rate limiter per generazione quiz
   */
  static createQuizLimiter() {
    return rateLimit({
      store: redisClient ? new RedisStore({
        client: redisClient,
        prefix: 'rl:quiz:'
      }) : undefined,
      windowMs: 15 * 60 * 1000,
      max: async (req) => {
        const tier = await RateLimiterMiddleware.getUserTier(req);
        return RateLimiterMiddleware.LIMITS[tier].quiz;
      },
      message: {
        success: false,
        error: 'Troppi quiz generati, riprova più tardi',
        code: 'QUIZ_RATE_LIMIT_EXCEEDED'
      }
    });
  }

  /**
   * 📤 Rate limiter per upload
   */
  static createUploadLimiter() {
    return rateLimit({
      store: redisClient ? new RedisStore({
        client: redisClient,
        prefix: 'rl:upload:'
      }) : undefined,
      windowMs: 60 * 60 * 1000, // 1 ora per upload
      max: async (req) => {
        const tier = await RateLimiterMiddleware.getUserTier(req);
        return RateLimiterMiddleware.LIMITS[tier].uploads;
      },
      message: {
        success: false,
        error: 'Limite upload raggiunto',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
      }
    });
  }

  /**
   * 🔑 Rate limiter per login (anti brute-force)
   */
  static createLoginLimiter() {
    return rateLimit({
      store: redisClient ? new RedisStore({
        client: redisClient,
        prefix: 'rl:login:'
      }) : undefined,
      windowMs: 15 * 60 * 1000,
      max: 5, // Max 5 tentativi login
      skipSuccessfulRequests: true, // Non contare login riusciti
      message: {
        success: false,
        error: 'Troppi tentativi di login, account temporaneamente bloccato',
        code: 'LOGIN_BLOCKED'
      },
      keyGenerator: (req) => req.body?.email || req.ip
    });
  }

  /**
   * 🎓 Determina tier utente
   */
  static async getUserTier(req) {
    if (!req.user) return 'FREE';
    
    // Check subscription in DB
    if (req.user.subscription === 'UNLIMITED') return 'UNLIMITED';
    if (req.user.subscription === 'PREMIUM') return 'PREMIUM';
    
    return 'FREE';
  }

  /**
   * 📊 Middleware per tracking usage
   */
  static async trackUsage(req, res, next) {
    if (!req.user) return next();

    try {
      const key = `usage:${req.user.id}:${new Date().toISOString().split('T')[0]}`;
      
      if (redisClient) {
        await redisClient.hincrby(key, 'total', 1);
        await redisClient.hincrby(key, req.path, 1);
        await redisClient.expire(key, 86400 * 30); // Mantieni per 30 giorni
      }

      // Log per analytics
      const usage = {
        userId: req.user.id,
        endpoint: req.path,
        method: req.method,
        timestamp: new Date(),
        ip: req.ip
      };

      // Qui potresti salvare in DB o inviare a servizio analytics
      console.log('📊 Usage:', usage);
    } catch (error) {
      console.error('Error tracking usage:', error);
    }

    next();
  }

  /**
   * 🛡️ DDoS Protection
   */
  static createDDoSProtection() {
    return rateLimit({
      windowMs: 1000, // 1 secondo
      max: 20, // Max 20 req/secondo per IP
      message: 'Too many requests',
      standardHeaders: false,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      skip: (req) => {
        // Whitelist per servizi interni
        const whitelist = process.env.IP_WHITELIST?.split(',') || [];
        return whitelist.includes(req.ip);
      }
    });
  }

  /**
   * 🔄 Reset limiti per utente (admin only)
   */
  static async resetUserLimits(userId) {
    if (!redisClient) return false;

    try {
      const keys = await redisClient.keys(`rl:*:${userId}`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Error resetting limits:', error);
      return false;
    }
  }

  /**
   * 📈 Ottieni statistiche usage
   */
  static async getUsageStats(userId) {
    if (!redisClient) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `usage:${userId}:${today}`;
      const stats = await redisClient.hgetall(key);
      
      return {
        date: today,
        total: parseInt(stats.total || 0),
        endpoints: Object.entries(stats)
          .filter(([k]) => k !== 'total')
          .map(([endpoint, count]) => ({ endpoint, count: parseInt(count) }))
          .sort((a, b) => b.count - a.count)
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }
}

module.exports = RateLimiterMiddleware;
