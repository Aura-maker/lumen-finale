/**
 * 📚 MY CONTENTS SERVICE - COMPLETO
 * Integrazione di tutti i moduli per la gestione contenuti utente
 */

const MyContentsBase = require('./my-contents-base');
const MyContentsExport = require('./my-contents-export');
const MyContentsSharing = require('./my-contents-sharing');

class MyContentsService {
  constructor() {
    // Inizializza moduli
    this.base = new MyContentsBase();
    this.export = new MyContentsExport();
    this.sharing = new MyContentsSharing();
    
    console.log('✅ My Contents Service completo inizializzato');
  }

  // === BASE METHODS ===
  async getUserProfile(userId) {
    return await this.base.getUserProfile(userId);
  }

  async saveContent(userId, type, content, options = {}) {
    return await this.base.saveContent(userId, type, content, options);
  }

  async updateContent(userId, type, contentId, updates) {
    return await this.base.updateContent(userId, type, contentId, updates);
  }

  async deleteContent(userId, type, contentId) {
    return await this.base.deleteContent(userId, type, contentId);
  }

  async createCollection(userId, name, description = '') {
    return await this.base.createCollection(userId, name, description);
  }

  async addToCollection(userId, collectionName, type, contentId) {
    return await this.base.addToCollection(userId, collectionName, type, contentId);
  }

  async searchContents(userId, query, filters = {}) {
    return await this.base.searchContents(userId, query, filters);
  }

  async getUserStats(userId) {
    return await this.base.getUserStats(userId);
  }

  // === EXPORT METHODS ===
  async exportContents(userId, format, options = {}) {
    const profile = await this.base.getUserProfile(userId);
    
    // Prepara contenuti per export
    const contents = {
      quiz: profile.quiz,
      flashcards: profile.flashcards,
      mappe: profile.mappe
    };
    
    // Filtra se richiesto
    if (options.tipo) {
      contents.quiz = options.tipo === 'quiz' ? contents.quiz : [];
      contents.flashcards = options.tipo === 'flashcard' ? contents.flashcards : [];
      contents.mappe = options.tipo === 'mappa' ? contents.mappe : [];
    }
    
    if (options.collezione && profile.collections[options.collezione]) {
      const collection = profile.collections[options.collezione];
      const ids = collection.elementi.map(el => el.id);
      contents.quiz = contents.quiz.filter(q => ids.includes(q.id));
      contents.flashcards = contents.flashcards.filter(f => ids.includes(f.id));
      contents.mappe = contents.mappe.filter(m => ids.includes(m.id));
    }
    
    return await this.export.exportContents(contents, format, options);
  }

  // === SHARING METHODS ===
  async shareContent(userId, type, contentId, options = {}) {
    // Verifica che il contenuto appartenga all'utente
    const profile = await this.base.getUserProfile(userId);
    
    let content;
    switch (type) {
      case 'quiz':
        content = profile.quiz.find(q => q.id === contentId);
        break;
      case 'flashcard':
        content = profile.flashcards.find(f => f.id === contentId);
        break;
      case 'mappa':
        content = profile.mappe.find(m => m.id === contentId);
        break;
    }
    
    if (!content) {
      throw new Error('Contenuto non trovato');
    }
    
    // Aggiungi metadata dal contenuto
    options.titolo = options.titolo || content.nome || content.fronte || content.domanda || 'Contenuto';
    options.tags = options.tags || content.tags || [];
    
    return await this.sharing.shareContent(userId, type, contentId, options);
  }

  async accessSharedContent(shareIdOrCode, password = null, metadata = {}) {
    const shareInfo = await this.sharing.accessSharedContent(shareIdOrCode, password, metadata);
    
    if (shareInfo.success) {
      // Recupera il contenuto effettivo
      const profile = await this.base.getUserProfile(shareInfo.userId);
      
      let content;
      switch (shareInfo.tipo) {
        case 'quiz':
          content = profile.quiz.find(q => q.id === shareInfo.contentId);
          break;
        case 'flashcard':
          content = profile.flashcards.find(f => f.id === shareInfo.contentId);
          break;
        case 'mappa':
          content = profile.mappe.find(m => m.id === shareInfo.contentId);
          break;
      }
      
      if (!content) {
        throw new Error('Contenuto non disponibile');
      }
      
      // Applica restrizioni in base alle impostazioni
      if (!shareInfo.settings.allowCopy) {
        delete content.id;
        content.protected = true;
      }
      
      return {
        success: true,
        content,
        settings: shareInfo.settings,
        metadata: shareInfo.metadata
      };
    }
    
    return shareInfo;
  }

