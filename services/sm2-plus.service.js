/**
 * 🧠 SM-2+ ALGORITHM - SUPERA ANKI
 * Spaced Repetition avanzato con machine learning adaptivo
 */

class SM2PlusAlgorithm {
  /**
   * 📊 Configurazione algoritmo SM-2+
   */
  static CONFIG = {
    // Livelli di qualità (0-5 come Anki)
    QUALITY_LEVELS: {
      0: { name: 'Blackout totale', factor: 0.0 },
      1: { name: 'Sbagliato', factor: 0.6 },
      2: { name: 'Difficile', factor: 0.7 },
      3: { name: 'Corretto con sforzo', factor: 0.8 },
      4: { name: 'Corretto', factor: 1.0 },
      5: { name: 'Facile', factor: 1.3 }
    },
    
    // Parametri iniziali
    INITIAL: {
      easeFactor: 2.5,      // Fattore facilità iniziale
      interval: 1,          // Intervallo iniziale in giorni
      repetitions: 0,       // Numero ripetizioni
      lapses: 0,           // Numero errori totali
      streak: 0            // Serie corretta attuale
    },

    // Limiti
    LIMITS: {
      minEaseFactor: 1.3,   // Ease factor minimo
      maxEaseFactor: 4.0,   // Ease factor massimo
      maxInterval: 365,     // Max 1 anno tra review
      leechThreshold: 8,    // Dopo 8 errori = "leech"
      graduationInterval: 21 // Dopo 21 giorni = "graduated"
    },

    // Bonus/Penalty avanzati
    MODIFIERS: {
      timeOfDay: {         // Bonus basato su ora studio
        morning: 1.1,      // 6-12
        afternoon: 1.0,    // 12-18
        evening: 0.95,     // 18-22
        night: 0.9        // 22-6
      },
      consistency: {       // Bonus per studio regolare
        daily: 1.2,
        frequent: 1.1,
        irregular: 0.9
      },
      context: {          // Bonus per contesto
        afterCorrect: 1.05,
        afterWrong: 0.95,
        firstOfSession: 1.0,
        endOfSession: 0.95
      }
    }
  };

  /**
   * 🎯 Calcola prossima review con SM-2+
   * @param {Object} card - Flashcard con dati SM2
   * @param {Number} quality - Qualità risposta (0-5)
   * @param {Object} context - Contesto studio (ora, sessione, etc.)
   * @returns {Object} Nuovi parametri SM2
   */
  static calculate(card, quality, context = {}) {
    // Inizializza se prima volta
    const current = card.sm2 || SM2PlusAlgorithm.CONFIG.INITIAL;
    
    // Clone per non mutare originale
    const next = { ...current };
    
    // Timestamp
    next.lastReview = new Date();
    next.reviews = (next.reviews || 0) + 1;
    
    // 1. CASO ERRORE (quality < 3)
    if (quality < 3) {
      next.repetitions = 0;
      next.interval = 1;
      next.lapses = (next.lapses || 0) + 1;
      next.streak = 0;
      
      // Penalità ease factor per errore
      next.easeFactor = Math.max(
        SM2PlusAlgorithm.CONFIG.LIMITS.minEaseFactor,
        next.easeFactor - (0.2 + 0.04 * (2 - quality))
      );
      
      // Se troppi errori, marca come "leech"
      if (next.lapses >= SM2PlusAlgorithm.CONFIG.LIMITS.leechThreshold) {
        next.isLeech = true;
        next.leechDate = new Date();
      }
      
      return next;
    }
    
    // 2. CASO CORRETTO (quality >= 3)
    next.repetitions++;
    next.streak = (next.streak || 0) + 1;
    
    // Calcola nuovo ease factor
    const qualityFactor = SM2PlusAlgorithm.CONFIG.QUALITY_LEVELS[quality].factor;
    next.easeFactor = next.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    
    // Applica limiti
    next.easeFactor = Math.max(
      SM2PlusAlgorithm.CONFIG.LIMITS.minEaseFactor,
      Math.min(SM2PlusAlgorithm.CONFIG.LIMITS.maxEaseFactor, next.easeFactor)
    );
    
    // 3. CALCOLO INTERVALLO con modificatori
    if (next.repetitions === 1) {
      next.interval = 1 * qualityFactor;
    } else if (next.repetitions === 2) {
      next.interval = 6 * qualityFactor;
    } else {
      // Formula SM-2 modificata
      let newInterval = current.interval * next.easeFactor * qualityFactor;
      
      // 4. APPLICA MODIFICATORI CONTESTUALI
      newInterval = SM2PlusAlgorithm.applyModifiers(newInterval, context, next);
      
      // 5. AGGIUNGI FUZZ (±5% randomness per evitare clustering)
      const fuzz = 0.95 + Math.random() * 0.1;
      newInterval = newInterval * fuzz;
      
      next.interval = Math.min(
        Math.round(newInterval),
        SM2PlusAlgorithm.CONFIG.LIMITS.maxInterval
      );
    }
    
    // 6. CALCOLA PROSSIMA DATA REVIEW
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + next.interval);
    next.nextReview = nextDate;
    
