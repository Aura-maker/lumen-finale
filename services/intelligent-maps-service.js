/**
 * 🗺️ INTELLIGENT MAPS SERVICE - COMPLETO
 * Sistema completo di mappe intelligenti stile AlgorEducation++
 */

const IntelligentMapsExtended = require('./intelligent-maps-extended');

class IntelligentMapsService extends IntelligentMapsExtended {
  constructor() {
    super();
    console.log('✅ Intelligent Maps Service completo inizializzato');
  }

  /**
   * 📊 GET MAP STATISTICS
   */
  async getMapStatistics(mapId) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    return {
      id: mapId,
      nome: map.nome,
      createdAt: map.createdAt,
      updatedAt: map.updatedAt,
      statistics: map.statistics,
      usage: {
        totalUsers: this._countMapUsers(mapId),
        avgProgress: this._calculateAvgProgress(mapId),
        completionRate: this._calculateCompletionRate(mapId)
      },
      quality: {
        contentQuality: this._assessContentQuality(map),
        structureQuality: this._assessStructureQuality(map),
        resourceQuality: this._assessResourceQuality(map)
      }
    };
  }

  /**
   * 🔍 GET ALL MAPS
   */
  getAllMaps(filters = {}) {
    let maps = Array.from(this.maps.values());
    
    // Applica filtri
    if (filters.materia) {
      maps = maps.filter(m => m.metadata.materia === filters.materia);
    }
    if (filters.pubbliche) {
      maps = maps.filter(m => m.settings.public === true);
    }
    if (filters.collaborative) {
      maps = maps.filter(m => m.settings.collaborative === true);
    }
    
    // Ordina
    if (filters.orderBy === 'recent') {
      maps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (filters.orderBy === 'popular') {
      maps.sort((a, b) => this._countMapUsers(b.id) - this._countMapUsers(a.id));
    }
    
    // Paginazione
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      maps: maps.slice(start, end).map(m => ({
        id: m.id,
        nome: m.nome,
        descrizione: m.descrizione,
        metadata: m.metadata,
        statistics: m.statistics,
        settings: m.settings
      })),
      total: maps.length,
      page,
      totalPages: Math.ceil(maps.length / limit)
    };
  }

  /**
   * 🔄 CLONE MAP
   */
  async cloneMap(mapId, options = {}) {
    const originalMap = this.maps.get(mapId);
    if (!originalMap) {
      throw new Error('Mappa originale non trovata');
    }
    
    const clonedMap = {
      ...JSON.parse(JSON.stringify(originalMap)),
      id: uuidv4(),
      nome: options.nome || `${originalMap.nome} (Copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        ...originalMap.settings,
        public: false,
        collaborative: false
      }
    };
    
    // Rigenera ID per tutti gli elementi
    clonedMap.graph.nodes.forEach(node => {
      node.id = uuidv4();
    });
    
    clonedMap.graph.edges.forEach(edge => {
      edge.id = uuidv4();
    });
    
    clonedMap.learningPaths.forEach(path => {
      path.id = uuidv4();
    });
    
    this.maps.set(clonedMap.id, clonedMap);
    
    return clonedMap;
  }

  /**
   * 🎨 APPLY TEMPLATE
   */
  async applyTemplate(templateName, content, options = {}) {
    const templates = {
      'matematica-analisi': {
        struttura: 'gerarchica',
        livelli: ['Concetti Base', 'Teoremi', 'Dimostrazioni', 'Applicazioni', 'Esercizi'],
        stile: { colori: ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'] }
      },
      'storia-eventi': {
        struttura: 'temporale',
        livelli: ['Periodo', 'Eventi Principali', 'Cause', 'Conseguenze', 'Personaggi'],
        stile: { colori: ['#8e44ad', '#34495e', '#16a085', '#27ae60', '#2c3e50'] }
      },
      'scienze-concetti': {
        struttura: 'reticolare',
        livelli: ['Teoria', 'Leggi', 'Esperimenti', 'Applicazioni', 'Esempi'],
        stile: { colori: ['#1abc9c', '#3498db', '#9b59b6', '#e74c3c', '#f39c12'] }
      },
      'letteratura-opera': {
        struttura: 'concentrica',
        livelli: ['Opera', 'Temi', 'Personaggi', 'Stile', 'Contesto'],
        stile: { colori: ['#e74c3c', '#d35400', '#f39c12', '#f1c40f', '#2ecc71'] }
      }
    };
    
    const template = templates[templateName] || templates['matematica-analisi'];
    
    // Applica template al contenuto
    const mappedContent = {
      ...content,
      template: templateName,
      struttura: template.struttura
    };
    
    // Crea mappa con template
    return await this.createIntelligentMap(mappedContent, {
      ...options,
      layout: template.struttura,
      stile: template.stile
    });
  }

  /**
   * 📱 GET USER DASHBOARD
   */
  async getUserDashboard(userId) {
    const userMaps = [];
    const userProgress = [];
    
    // Raccogli tutte le mappe e progressi dell'utente
    for (const [key, progress] of this.userProgress.entries()) {
      if (key.startsWith(userId)) {
        userProgress.push(progress);
        const mapId = key.split('-')[1];
        const map = this.maps.get(mapId);
        if (map) {
          userMaps.push({
            id: map.id,
            nome: map.nome,
            progresso: progress.percentualeCompletamento || 0
          });
        }
      }
    }
    
    // Calcola statistiche aggregate
    const totalTime = userProgress.reduce((sum, p) => sum + (p.tempoTotale || 0), 0);
    const totalNodes = userProgress.reduce((sum, p) => sum + p.nodiCompletati.length, 0);
    const avgAccuracy = userProgress.reduce((sum, p) => sum + (p.statistiche?.accuratezzaMedia || 0), 0) / (userProgress.length || 1);
    
    return {
      userId,
      mappe: userMaps,
      statistiche: {
        mappeInCorso: userMaps.filter(m => m.progresso > 0 && m.progresso < 100).length,
        mappeCompletate: userMaps.filter(m => m.progresso >= 100).length,
        tempoTotaleStudio: totalTime,
        nodiCompletati: totalNodes,
        accuratezzaMedia: Math.round(avgAccuracy),
        badges: this._collectAllBadges(userProgress)
      },
      suggerimenti: this._generateDashboardSuggestions(userMaps, userProgress)
    };
  }

  /**
   * 🎯 AI RECOMMENDATIONS
   */
  async getAIRecommendations(userId, mapId) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    const progress = this.userProgress.get(`${userId}-${mapId}`);
    
    return {
      prossimoPasso: this._suggestNextNode(map, progress),
      risorseConsigliate: this._suggestResources(map, progress),
      tempoOttimale: this._suggestStudyTime(progress),
      focusAree: this._identifyFocusAreas(map, progress)
    };
  }

  // === HELPER METHODS ===

  _countMapUsers(mapId) {
    let count = 0;
    for (const key of this.userProgress.keys()) {
      if (key.endsWith(`-${mapId}`)) {
        count++;
      }
    }
    return count;
  }

  _calculateAvgProgress(mapId) {
    const progresses = [];
    for (const [key, progress] of this.userProgress.entries()) {
      if (key.endsWith(`-${mapId}`)) {
        progresses.push(progress.percentualeCompletamento || 0);
      }
    }
    
    if (progresses.length === 0) return 0;
    return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
  }

  _calculateCompletionRate(mapId) {
    let completed = 0;
    let total = 0;
    
    for (const [key, progress] of this.userProgress.entries()) {
      if (key.endsWith(`-${mapId}`)) {
        total++;
        if (progress.percentualeCompletamento >= 100) {
          completed++;
        }
      }
    }
    
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  _assessContentQuality(map) {
    let score = 0;
    
    // Valuta completezza contenuti
    const avgContentLength = map.graph.nodes.reduce((sum, n) => 
      sum + (n.contenuto?.testo?.length || 0), 0
    ) / map.graph.nodes.length;
    
    if (avgContentLength > 500) score += 30;
    else if (avgContentLength > 200) score += 20;
    else if (avgContentLength > 100) score += 10;
    
    // Valuta presenza formule/esempi
    const nodesWithFormulas = map.graph.nodes.filter(n => 
      n.contenuto?.formule?.length > 0
    ).length;
    const nodesWithExamples = map.graph.nodes.filter(n => 
      n.contenuto?.esempi?.length > 0
    ).length;
    
    score += (nodesWithFormulas / map.graph.nodes.length) * 20;
    score += (nodesWithExamples / map.graph.nodes.length) * 20;
    
    // Valuta metadata
    const nodesWithTags = map.graph.nodes.filter(n => 
      n.metadata?.tags?.length > 0
    ).length;
    
    score += (nodesWithTags / map.graph.nodes.length) * 30;
    
    return Math.min(100, Math.round(score));
  }

  _assessStructureQuality(map) {
    let score = 0;
    
    // Valuta profondità
    const maxLevel = Math.max(...map.graph.nodes.map(n => n.livello || 0));
    if (maxLevel >= 3) score += 25;
    else if (maxLevel >= 2) score += 15;
    
    // Valuta connessioni
    const avgConnections = map.graph.edges.length / map.graph.nodes.length;
    if (avgConnections > 2) score += 25;
    else if (avgConnections > 1.5) score += 15;
    
    // Valuta cluster
    if (map.graph.clusters && map.graph.clusters.length > 1) {
      score += 25;
    }
    
    // Valuta percorsi
    if (map.learningPaths.length >= 3) score += 25;
    else if (map.learningPaths.length >= 2) score += 15;
    
    return Math.min(100, score);
  }

  _assessResourceQuality(map) {
    const totalResources = Object.values(map.resources).flat().length;
    const resourcesPerNode = totalResources / map.graph.nodes.length;
    
    if (resourcesPerNode >= 5) return 100;
    if (resourcesPerNode >= 3) return 75;
    if (resourcesPerNode >= 2) return 50;
    if (resourcesPerNode >= 1) return 25;
    return 0;
  }

  _collectAllBadges(userProgress) {
    const allBadges = new Set();
    userProgress.forEach(p => {
      (p.badges || []).forEach(badge => allBadges.add(badge));
    });
    return Array.from(allBadges);
  }

  _generateDashboardSuggestions(userMaps, userProgress) {
    const suggestions = [];
    
    // Suggerisci completamento mappe in corso
    const inProgress = userMaps.filter(m => m.progresso > 0 && m.progresso < 100);
    if (inProgress.length > 0) {
      suggestions.push({
        tipo: 'continua',
        messaggio: `Continua con "${inProgress[0].nome}" (${inProgress[0].progresso}% completato)`,
        mapId: inProgress[0].id
      });
    }
    
    // Suggerisci nuove mappe
    if (userMaps.length < 3) {
      suggestions.push({
        tipo: 'esplora',
        messaggio: 'Esplora nuove mappe per ampliare le tue conoscenze'
      });
    }
    
    // Suggerisci ripasso
    const needsReview = userProgress.filter(p => {
      const lastActivity = new Date(p.lastActivity);
      const daysSince = (new Date() - lastActivity) / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    });
    
    if (needsReview.length > 0) {
      suggestions.push({
        tipo: 'ripasso',
        messaggio: 'È il momento di ripassare alcuni concetti'
      });
    }
    
    return suggestions;
  }

  _suggestNextNode(map, progress) {
    if (!progress) {
      // Prima volta: suggerisci nodo root
      return map.graph.nodes.find(n => n.livello === 0);
    }
    
    // Trova nodi non completati con prerequisiti soddisfatti
    const completed = new Set(progress.nodiCompletati);
    const candidates = map.graph.nodes.filter(n => {
      if (completed.has(n.id)) return false;
      
      const prereqsSatisfied = (n.metadata.prerequisiti || []).every(prereq => 
        completed.has(prereq)
      );
      
      return prereqsSatisfied;
    });
    
    // Ordina per livello e importanza
    candidates.sort((a, b) => {
      if (a.livello !== b.livello) {
        return a.livello - b.livello;
      }
      return (b.metadata.importanza || 5) - (a.metadata.importanza || 5);
    });
    
    return candidates[0];
  }

  _suggestResources(map, progress) {
    const suggestions = [];
    
    if (!progress || progress.nodiCompletati.length === 0) {
      // Suggerisci risorse introduttive
      suggestions.push(...map.resources.microLezioni.slice(0, 2));
    } else {
      // Suggerisci risorse basate su performance
      if (progress.statistiche?.accuratezzaMedia < 70) {
        suggestions.push(...map.resources.flashcards.slice(0, 5));
      } else {
        suggestions.push(...map.resources.esercizi.slice(0, 3));
      }
    }
    
    return suggestions;
  }

  _suggestStudyTime(progress) {
    if (!progress) {
      return { minuti: 15, messaggio: 'Inizia con una sessione breve' };
    }
    
    const avgSessionTime = progress.tempoTotale / (progress.sessioni?.length || 1);
    
    if (avgSessionTime < 10 * 60) {
      return { minuti: 15, messaggio: 'Sessione breve consigliata' };
    } else if (avgSessionTime < 30 * 60) {
      return { minuti: 30, messaggio: 'Sessione media consigliata' };
    } else {
      return { minuti: 45, messaggio: 'Sessione approfondita consigliata' };
    }
  }

  _identifyFocusAreas(map, progress) {
    if (!progress) {
      return map.graph.nodes
        .filter(n => n.tipo === 'principale')
        .slice(0, 3)
        .map(n => ({ nodeId: n.id, titolo: n.titolo, motivo: 'Concetto fondamentale' }));
    }
    
    const focusAreas = [];
    
    // Identifica nodi con bassa performance
    const lowPerformance = progress.nodiCompletati.filter(nodeId => {
      // Placeholder: in produzione usare dati reali di performance
      return Math.random() < 0.3;
    });
    
    lowPerformance.forEach(nodeId => {
      const node = map.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        focusAreas.push({
          nodeId,
          titolo: node.titolo,
          motivo: 'Necessita ripasso'
        });
      }
    });
    
    return focusAreas.slice(0, 3);
  }
}

module.exports = new IntelligentMapsService();
