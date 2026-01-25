/**
 * 🛡️ VALIDAZIONE INPUT PROFESSIONALE
 * Prevenzione injection, XSS, SQL injection
 */

const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

/**
 * 📋 Schema di validazione per ogni endpoint
 */
const validationSchemas = {
  // Auth
  login: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().min(8).max(128).required()
  }),
  
  register: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'Password deve contenere maiuscole, minuscole e numeri'
      }),
    nome: Joi.string().min(2).max(100).required(),
    cognome: Joi.string().min(2).max(100).required(),
    dataScadenza: Joi.date().iso()
  }),

  // Quiz AI
  generateQuiz: Joi.object({
    materia: Joi.string()
      .valid('Italiano', 'Storia', 'Filosofia', 'Matematica', 'Fisica', 'Scienze', 'Arte', 'Inglese', 'Latino', 'Religione')
      .required(),
    argomento: Joi.string().min(2).max(200).required(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'facile', 'intermedio', 'difficile'),
    count: Joi.number().integer().min(1).max(20).default(5),
    tipo: Joi.string().valid('MCQ', 'VF', 'numerica', 'completamento')
  }),

  // Flashcards
  updateFlashcard: Joi.object({
    flashcardId: Joi.string().required(),
    quality: Joi.number().integer().min(0).max(5).required()
  }),

  // AI Chat
  aiChat: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
    conversationHistory: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required()
      })
    ).max(20),
    context: Joi.string().max(500)
  }),

  // Upload
  upload: Joi.object({
    materia: Joi.string().max(100),
    argomento: Joi.string().max(200),
    generateQuiz: Joi.boolean(),
    generateFlashcards: Joi.boolean(),
    saveToProfile: Joi.boolean()
  }),

  // Marketplace
  createListing: Joi.object({
    titolo: Joi.string().min(5).max(200).required(),
    descrizione: Joi.string().min(20).max(2000).required(),
    prezzo: Joi.number().min(0).max(1000).required(),
    categoria: Joi.string().required(),
    condizione: Joi.string().valid('nuovo', 'ottimo', 'buono', 'discreto').required(),
    immagini: Joi.array().items(Joi.string().uri()).max(5)
  }),

  // Search
  search: Joi.object({
    q: Joi.string().min(1).max(100),
    materia: Joi.string(),
    tipo: Joi.string(),
    difficolta: Joi.number().integer().min(1).max(5),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

/**
 * 🔒 Middleware di validazione
 */
class ValidationMiddleware {
  
  /**
   * ✅ Valida request body
   */
  static validateBody(schema) {
    return async (req, res, next) => {
      try {
        // Ottieni schema
        const validationSchema = typeof schema === 'string' 
          ? validationSchemas[schema]
          : schema;

        if (!validationSchema) {
          throw new Error(`Schema validazione '${schema}' non trovato`);
        }

        // Valida
        const validated = await validationSchema.validateAsync(req.body, {
          stripUnknown: true, // Rimuovi campi non definiti
          abortEarly: false  // Mostra tutti gli errori
        });

        // Sanitizza stringhe
        req.body = ValidationMiddleware.sanitizeObject(validated);
        
        next();
      } catch (error) {
        if (error.isJoi) {
          return res.status(400).json({
            success: false,
            error: 'Dati non validi',
            details: error.details.map(d => ({
              field: d.path.join('.'),
              message: d.message
            }))
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'Errore validazione'
        });
      }
    };
  }

  /**
   * ✅ Valida query params
   */
  static validateQuery(schema) {
    return async (req, res, next) => {
      try {
        const validationSchema = typeof schema === 'string' 
          ? validationSchemas[schema]
          : schema;

        const validated = await validationSchema.validateAsync(req.query, {
          stripUnknown: true
        });

        req.query = ValidationMiddleware.sanitizeObject(validated);
        next();
      } catch (error) {
        if (error.isJoi) {
          return res.status(400).json({
            success: false,
            error: 'Parametri non validi',
            details: error.details
          });
        }
        
        return res.status(500).json({
          success: false,
          error: 'Errore validazione query'
        });
      }
    };
  }

  /**
   * 🧹 Sanitizza oggetto (previene XSS)
   */
  static sanitizeObject(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Sanitizza HTML
        sanitized[key] = DOMPurify.sanitize(value, { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [] 
        });
        
        // Escape caratteri pericolosi
        sanitized[key] = validator.escape(sanitized[key]);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' 
            ? ValidationMiddleware.sanitizeObject(item)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = ValidationMiddleware.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 🔒 Previeni SQL Injection
   */
  static sanitizeSQL(value) {
    if (typeof value !== 'string') return value;
    
    // Rimuovi caratteri pericolosi per SQL
    return value
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  /**
   * 🔒 Valida file upload
   */
  static validateFile(options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
    } = options;

    return (req, res, next) => {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files || [req.file];

      for (const file of files) {
        // Check size
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: `File troppo grande (max ${maxSize / 1024 / 1024}MB)`
          });
        }

        // Check MIME type
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: 'Tipo file non permesso',
            allowedTypes
          });
        }

        // Check extension
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return res.status(400).json({
            success: false,
            error: 'Estensione file non permessa',
            allowedExtensions
          });
        }

        // Sanitizza nome file
        file.sanitizedName = validator.escape(file.originalname)
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .substring(0, 255);
      }

      next();
    };
  }

  /**
   * 🔒 Valida parametri route
   */
  static validateParams(schema) {
    return async (req, res, next) => {
      try {
        const validated = await schema.validateAsync(req.params);
        req.params = validated;
        next();
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Parametri URL non validi'
        });
      }
    };
  }

  /**
   * 🛡️ Anti-CSRF token validation
   */
  static validateCSRF(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || token !== sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'CSRF token non valido'
      });
    }

    next();
  }

  /**
   * 📊 Log tentativi sospetti
   */
  static logSuspiciousActivity(req, reason) {
    const log = {
      timestamp: new Date(),
      ip: req.ip,
      userId: req.user?.id,
      reason,
      url: req.originalUrl,
      method: req.method,
      userAgent: req.headers['user-agent']
    };

    // In produzione: salva in DB o invia alert
    console.warn('⚠️ ATTIVITÀ SOSPETTA:', log);
  }
}

// Export schemas per uso esterno
ValidationMiddleware.schemas = validationSchemas;

module.exports = ValidationMiddleware;