  async publishContent(userId, type, contentId, options = {}) {
    const profile = await this.base.getUserProfile(userId);
    
    let content;
    switch (type) {
      case 'quiz':
        content = profile.quiz.find(q => q.id === contentId);
        break;
      case 'flashcard':
        content = profile.flashcards.find(f => f.id === contentId);
        break;
      case 'mappa':
        content = profile.mappe.find(m => m.id === contentId);
        break;
    }
    
    if (!content) {
      throw new Error('Contenuto non trovato');
    }
    
    return await this.sharing.publishContent(userId, type, content, options);
  }

  async searchPublicContent(query, filters = {}) {
    return await this.sharing.searchPublicContent(query, filters);
  }

  async syncContent(userId, remoteData) {
    const profile = await this.base.getUserProfile(userId);
    
    const localData = {
      quiz: profile.quiz,
      flashcards: profile.flashcards,
      mappe: profile.mappe
    };
    
    const syncResult = await this.sharing.syncContent(userId, localData, remoteData);
    
    // Applica merge al profilo
    if (syncResult.merged) {
      profile.quiz = syncResult.merged.quiz;
      profile.flashcards = syncResult.merged.flashcards;
      profile.mappe = syncResult.merged.mappe;
      
      await this.base._saveUserProfile(userId, profile);
    }
    
    return syncResult;
  }

