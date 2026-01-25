/**
 * 🔗 MY CONTENTS SHARING SERVICE
 * Gestione condivisione e sincronizzazione contenuti
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class MyContentsSharing {
  constructor() {
    this.config = {
      sharing: {
        enabled: true,
        expirationTime: 7 * 24 * 60 * 60 * 1000, // 7 giorni
        maxShareLinks: 50,
        requirePassword: false,
        allowPublic: true
      },
      sync: {
        enabled: true,
        conflictResolution: 'latest', // latest, manual, merge
        autoSync: true,
        syncInterval: 5 * 60 * 1000 // 5 minuti
      }
    };
    
    this.shareLinks = new Map();
    this.publicContent = new Map();
    this.syncQueue = new Map();
  }

  /**
   * 🔗 Crea Link di Condivisione
   */
  async shareContent(userId, type, contentId, options = {}) {
    if (!this.config.sharing.enabled) {
      throw new Error('Condivisione non abilitata');
    }
    
    const shareId = uuidv4();
    const shortCode = this._generateShortCode();
    const expiration = new Date(Date.now() + (options.duration || this.config.sharing.expirationTime));
    
    const shareLink = {
      id: shareId,
      shortCode,
      userId,
      tipo: type,
      contentId,
      createdAt: new Date().toISOString(),
      expiresAt: expiration.toISOString(),
      accessCount: 0,
      maxAccess: options.maxAccess || null,
      password: options.password ? this._hashPassword(options.password) : null,
      settings: {
        allowCopy: options.allowCopy !== false,
        allowExport: options.allowExport !== false,
        allowEdit: options.allowEdit === true,
        trackViews: options.trackViews !== false
      },
      metadata: {
        titolo: options.titolo || '',
        descrizione: options.descrizione || '',
        tags: options.tags || []
      },
      analytics: {
        views: [],
        uniqueVisitors: new Set(),
        deviceTypes: {},
        referrers: []
      }
    };
    
    this.shareLinks.set(shareId, shareLink);
    
    // Genera URLs
    const baseUrl = process.env.APP_URL || 'https://imparafacile.app';
    const urls = {
      full: `${baseUrl}/share/${shareId}`,
      short: `${baseUrl}/s/${shortCode}`,
      qrCode: `${baseUrl}/api/qr/${shareId}`,
      embed: `${baseUrl}/embed/${shareId}`
    };
    
    return {
      success: true,
      shareId,
      shortCode,
      urls,
      expiresAt: expiration.toISOString(),
      settings: shareLink.settings
    };
  }

  /**
   * 🔓 Accesso a Contenuto Condiviso
   */
  async accessSharedContent(shareIdOrCode, password = null, metadata = {}) {
    // Trova share link
    let shareLink = this.shareLinks.get(shareIdOrCode);
    
    if (!shareLink) {
      // Prova con shortCode
      shareLink = Array.from(this.shareLinks.values())
        .find(sl => sl.shortCode === shareIdOrCode);
    }
    
    if (!shareLink) {
      throw new Error('Link non valido o scaduto');
    }
    
    // Verifica scadenza
    if (new Date(shareLink.expiresAt) < new Date()) {
      this.shareLinks.delete(shareLink.id);
      throw new Error('Link scaduto');
    }
    
    // Verifica password
    if (shareLink.password) {
      if (!password || !this._verifyPassword(password, shareLink.password)) {
        throw new Error('Password non corretta');
      }
    }
    
    // Verifica limite accessi
    if (shareLink.maxAccess && shareLink.accessCount >= shareLink.maxAccess) {
      throw new Error('Limite accessi raggiunto');
    }
    
    // Incrementa contatore e analytics
    shareLink.accessCount++;
    
    if (shareLink.settings.trackViews) {
      shareLink.analytics.views.push({
        timestamp: new Date().toISOString(),
        ip: metadata.ip || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        referrer: metadata.referrer || 'direct'
      });
      
      if (metadata.ip) {
        shareLink.analytics.uniqueVisitors.add(metadata.ip);
      }
      
      if (metadata.deviceType) {
        shareLink.analytics.deviceTypes[metadata.deviceType] = 
          (shareLink.analytics.deviceTypes[metadata.deviceType] || 0) + 1;
      }
    }
    
    return {
      success: true,
      userId: shareLink.userId,
      tipo: shareLink.tipo,
      contentId: shareLink.contentId,
      settings: shareLink.settings,
      metadata: shareLink.metadata,
      remainingAccess: shareLink.maxAccess ? shareLink.maxAccess - shareLink.accessCount : null
    };
  }

  /**
   * 📊 Analytics Condivisione
   */
  getShareAnalytics(userId, shareId) {
    const shareLink = this.shareLinks.get(shareId);
    
    if (!shareLink || shareLink.userId !== userId) {
      throw new Error('Link non trovato o non autorizzato');
    }
    
    return {
      id: shareLink.id,
      shortCode: shareLink.shortCode,
      createdAt: shareLink.createdAt,
      expiresAt: shareLink.expiresAt,
      totalViews: shareLink.accessCount,
      uniqueVisitors: shareLink.analytics.uniqueVisitors.size,
      deviceTypes: shareLink.analytics.deviceTypes,
      recentViews: shareLink.analytics.views.slice(-10),
      isActive: new Date(shareLink.expiresAt) > new Date(),
      remainingDays: Math.ceil((new Date(shareLink.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * 🌍 Pubblica Contenuto
   */
  async publishContent(userId, type, content, options = {}) {
    if (!this.config.sharing.allowPublic) {
      throw new Error('Pubblicazione pubblica non abilitata');
    }
    
    const publicId = uuidv4();
    
    const publicContent = {
      id: publicId,
      userId,
      tipo: type,
      content: this._sanitizeContent(content),
      publishedAt: new Date().toISOString(),
      metadata: {
        titolo: options.titolo || content.nome || content.fronte || 'Contenuto',
        descrizione: options.descrizione || '',
        materia: content.metadata?.materia || '',
        argomento: content.metadata?.argomento || '',
        tags: [...(content.tags || []), ...(options.tags || [])],
        difficolta: content.metadata?.difficolta || content.difficolta || 'intermedio'
      },
      stats: {
        views: 0,
        likes: 0,
        downloads: 0,
        reports: 0,
        rating: 0,
        reviews: []
      },
      settings: {
        allowComments: options.allowComments !== false,
        allowDownload: options.allowDownload !== false,
        allowDerivatives: options.allowDerivatives === true,
        license: options.license || 'CC BY-NC-SA 4.0'
      },
      moderation: {
        status: 'pending', // pending, approved, rejected
        reviewedAt: null,
        reviewedBy: null,
        reason: null
      }
    };
    
    this.publicContent.set(publicId, publicContent);
    
    // Auto-approve se utente verificato (placeholder)
    if (this._isVerifiedUser(userId)) {
      publicContent.moderation.status = 'approved';
      publicContent.moderation.reviewedAt = new Date().toISOString();
      publicContent.moderation.reviewedBy = 'auto';
    }
    
    return {
      success: true,
      publicId,
      url: `${process.env.APP_URL || 'https://imparafacile.app'}/public/${publicId}`,
      status: publicContent.moderation.status
    };
  }

  /**
   * 🔍 Cerca Contenuti Pubblici
   */
  searchPublicContent(query, filters = {}) {
    const results = [];
    
    for (const content of this.publicContent.values()) {
      // Solo contenuti approvati
      if (content.moderation.status !== 'approved') continue;
      
      // Match query
      if (query) {
        const searchText = [
          content.metadata.titolo,
          content.metadata.descrizione,
          ...content.metadata.tags,
          content.metadata.materia,
          content.metadata.argomento
        ].join(' ').toLowerCase();
        
        if (!searchText.includes(query.toLowerCase())) continue;
      }
      
      // Applica filtri
      if (filters.materia && content.metadata.materia !== filters.materia) continue;
      if (filters.difficolta && content.metadata.difficolta !== filters.difficolta) continue;
      if (filters.tipo && content.tipo !== filters.tipo) continue;
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(tag => 
          content.metadata.tags.includes(tag)
        );
        if (!hasAllTags) continue;
      }
      
      results.push({
        id: content.id,
        tipo: content.tipo,
        metadata: content.metadata,
        stats: content.stats,
        publishedAt: content.publishedAt,
        userId: content.userId // In produzione: nascondere o anonimizzare
      });
    }
    
    // Ordina per popolarità o data
    if (filters.orderBy === 'popular') {
      results.sort((a, b) => b.stats.views - a.stats.views);
    } else if (filters.orderBy === 'rating') {
      results.sort((a, b) => b.stats.rating - a.stats.rating);
    } else {
      results.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    }
    
    // Paginazione
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      results: results.slice(start, end),
      total: results.length,
      page,
      totalPages: Math.ceil(results.length / limit)
    };
  }

  /**
   * 🔄 Sincronizzazione Contenuti
   */
  async syncContent(userId, localData, remoteData) {
    console.log(`🔄 Sincronizzazione per utente ${userId}`);
    
    const syncResult = {
      merged: {
        quiz: [],
        flashcards: [],
        mappe: []
      },
      conflicts: [],
      uploaded: 0,
      downloaded: 0
    };
    
    // Strategia di sync basata su timestamp e versione
    for (const type of ['quiz', 'flashcards', 'mappe']) {
      const localItems = localData[type] || [];
      const remoteItems = remoteData[type] || [];
      
      const localMap = new Map(localItems.map(item => [item.id, item]));
      const remoteMap = new Map(remoteItems.map(item => [item.id, item]));
      
      // Merge items
      for (const [id, remoteItem] of remoteMap) {
        const localItem = localMap.get(id);
        
        if (!localItem) {
          // Nuovo da remoto
          syncResult.merged[type].push(remoteItem);
          syncResult.downloaded++;
        } else {
          // Confronta versioni
          const resolution = this._resolveConflict(localItem, remoteItem);
          
          if (resolution.hasConflict) {
            syncResult.conflicts.push({
              tipo: type,
              id,
              locale: localItem,
              remoto: remoteItem,
              suggestedResolution: resolution.suggested
            });
          }
          
          syncResult.merged[type].push(resolution.merged);
          localMap.delete(id);
        }
      }
      
      // Aggiungi items solo locali
      for (const localItem of localMap.values()) {
        syncResult.merged[type].push(localItem);
        syncResult.uploaded++;
      }
    }
    
    // Gestione conflitti automatica se configurato
    if (this.config.sync.conflictResolution === 'latest') {
      syncResult.conflicts = [];
    }
    
    return syncResult;
  }

  /**
   * 📱 Sync Status
   */
  getSyncStatus(userId) {
    const queue = this.syncQueue.get(userId);
    
    if (!queue) {
      return {
        inSync: true,
        lastSync: null,
        pendingChanges: 0,
        nextSync: null
      };
    }
    
    return {
      inSync: queue.pendingChanges === 0,
      lastSync: queue.lastSync,
      pendingChanges: queue.pendingChanges,
      nextSync: queue.nextSync,
      errors: queue.errors || []
    };
  }

  /**
   * 🔐 Hash Password
   */
  _hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * ✅ Verify Password
   */
  _verifyPassword(password, hash) {
    return this._hashPassword(password) === hash;
  }

  /**
   * 🔤 Generate Short Code
   */
  _generateShortCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 🧹 Sanitize Content
   */
  _sanitizeContent(content) {
    // Rimuovi informazioni sensibili
    const sanitized = { ...content };
    delete sanitized.userId;
    delete sanitized.statistiche;
    delete sanitized.riferimentoOriginale;
    return sanitized;
  }

  /**
   * ✅ Is Verified User
   */
  _isVerifiedUser(userId) {
    // Placeholder: in produzione controllare verifica email/account
    return true;
  }

  /**
   * 🤝 Resolve Conflict
   */
  _resolveConflict(localItem, remoteItem) {
    const localTime = new Date(localItem.updatedAt || localItem.createdAt);
    const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt);
    
    if (localItem.versione === remoteItem.versione && 
        localTime.getTime() === remoteTime.getTime()) {
      // Stesso contenuto
      return {
        hasConflict: false,
        merged: localItem
      };
    }
    
    if (this.config.sync.conflictResolution === 'latest') {
      return {
        hasConflict: false,
        merged: localTime > remoteTime ? localItem : remoteItem
      };
    }
    
    if (this.config.sync.conflictResolution === 'merge') {
      // Merge automatico se possibile
      const merged = {
        ...localItem,
        ...remoteItem,
        id: localItem.id,
        versione: Math.max(localItem.versione || 1, remoteItem.versione || 1) + 1,
        updatedAt: new Date().toISOString(),
        mergedFrom: [localItem.versione, remoteItem.versione]
      };
      
      return {
        hasConflict: false,
        merged
      };
    }
    
    // Manual resolution required
    return {
      hasConflict: true,
      suggested: localTime > remoteTime ? 'local' : 'remote',
      merged: localTime > remoteTime ? localItem : remoteItem
    };
  }

  /**
   * 🧹 Cleanup Expired
   */
  cleanup() {
    const now = new Date();
    
    // Rimuovi share links scaduti
    for (const [id, link] of this.shareLinks.entries()) {
      if (new Date(link.expiresAt) < now) {
        this.shareLinks.delete(id);
      }
    }
    
    console.log(`🧹 Pulizia completata: ${this.shareLinks.size} links attivi`);
  }

  /**
   * 📊 Get Statistics
   */
  getStatistics() {
    return {
      totalShareLinks: this.shareLinks.size,
      activeLinks: Array.from(this.shareLinks.values())
        .filter(l => new Date(l.expiresAt) > new Date()).length,
      totalPublicContent: this.publicContent.size,
      approvedContent: Array.from(this.publicContent.values())
        .filter(c => c.moderation.status === 'approved').length,
      pendingSyncs: this.syncQueue.size
    };
  }
}

module.exports = MyContentsSharing;
