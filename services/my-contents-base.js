/**
 * 📚 MY CONTENTS BASE SERVICE
 * Gestione base dei contenuti utente
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MyContentsBase {
  constructor() {
    this.config = {
      storage: {
        basePath: path.join(__dirname, '../data/user-contents'),
        maxSizePerUser: 100 * 1024 * 1024, // 100MB
        autoBackup: true,
        backupInterval: 24 * 60 * 60 * 1000
      },
      collections: {
        maxCollectionsPerUser: 100,
        maxItemsPerCollection: 1000,
        defaultCollections: ['Preferiti', 'Da Ripassare', 'Completati', 'Difficili']
      },
      versioning: {
        enabled: true,
        maxVersions: 10,
        autoSave: true
      }
    };

    this.userContents = new Map();
    this.versions = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      await fs.mkdir(this.config.storage.basePath, { recursive: true });
      await this._loadExistingContents();
      if (this.config.storage.autoBackup) {
        this._startAutoBackup();
      }
      console.log('✅ My Contents Base Service inizializzato');
    } catch (error) {
      console.error('❌ Errore inizializzazione:', error);
    }
  }

  /**
   * 👤 Profilo Utente
   */
  async getUserProfile(userId) {
    if (!this.userContents.has(userId)) {
      const profile = {
        id: userId,
        createdAt: new Date().toISOString(),
        collections: {},
        quiz: [],
        flashcards: [],
        mappe: [],
        stats: {
          totaleQuiz: 0,
          totaleFlashcards: 0,
          totaleMappe: 0,
          spazioUsato: 0,
          tempoStudio: 0,
          punteggio: 0,
          livello: 1,
          badges: []
        },
        settings: {
          defaultCollection: 'Preferiti',
          exportFormat: 'json',
          autoSync: true,
          darkMode: false,
          notifiche: true,
          lingua: 'it'
        },
        achievements: []
      };
      
      // Crea collezioni default
      for (const collName of this.config.collections.defaultCollections) {
        profile.collections[collName] = {
          id: uuidv4(),
          nome: collName,
          tipo: 'default',
          elementi: [],
          createdAt: new Date().toISOString()
        };
      }
      
      this.userContents.set(userId, profile);
      await this._saveUserProfile(userId, profile);
    }
    
    return this.userContents.get(userId);
  }

  /**
   * ➕ Salva Contenuto
   */
  async saveContent(userId, type, content, options = {}) {
    console.log(`💾 Salvataggio ${type} per utente ${userId}`);
    
    try {
      const profile = await this.getUserProfile(userId);
      
      const enrichedContent = {
        ...content,
        id: content.id || uuidv4(),
        userId,
        tipo: type,
        origine: options.origine || 'manuale',
        riferimentoOriginale: options.riferimento || null,
        createdAt: content.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versione: 1,
        tags: content.tags || [],
        collezioni: options.collezioni || ['Preferiti'],
        condiviso: false,
        statistiche: {
          visualizzazioni: 0,
          tentativi: 0,
          successRate: 0,
          ultimoAccesso: null,
          tempoMedio: 0
        },
        metadata: {
          materia: content.materia || '',
          argomento: content.argomento || '',
          sottoargomento: content.sottoargomento || '',
          difficolta: content.difficolta || 'intermedio',
          tempoStimato: content.tempoStimato || 60
        }
      };
      
      // Aggiungi a profilo
      switch (type) {
        case 'quiz':
          profile.quiz.push(enrichedContent);
          profile.stats.totaleQuiz++;
          break;
        case 'flashcard':
          profile.flashcards.push(enrichedContent);
          profile.stats.totaleFlashcards++;
          break;
        case 'mappa':
          profile.mappe.push(enrichedContent);
          profile.stats.totaleMappe++;
          break;
      }
      
      // Aggiungi a collezioni
      for (const collName of enrichedContent.collezioni) {
        if (!profile.collections[collName]) {
          profile.collections[collName] = {
            id: uuidv4(),
            nome: collName,
            tipo: 'custom',
            elementi: [],
            createdAt: new Date().toISOString()
          };
        }
        
        profile.collections[collName].elementi.push({
          tipo: type,
          id: enrichedContent.id,
          aggiunto: new Date().toISOString()
        });
      }
      
      // Versioning
      if (this.config.versioning.enabled) {
        await this._saveVersion(userId, enrichedContent);
      }
      
      // Check achievements
      await this._checkAchievements(userId, profile);
      
      // Salva
      await this._saveUserProfile(userId, profile);
      
      console.log(`✅ ${type} salvato: ${enrichedContent.id}`);
      
      return {
        success: true,
        id: enrichedContent.id,
        content: enrichedContent
      };
      
    } catch (error) {
      console.error(`❌ Errore salvataggio:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📝 Modifica Contenuto
   */
  async updateContent(userId, type, contentId, updates) {
    console.log(`📝 Modifica ${type} ${contentId}`);
    
    try {
      const profile = await this.getUserProfile(userId);
      
      let contentArray;
      switch (type) {
        case 'quiz': contentArray = profile.quiz; break;
        case 'flashcard': contentArray = profile.flashcards; break;
        case 'mappa': contentArray = profile.mappe; break;
        default: throw new Error(`Tipo non supportato: ${type}`);
      }
      
      const contentIndex = contentArray.findIndex(c => c.id === contentId);
      if (contentIndex === -1) {
        throw new Error('Contenuto non trovato');
      }
      
      // Salva versione precedente
      if (this.config.versioning.enabled) {
        await this._saveVersion(userId, contentArray[contentIndex]);
      }
      
      // Applica modifiche
      const updatedContent = {
        ...contentArray[contentIndex],
        ...updates,
        id: contentId,
        updatedAt: new Date().toISOString(),
        versione: (contentArray[contentIndex].versione || 1) + 1
      };
      
      contentArray[contentIndex] = updatedContent;
      
      await this._saveUserProfile(userId, profile);
      
      return {
        success: true,
        content: updatedContent
      };
      
    } catch (error) {
      console.error('❌ Errore modifica:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🗑️ Elimina Contenuto
   */
  async deleteContent(userId, type, contentId) {
    console.log(`🗑️ Eliminazione ${type} ${contentId}`);
    
    try {
      const profile = await this.getUserProfile(userId);
      
      let contentArray;
      switch (type) {
        case 'quiz': contentArray = profile.quiz; break;
        case 'flashcard': contentArray = profile.flashcards; break;
        case 'mappa': contentArray = profile.mappe; break;
        default: throw new Error(`Tipo non supportato`);
      }
      
      const index = contentArray.findIndex(c => c.id === contentId);
      if (index === -1) {
        throw new Error('Contenuto non trovato');
      }
      
      const deleted = contentArray.splice(index, 1)[0];
      
      // Rimuovi da collezioni
      for (const coll of Object.values(profile.collections)) {
        coll.elementi = coll.elementi.filter(el => el.id !== contentId);
      }
      
      // Aggiorna stats
      switch (type) {
        case 'quiz': profile.stats.totaleQuiz--; break;
        case 'flashcard': profile.stats.totaleFlashcards--; break;
        case 'mappa': profile.stats.totaleMappe--; break;
      }
      
      await this._saveUserProfile(userId, profile);
      
      return {
        success: true,
        deleted
      };
      
    } catch (error) {
      console.error('❌ Errore eliminazione:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📚 Gestione Collezioni
   */
  async createCollection(userId, name, description = '') {
    const profile = await this.getUserProfile(userId);
    
    if (profile.collections[name]) {
      throw new Error('Collezione già esistente');
    }
    
    if (Object.keys(profile.collections).length >= this.config.collections.maxCollectionsPerUser) {
      throw new Error('Limite collezioni raggiunto');
    }
    
    profile.collections[name] = {
      id: uuidv4(),
      nome: name,
      descrizione: description,
      tipo: 'custom',
      elementi: [],
      createdAt: new Date().toISOString(),
      colore: this._randomColor(),
      icona: '📚'
    };
    
    await this._saveUserProfile(userId, profile);
    
    return profile.collections[name];
  }

  async addToCollection(userId, collectionName, type, contentId) {
    const profile = await this.getUserProfile(userId);
    
    if (!profile.collections[collectionName]) {
      await this.createCollection(userId, collectionName);
    }
    
    const collection = profile.collections[collectionName];
    
    if (collection.elementi.some(el => el.id === contentId)) {
      return { success: true, message: 'Già presente' };
    }
    
    if (collection.elementi.length >= this.config.collections.maxItemsPerCollection) {
      throw new Error('Limite elementi raggiunto');
    }
    
    collection.elementi.push({
      tipo: type,
      id: contentId,
      aggiunto: new Date().toISOString()
    });
    
    await this._saveUserProfile(userId, profile);
    
    return { success: true };
  }

  /**
   * 🔍 Ricerca Contenuti
   */
  async searchContents(userId, query, filters = {}) {
    const profile = await this.getUserProfile(userId);
    const results = {
      quiz: [],
      flashcards: [],
      mappe: []
    };
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    const matchesSearch = (content) => {
      const searchableText = [
        content.domanda || content.fronte || content.nome || '',
        content.spiegazione || content.descrizione || '',
        ...(content.tags || []),
        content.metadata?.materia || '',
        content.metadata?.argomento || ''
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    };
    
    // Ricerca quiz
    if (!filters.tipo || filters.tipo === 'quiz') {
      results.quiz = profile.quiz.filter(q => {
        if (!matchesSearch(q)) return false;
        if (filters.materia && q.metadata?.materia !== filters.materia) return false;
        if (filters.difficolta && q.metadata?.difficolta !== filters.difficolta) return false;
        if (filters.collezione && !q.collezioni.includes(filters.collezione)) return false;
        return true;
      });
    }
    
    // Ricerca flashcards
    if (!filters.tipo || filters.tipo === 'flashcard') {
      results.flashcards = profile.flashcards.filter(f => {
        if (!matchesSearch(f)) return false;
        if (filters.materia && f.metadata?.materia !== filters.materia) return false;
        if (filters.difficolta && f.metadata?.difficolta !== filters.difficolta) return false;
        if (filters.collezione && !f.collezioni.includes(filters.collezione)) return false;
        if (filters.daRipassare) {
          const now = new Date();
          if (!f.sm2?.nextReview || new Date(f.sm2.nextReview) > now) return false;
        }
        return true;
      });
    }
    
    // Ricerca mappe
    if (!filters.tipo || filters.tipo === 'mappa') {
      results.mappe = profile.mappe.filter(m => {
        if (!matchesSearch(m)) return false;
        if (filters.materia && m.metadata?.materia !== filters.materia) return false;
        if (filters.collezione && !m.collezioni.includes(filters.collezione)) return false;
        return true;
      });
    }
    
    return results;
  }

  /**
   * 📊 Statistiche Utente
   */
  async getUserStats(userId) {
    const profile = await this.getUserProfile(userId);
    
    const stats = {
      ...profile.stats,
      collezioni: Object.keys(profile.collections).length,
      elementiPerCollezione: {},
      contenutoRecente: [],
      progressoSettimanale: this._calculateWeeklyProgress(profile),
      spazioUsato: JSON.stringify(profile).length,
      prossimRipassi: this._getNextReviews(profile),
      performance: this._calculatePerformance(profile)
    };
    
    // Elementi per collezione
    for (const [nome, coll] of Object.entries(profile.collections)) {
      stats.elementiPerCollezione[nome] = coll.elementi.length;
    }
    
    // Contenuto recente
    const allContent = [
      ...profile.quiz.map(q => ({ ...q, tipo: 'quiz' })),
      ...profile.flashcards.map(f => ({ ...f, tipo: 'flashcard' })),
      ...profile.mappe.map(m => ({ ...m, tipo: 'mappa' }))
    ];
    
    stats.contenutoRecente = allContent
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10);
    
    return stats;
  }

  /**
   * 🏆 Check Achievements
   */
  async _checkAchievements(userId, profile) {
    const achievements = [];
    
    // Prima flashcard
    if (profile.stats.totaleFlashcards === 1) {
      achievements.push({
        id: 'first_flashcard',
        nome: 'Prima Flashcard',
        descrizione: 'Hai creato la tua prima flashcard!',
        icona: '🎉',
        unlockedAt: new Date().toISOString()
      });
    }
    
    // 100 quiz
    if (profile.stats.totaleQuiz === 100) {
      achievements.push({
        id: 'quiz_master',
        nome: 'Quiz Master',
        descrizione: '100 quiz completati!',
        icona: '🏅',
        unlockedAt: new Date().toISOString()
      });
    }
    
    // Aggiungi achievements nuovi
    for (const achievement of achievements) {
      if (!profile.achievements.some(a => a.id === achievement.id)) {
        profile.achievements.push(achievement);
        profile.stats.badges.push(achievement.icona);
      }
    }
    
    return achievements;
  }

  /**
   * 📈 Calculate Weekly Progress
   */
  _calculateWeeklyProgress(profile) {
    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const progress = {};
    
    weekDays.forEach(day => {
      progress[day] = Math.floor(Math.random() * 100); // Placeholder
    });
    
    return progress;
  }

  /**
   * ⏰ Get Next Reviews
   */
  _getNextReviews(profile) {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return profile.flashcards
      .filter(f => f.sm2?.nextReview && new Date(f.sm2.nextReview) <= next24h)
      .sort((a, b) => new Date(a.sm2.nextReview) - new Date(b.sm2.nextReview))
      .slice(0, 10);
  }

  /**
   * 📊 Calculate Performance
   */
  _calculatePerformance(profile) {
    const totalAttempts = profile.quiz.reduce((sum, q) => sum + (q.statistiche?.tentativi || 0), 0);
    const totalSuccess = profile.quiz.reduce((sum, q) => 
      sum + Math.floor((q.statistiche?.tentativi || 0) * (q.statistiche?.successRate || 0) / 100), 0);
    
    return {
      accuratezza: totalAttempts > 0 ? Math.round(totalSuccess / totalAttempts * 100) : 0,
      velocitaMedia: 85, // Placeholder
      difficoltaMedia: 'intermedio'
    };
  }

  /**
   * 🎨 Random Color
   */
  _randomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FFB6C1', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 💾 Save User Profile
   */
  async _saveUserProfile(userId, profile) {
    const userDir = path.join(this.config.storage.basePath, userId);
    await fs.mkdir(userDir, { recursive: true });
    
    const profilePath = path.join(userDir, 'profile.json');
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
    
    this.userContents.set(userId, profile);
  }

  /**
   * 📂 Load Existing Contents
   */
  async _loadExistingContents() {
    try {
      const userDirs = await fs.readdir(this.config.storage.basePath);
      
      for (const userId of userDirs) {
        const profilePath = path.join(this.config.storage.basePath, userId, 'profile.json');
        
        try {
          const data = await fs.readFile(profilePath, 'utf-8');
          const profile = JSON.parse(data);
          this.userContents.set(userId, profile);
          console.log(`📂 Caricato profilo ${userId}`);
        } catch (error) {
          console.warn(`⚠️ Errore caricamento ${userId}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Nessun contenuto esistente');
    }
  }

  /**
   * 📦 Save Version
   */
  async _saveVersion(userId, content) {
    const versionKey = `${userId}-${content.id}`;
    
    if (!this.versions.has(versionKey)) {
      this.versions.set(versionKey, []);
    }
    
    const versions = this.versions.get(versionKey);
    
    if (versions.length >= this.config.versioning.maxVersions) {
      versions.shift();
    }
    
    versions.push({
      content: { ...content },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔄 Auto Backup
   */
  _startAutoBackup() {
    setInterval(async () => {
      console.log('🔄 Backup automatico...');
      
      for (const [userId, profile] of this.userContents.entries()) {
        try {
          const backupDir = path.join(this.config.storage.basePath, userId, 'backups');
          await fs.mkdir(backupDir, { recursive: true });
          
          const backupFile = path.join(backupDir, `backup_${Date.now()}.json`);
          await fs.writeFile(backupFile, JSON.stringify(profile, null, 2));
          
          // Mantieni solo ultimi 7 backup
          const backups = await fs.readdir(backupDir);
          if (backups.length > 7) {
            const oldestBackup = backups.sort()[0];
            await fs.unlink(path.join(backupDir, oldestBackup));
          }
        } catch (error) {
          console.error(`❌ Errore backup ${userId}`);
        }
      }
      
      console.log('✅ Backup completato');
    }, this.config.storage.backupInterval);
  }
}

module.exports = MyContentsBase;
