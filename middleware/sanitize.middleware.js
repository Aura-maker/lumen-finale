/**
 * 🛡️ MIDDLEWARE SANITIZZAZIONE SICUREZZA
 * Protegge da XSS, injection e altri attacchi
 */

const createDOMPurify = require('isomorphic-dompurify');
const sanitizeHtml = require('sanitize-html');
const xss = require('xss');

/**
 * Sanitizza input utente per prevenire XSS
 */
function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  
  // Rimuovi HTML potenzialmente pericoloso
  const cleanHtml = sanitizeHtml(value, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href', 'title'],
      '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  });
  
  // Pulisci con DOMPurify per XSS avanzato
  const purified = createDOMPurify.sanitize(cleanHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title', 'class'],
    ALLOW_DATA_ATTR: false
  });
  
  // Rimuovi caratteri pericolosi per SQL injection
  return purified
    .replace(/['"\\]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Sanitizza oggetto ricorsivamente
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Middleware Express per sanitizzazione automatica
 */
function sanitizeMiddleware(req, res, next) {
  try {
    // Sanitizza query parameters
    req.query = sanitizeObject(req.query);
    
    // Sanitizza body (solo per application/json)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitizza params
    req.params = sanitizeObject(req.params);
    
    next();
  } catch (error) {
    console.error('❌ Errore sanitizzazione:', error);
    next();
  }
}

/**
 * Validazione input specifica per quiz
 */
function validateQuizInput(quiz) {
  const errors = [];
  
  if (!quiz.domanda || quiz.domanda.length < 10) {
    errors.push('Domanda troppo corta o mancante');
  }
  
  if (!quiz.opzioni || !Array.isArray(quiz.opzioni) || quiz.opzioni.length !== 4) {
    errors.push('Quiz deve avere esattamente 4 opzioni');
  }
  
  if (typeof quiz.rispostaCorretta !== 'number' || quiz.rispostaCorretta < 0 || quiz.rispostaCorretta > 3) {
    errors.push('Risposta corretta non valida');
  }
  
  if (!quiz.spiegazione || quiz.spiegazione.length < 20) {
    errors.push('Spiegazione troppo corta o mancante');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validazione input specifica per flashcards
 */
function validateFlashcardInput(flashcard) {
  const errors = [];
  
  if (!flashcard.fronte || flashcard.fronte.length < 5) {
    errors.push('Fronte flashcard troppo corto o mancante');
  }
  
  if (!flashcard.retro || !flashcard.retro.testo || flashcard.retro.testo.length < 10) {
    errors.push('Retro flashcard troppo corto o mancante');
  }
  
  if (flashcard.fronte.length > 200) {
    errors.push('Fronte flashcard troppo lungo');
  }
  
  if (flashcard.retro.testo.length > 1000) {
    errors.push('Retro flashcard troppo lungo');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validazione input specifica per riassunti
 */
function validateSummaryInput(summary) {
  const errors = [];
  
  if (!summary.testo || summary.testo.length < 50) {
    errors.push('Riassunto troppo corto o mancante');
  }
  
  if (summary.testo.length > 5000) {
    errors.push('Riassunto troppo lungo');
  }
  
  if (!summary.argomento || summary.argomento.length < 3) {
    errors.push('Argomento non valido');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rimuovi contenuti potenzialmente dannosi da AI output
 */
function sanitizeAIOutput(content) {
  if (typeof content !== 'string') return content;
  
  // Rimuovi script e contenuti pericolosi
  let cleaned = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '');
  
  // Pulisci con DOMPurify
  cleaned = createDOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false
  });
  
  return cleaned;
}

module.exports = {
  sanitizeMiddleware,
  sanitizeInput,
  sanitizeObject,
  sanitizeAIOutput,
  validateQuizInput,
  validateFlashcardInput,
  validateSummaryInput
};