    // 7. GRADUATION CHECK
    if (next.interval >= SM2PlusAlgorithm.CONFIG.LIMITS.graduationInterval) {
      next.graduated = true;
      next.graduationDate = new Date();
    }
    
    // 8. STATISTICHE AVANZATE
    next.stats = SM2PlusAlgorithm.calculateStats(next, quality);
    
    return next;
  }

  /**
   * 🎨 Applica modificatori contestuali
   */
  static applyModifiers(interval, context, cardData) {
    let modified = interval;
    
    // Ora del giorno
    if (context.timeOfDay) {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 12) {
        modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.timeOfDay.morning;
      } else if (hour >= 22 || hour < 6) {
        modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.timeOfDay.night;
      }
    }
    
    // Consistency bonus
    if (context.studyStreak) {
      if (context.studyStreak >= 7) {
        modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.consistency.daily;
      } else if (context.studyStreak >= 3) {
        modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.consistency.frequent;
      }
    }
    
    // Context bonus/penalty
    if (context.previousResult === 'correct') {
      modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.context.afterCorrect;
    } else if (context.previousResult === 'wrong') {
      modified *= SM2PlusAlgorithm.CONFIG.MODIFIERS.context.afterWrong;
    }
    
    // Materia difficulty modifier
    if (context.subjectDifficulty) {
      modified *= (1.5 - context.subjectDifficulty * 0.1); // 1.5 to 0.5
    }
    
    return modified;
  }

  /**
   * 📊 Calcola statistiche avanzate
   */
  static calculateStats(cardData, lastQuality) {
    const stats = {
      // Retention rate
      retention: cardData.repetitions > 0 
        ? (cardData.repetitions - cardData.lapses) / cardData.repetitions 
        : 0,
      
      // Difficulty rating (0-1)
      difficulty: 1 - (cardData.easeFactor - 1.3) / (4.0 - 1.3),
      
      // Stability (giorni fino 90% probabilità dimenticare)
      stability: cardData.interval * 1.5,
      
      // Retrievability (probabilità di ricordare ora)
      retrievability: Math.exp(-1 / (cardData.interval || 1)),
      
      // Performance trend
      trend: lastQuality >= 3 ? 'improving' : 'declining',
      
      // Time saved (minuti risparmiati da spaced repetition)
      timeSaved: Math.round(cardData.repetitions * 2 - cardData.lapses * 5),
      
      // Mastery level (0-100)
      mastery: SM2PlusAlgorithm.calculateMastery(cardData)
    };
    
    return stats;
  }

  /**
   * 🏆 Calcola livello mastery (0-100)
   */
  static calculateMastery(cardData) {
    let mastery = 0;
    
    // Base: ease factor (40%)
    mastery += ((cardData.easeFactor - 1.3) / (4.0 - 1.3)) * 40;
    
    // Interval contribution (30%)
    mastery += Math.min(cardData.interval / 30, 1) * 30;
    
    // Streak contribution (20%)
    mastery += Math.min((cardData.streak || 0) / 10, 1) * 20;
    
    // Retention contribution (10%)
    const retention = cardData.repetitions > 0 
      ? (cardData.repetitions - cardData.lapses) / cardData.repetitions 
      : 0;
    mastery += retention * 10;
    
    return Math.round(Math.max(0, Math.min(100, mastery)));
  }

  /**
   * 🔮 Predici performance futura
   */
  static predictPerformance(card, daysAhead = 30) {
    const predictions = [];
    let currentRetention = 1.0;
    
    for (let day = 1; day <= daysAhead; day++) {
      // Formula forgetting curve
      const retention = Math.exp(-day / (card.sm2?.interval || 1));
      
      predictions.push({
        day,
        retention: Math.max(0, retention),
        probability: Math.round(retention * 100),
        recommended: day === (card.sm2?.interval || 1)
      });
    }
    
    return predictions;
  }

  /**
   * 🎯 Ottimizza scheduling per sessione
   */
  static optimizeSession(cards, maxTime = 30) {
    // Ordina per priorità
    const prioritized = cards
      .map(card => ({
        ...card,
        priority: SM2PlusAlgorithm.calculatePriority(card)
      }))
      .sort((a, b) => b.priority - a.priority);
    
    // Seleziona cards per tempo disponibile
    const selected = [];
    let timeUsed = 0;
    
    for (const card of prioritized) {
      const estimatedTime = card.sm2?.stats?.avgTime || 1;
      if (timeUsed + estimatedTime <= maxTime) {
        selected.push(card);
        timeUsed += estimatedTime;
      }
    }
    
    return {
      cards: selected,
      estimatedTime: timeUsed,
      skipped: cards.length - selected.length
    };
  }

  /**
   * 🎨 Calcola priorità card
   */
  static calculatePriority(card) {
    let priority = 0;
    
    // Overdue cards = massima priorità
    if (card.sm2?.nextReview && new Date(card.sm2.nextReview) < new Date()) {
      const daysOverdue = Math.floor((new Date() - new Date(card.sm2.nextReview)) / (1000 * 60 * 60 * 24));
      priority += 100 + daysOverdue * 10;
    }
    
    // Leech cards = alta priorità
    if (card.sm2?.isLeech) {
      priority += 50;
    }
    
    // Low retention = priorità media
    if (card.sm2?.stats?.retention < 0.8) {
      priority += 30;
    }
    
    // New cards = priorità base
    if (!card.sm2 || card.sm2.repetitions === 0) {
      priority += 20;
    }
    
    return priority;
  }

  /**
   * 📈 Analytics per dashboard
   */
  static getAnalytics(cards) {
    const now = new Date();
    
    return {
      total: cards.length,
      due: cards.filter(c => c.sm2?.nextReview && new Date(c.sm2.nextReview) <= now).length,
      new: cards.filter(c => !c.sm2 || c.sm2.repetitions === 0).length,
      learning: cards.filter(c => c.sm2?.repetitions > 0 && !c.sm2?.graduated).length,
      graduated: cards.filter(c => c.sm2?.graduated).length,
      leeches: cards.filter(c => c.sm2?.isLeech).length,
      
      avgEaseFactor: cards
        .filter(c => c.sm2?.easeFactor)
        .reduce((sum, c) => sum + c.sm2.easeFactor, 0) / cards.length || 0,
      
      avgInterval: cards
        .filter(c => c.sm2?.interval)
        .reduce((sum, c) => sum + c.sm2.interval, 0) / cards.length || 0,
      
      retention: cards
        .filter(c => c.sm2?.stats?.retention)
        .reduce((sum, c) => sum + c.sm2.stats.retention, 0) / cards.length || 0,
      
      forecast: {
        tomorrow: cards.filter(c => {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return c.sm2?.nextReview && 
                 new Date(c.sm2.nextReview).toDateString() === tomorrow.toDateString();
        }).length,
        
        week: cards.filter(c => {
          const weekFromNow = new Date(now);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return c.sm2?.nextReview && 
                 new Date(c.sm2.nextReview) <= weekFromNow;
        }).length
      }
    };
  }
}

module.exports = SM2PlusAlgorithm;