  // === BATCH OPERATIONS ===
  async batchSaveContents(userId, contents) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const item of contents) {
      try {
        const result = await this.saveContent(userId, item.type, item.content, item.options);
        results.success.push(result);
      } catch (error) {
        results.failed.push({
          item,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async batchDeleteContents(userId, items) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const item of items) {
      try {
        const result = await this.deleteContent(userId, item.type, item.id);
        results.success.push(result);
      } catch (error) {
        results.failed.push({
          item,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // === IMPORT OPERATIONS ===
  async importFromAnki(userId, ankiData, options = {}) {
    const flashcards = [];
    
    // Parse Anki data
    const cards = typeof ankiData === 'string' 
      ? this._parseAnkiText(ankiData)
      : ankiData;
    
    for (const card of cards) {
      const flashcard = {
        fronte: card.front || card.Front || card.fields?.Front || '',
        retro: {
          testo: card.back || card.Back || card.fields?.Back || '',
          formula: null,
          esempio: null
        },
        tags: card.tags || [],
        metadata: {
          materia: options.materia || 'Importato',
          argomento: options.argomento || 'Anki Import',
          difficolta: 'intermedio'
        },
        origine: 'anki-import'
      };
      
      const result = await this.saveContent(userId, 'flashcard', flashcard);
      if (result.success) {
        flashcards.push(result.content);
      }
    }
    
    return {
      success: true,
      imported: flashcards.length,
      flashcards
    };
  }

  async importFromCSV(userId, csvData, options = {}) {
    const lines = csvData.split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const contents = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const item = {};
      
      header.forEach((h, idx) => {
        item[h.toLowerCase()] = values[idx] || '';
      });
      
      // Determina tipo e crea contenuto
      const tipo = item.tipo || options.defaultType || 'flashcard';
      let content;
      
      if (tipo === 'quiz') {
        content = {
          domanda: item.domanda || item.question || item.titolo || '',
          opzioni: item.opzioni ? item.opzioni.split(';') : [],
          rispostaCorretta: parseInt(item.risposta) || 0,
          spiegazione: item.spiegazione || '',
          metadata: {
            materia: item.materia || options.materia || 'Importato',
            argomento: item.argomento || '',
            difficolta: item.difficolta || 'intermedio'
          }
        };
      } else if (tipo === 'flashcard') {
        content = {
          fronte: item.fronte || item.front || item.domanda || item.titolo || '',
          retro: {
            testo: item.retro || item.back || item.risposta || ''
          },
          metadata: {
            materia: item.materia || options.materia || 'Importato',
            argomento: item.argomento || '',
            difficolta: item.difficolta || 'intermedio'
          }
        };
      }
      
      if (content) {
        const result = await this.saveContent(userId, tipo, content);
        if (result.success) {
          contents.push(result.content);
        }
      }
    }
    
    return {
      success: true,
      imported: contents.length,
      contents
    };
  }

  // === STATISTICS & ANALYTICS ===
  async getDetailedStats(userId) {
    const baseStats = await this.getUserStats(userId);
    const shareStats = this.sharing.getStatistics();
    
    return {
      ...baseStats,
      sharing: {
        activeShareLinks: shareStats.activeLinks,
        totalShares: shareStats.totalShareLinks,
        publicContents: shareStats.approvedContent
      },
      learning: {
        studyStreak: this._calculateStudyStreak(baseStats.contenutoRecente),
        masteryLevel: this._calculateMasteryLevel(baseStats),
        weeklyGoalProgress: this._calculateWeeklyGoal(baseStats)
      }
    };
  }

  async getContentAnalytics(userId, contentId, type) {
    const profile = await this.getUserProfile(userId);
    
    let content;
    switch (type) {
      case 'quiz':
        content = profile.quiz.find(q => q.id === contentId);
        break;
      case 'flashcard':
        content = profile.flashcards.find(f => f.id === contentId);
        break;
      case 'mappa':
        content = profile.mappe.find(m => m.id === contentId);
        break;
    }
    
    if (!content) {
      throw new Error('Contenuto non trovato');
    }
    
    return {
      id: content.id,
      tipo: type,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      statistiche: content.statistiche,
      performance: {
        successRate: content.statistiche?.successRate || 0,
        avgTime: content.statistiche?.tempoMedio || 0,
        totalAttempts: content.statistiche?.tentativi || 0
      },
      engagement: {
        views: content.statistiche?.visualizzazioni || 0,
        lastAccessed: content.statistiche?.ultimoAccesso,
        collections: content.collezioni?.length || 0
      }
    };
  }

  // === HELPER METHODS ===
  _parseAnkiText(text) {
    const lines = text.split('\n');
    return lines.map(line => {
      const parts = line.split('\t');
      return {
        front: parts[0] || '',
        back: parts[1] || '',
        tags: parts[2] ? parts[2].split(' ') : []
      };
    });
  }

  _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  _calculateStudyStreak(recentContent) {
    if (!recentContent || recentContent.length === 0) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    while (true) {
      const dayContent = recentContent.filter(c => {
        const contentDate = new Date(c.updatedAt);
        contentDate.setHours(0, 0, 0, 0);
        return contentDate.getTime() === currentDate.getTime();
      });
      
      if (dayContent.length === 0) break;
      
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }

  _calculateMasteryLevel(stats) {
    const factors = {
      contentCreated: (stats.totaleQuiz + stats.totaleFlashcards + stats.totaleMappe) / 100,
      collections: stats.collezioni / 10,
      performance: stats.performance?.accuratezza / 100 || 0
    };
    
    const level = Math.floor(
      (factors.contentCreated * 0.3 + 
       factors.collections * 0.2 + 
       factors.performance * 0.5) * 10
    );
    
    return Math.min(level, 10);
  }

  _calculateWeeklyGoal(stats) {
    // Goal: 50 items studied per week
    const weeklyGoal = 50;
    const weeklyStudied = stats.progressoSettimanale 
      ? Object.values(stats.progressoSettimanale).reduce((a, b) => a + b, 0)
      : 0;
    
    return {
      current: weeklyStudied,
      goal: weeklyGoal,
      percentage: Math.min(Math.round((weeklyStudied / weeklyGoal) * 100), 100)
    };
  }

  // === CLEANUP ===
  cleanup() {
    this.sharing.cleanup();
  }
}

module.exports = new MyContentsService();
