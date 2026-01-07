/**
 * 🗺️ INTELLIGENT MAPS EXTENDED
 * Funzionalità avanzate per mappe intelligenti
 */

const IntelligentMapsCore = require('./intelligent-maps-core');
const { v4: uuidv4 } = require('uuid');

class IntelligentMapsExtended extends IntelligentMapsCore {
  constructor() {
    super();
    
    // Configurazioni aggiuntive
    this.diagnostics = new Map();
    this.collaborations = new Map();
  }

  /**
   * 🎓 MODALITÀ DIAGNOSTICA
   */
  async runDiagnosticTest(userId, mapId, options = {}) {
    console.log('🎓 Avvio test diagnostico...');
    
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    const diagnostic = {
      id: uuidv4(),
      userId,
      mapId,
      timestamp: new Date().toISOString(),
      config: {
        numDomande: options.numDomande || 10,
        difficolta: options.difficolta || 'adattiva',
        timeout: options.timeout || 30 * 60 * 1000 // 30 minuti
      },
      domande: [],
      risultati: {},
      lacune: [],
      suggerimenti: []
    };
    
    // Seleziona nodi per il test
    const nodi = this._selectNodesForDiagnostic(map, diagnostic.config);
    
    // Genera domande per ogni nodo
    for (const nodo of nodi) {
      const quiz = map.resources.quiz.find(q => q.nodeId === nodo.id);
      
      if (quiz) {
        diagnostic.domande.push({
          id: uuidv4(),
          nodeId: nodo.id,
          concetto: nodo.titolo,
          difficolta: nodo.metadata.difficolta,
          quiz: quiz,
          pesoDiagnostico: this._calculateDiagnosticWeight(nodo)
        });
      }
    }
    
    // Salva diagnostica
    this.diagnostics.set(diagnostic.id, diagnostic);
    
    return diagnostic;
  }

  /**
   * 📊 ANALIZZA RISULTATI DIAGNOSTICI
   */
  async analyzeDiagnosticResults(diagnosticId, risposte) {
    const diagnostic = this.diagnostics.get(diagnosticId);
    if (!diagnostic) {
      throw new Error('Test diagnostico non trovato');
    }
    
    const map = this.maps.get(diagnostic.mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    const analisi = {
      id: uuidv4(),
      diagnosticId,
      timestamp: new Date().toISOString(),
      punteggio: 0,
      punteggioMassimo: 0,
      percentualeSuccesso: 0,
      lacune: [],
      puntiForza: [],
      suggerimenti: [],
      percorsoRecupero: null,
      tempoStimato: 0
    };
    
    // Analizza ogni risposta
    risposte.forEach(risposta => {
      const domanda = diagnostic.domande.find(d => d.id === risposta.domandaId);
      if (!domanda) return;
      
      const peso = domanda.pesoDiagnostico || 1;
      analisi.punteggioMassimo += peso * 10;
      
      if (risposta.corretta) {
        analisi.punteggio += peso * 10;
        analisi.puntiForza.push({
          nodeId: domanda.nodeId,
          concetto: domanda.concetto,
          livelloMaestria: 'buono'
        });
      } else {
        analisi.lacune.push({
          nodeId: domanda.nodeId,
          concetto: domanda.concetto,
          difficolta: domanda.difficolta,
          tipo: this._determineLacunaType(risposta),
          gravita: peso > 1.5 ? 'alta' : 'media'
        });
      }
    });
    
    // Calcola percentuale
    analisi.percentualeSuccesso = Math.round(
      (analisi.punteggio / analisi.punteggioMassimo) * 100
    );
    
    // Genera suggerimenti
    analisi.suggerimenti = this._generateSuggerimenti(analisi.lacune, map);
    
    // Crea percorso di recupero
    if (analisi.lacune.length > 0) {
      analisi.percorsoRecupero = this._createRecoveryPath(analisi.lacune, map);
      analisi.tempoStimato = this._calculateRecoveryTime(analisi.percorsoRecupero);
    }
    
    // Aggiorna diagnostica
    diagnostic.risultati = analisi;
    
    return analisi;
  }

  /**
   * 📈 TRACCIA PROGRESSO
   */
  async trackProgress(userId, mapId, nodeId, action, result = {}) {
    const key = `${userId}-${mapId}`;
    
    if (!this.userProgress.has(key)) {
      this.userProgress.set(key, {
        userId,
        mapId,
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        nodiCompletati: [],
        nodiInCorso: [],
        nodiSaltati: [],
        tempoTotale: 0,
        sessioni: [],
        punteggio: 0,
        streak: 0,
        badges: [],
        statistiche: {
          quizCompletati: 0,
          flashcardsStudiate: 0,
          eserciziRisolti: 0,
          accuratezzaMedia: 0
        }
      });
    }
    
    const progress = this.userProgress.get(key);
    progress.lastActivity = new Date().toISOString();
    
    // Gestisci azioni
    switch (action) {
      case 'start':
        if (!progress.nodiInCorso.includes(nodeId)) {
          progress.nodiInCorso.push(nodeId);
        }
        break;
        
      case 'complete':
        if (result.success && !progress.nodiCompletati.includes(nodeId)) {
          progress.nodiCompletati.push(nodeId);
          progress.punteggio += result.punteggio || 10;
          
          // Rimuovi da in corso
          progress.nodiInCorso = progress.nodiInCorso.filter(id => id !== nodeId);
          
          // Aggiorna statistiche
          if (result.tipo === 'quiz') {
            progress.statistiche.quizCompletati++;
          } else if (result.tipo === 'flashcard') {
            progress.statistiche.flashcardsStudiate++;
          } else if (result.tipo === 'esercizio') {
            progress.statistiche.eserciziRisolti++;
          }
        }
        break;
        
      case 'skip':
        if (!progress.nodiSaltati.includes(nodeId)) {
          progress.nodiSaltati.push(nodeId);
        }
        break;
    }
    
    // Calcola progressi
    const map = this.maps.get(mapId);
    if (map) {
      progress.percentualeCompletamento = Math.round(
        (progress.nodiCompletati.length / map.graph.nodes.length) * 100
      );
      
      // Assegna badge
      this._assignBadges(progress);
    }
    
    return progress;
  }

  /**
   * 🤝 MODALITÀ COLLABORATIVA
   */
  async enableCollaboration(mapId, options = {}) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    const collaboration = {
      id: uuidv4(),
      mapId,
      createdAt: new Date().toISOString(),
      owner: options.owner || 'system',
      membri: [options.owner],
      impostazioni: {
        modificheAperte: options.modificheAperte || false,
        approvazioneRichiesta: options.approvazioneRichiesta || true,
        commentiAbilitati: options.commentiAbilitati !== false,
        versioningAbilitato: true
      },
      attivita: [],
      versioni: [{
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        autore: options.owner,
        descrizione: 'Versione iniziale',
        snapshot: JSON.stringify(map)
      }]
    };
    
    this.collaborations.set(mapId, collaboration);
    map.settings.collaborative = true;
    
    return collaboration;
  }

  /**
   * 🔄 AGGIORNA MAPPA
   */
  async updateMap(mapId, updates, userId = 'system') {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    // Verifica permessi se collaborativa
    if (map.settings.collaborative) {
      const collab = this.collaborations.get(mapId);
      if (collab && collab.impostazioni.approvazioneRichiesta) {
        if (!collab.membri.includes(userId)) {
          throw new Error('Non autorizzato');
        }
      }
    }
    
    // Applica aggiornamenti
    const updatedMap = {
      ...map,
      ...updates,
      id: mapId,
      updatedAt: new Date().toISOString()
    };
    
    // Aggiorna nodi se forniti
    if (updates.nodes) {
      updatedMap.graph.nodes = this._mergeNodes(map.graph.nodes, updates.nodes);
    }
    
    // Aggiorna edges se forniti
    if (updates.edges) {
      updatedMap.graph.edges = this._mergeEdges(map.graph.edges, updates.edges);
    }
    
    // Ricalcola statistiche
    updatedMap.statistics = {
      totaleNodi: updatedMap.graph.nodes.length,
      totaleRelazioni: updatedMap.graph.edges.length,
      totalePercorsi: updatedMap.learningPaths.length,
      totaleRisorse: Object.values(updatedMap.resources).flat().length,
      complessita: this._calculateComplexity(updatedMap.graph, { edges: updatedMap.graph.edges })
    };
    
    // Salva versione se collaborativa
    if (map.settings.collaborative) {
      const collab = this.collaborations.get(mapId);
      if (collab) {
        collab.versioni.push({
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          autore: userId,
          descrizione: updates.descrizioneModifica || 'Modifica mappa',
          snapshot: JSON.stringify(updatedMap)
        });
        
        collab.attivita.push({
          tipo: 'modifica',
          timestamp: new Date().toISOString(),
          autore: userId,
          descrizione: updates.descrizioneModifica || 'Mappa aggiornata'
        });
      }
    }
    
    // Salva mappa aggiornata
    this.maps.set(mapId, updatedMap);
    
    return updatedMap;
  }

  /**
   * 🎯 CREA PERCORSO PERSONALIZZATO
   */
  async createCustomPath(mapId, obiettivo, vincoli = {}) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    console.log(`🎯 Creazione percorso per: ${obiettivo}`);
    
    const customPath = {
      id: uuidv4(),
      nome: vincoli.nome || `Percorso: ${obiettivo}`,
      descrizione: `Percorso personalizzato per ${obiettivo}`,
      obiettivo,
      vincoli: {
        tempoDisponibile: vincoli.tempoDisponibile || 60, // minuti
        difficoltaMax: vincoli.difficoltaMax || 'avanzato',
        prerequisitiIgnora: vincoli.prerequisitiIgnora || false
      },
      nodi: [],
      durataTotale: 0,
      efficienza: 0
    };
    
    // Seleziona nodi rilevanti
    const nodiRilevanti = this._selectRelevantNodes(map, obiettivo, vincoli);
    
    // Ottimizza ordine
    const nodiOrdinati = this._optimizeNodeOrder(nodiRilevanti, vincoli);
    
    // Rispetta vincolo temporale
    let tempoAccumulato = 0;
    for (const nodo of nodiOrdinati) {
      if (tempoAccumulato + nodo.metadata.tempoStudio <= vincoli.tempoDisponibile) {
        customPath.nodi.push(nodo.id);
        tempoAccumulato += nodo.metadata.tempoStudio;
      }
    }
    
    customPath.durataTotale = tempoAccumulato;
    customPath.efficienza = this._calculatePathEfficiency(customPath, obiettivo);
    
    // Aggiungi a percorsi della mappa
    map.learningPaths.push(customPath);
    
    return customPath;
  }

  /**
   * 🔍 RICERCA SEMANTICA
   */
  async searchInMap(mapId, query, options = {}) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    const results = {
      nodi: [],
      risorse: [],
      percorsi: []
    };
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    // Cerca nei nodi
    map.graph.nodes.forEach(nodo => {
      const searchText = [
        nodo.titolo,
        nodo.descrizione,
        nodo.contenuto.testo || '',
        ...(nodo.metadata.tags || [])
      ].join(' ').toLowerCase();
      
      const matches = searchTerms.filter(term => searchText.includes(term)).length;
      
      if (matches > 0) {
        results.nodi.push({
          ...nodo,
          relevance: matches / searchTerms.length
        });
      }
    });
    
    // Cerca nelle risorse
    ['quiz', 'flashcards', 'esercizi', 'microLezioni'].forEach(tipo => {
      (map.resources[tipo] || []).forEach(risorsa => {
        const searchText = JSON.stringify(risorsa).toLowerCase();
        const matches = searchTerms.filter(term => searchText.includes(term)).length;
        
        if (matches > 0) {
          results.risorse.push({
            ...risorsa,
            tipo,
            relevance: matches / searchTerms.length
          });
        }
      });
    });
    
    // Cerca nei percorsi
    map.learningPaths.forEach(percorso => {
      const searchText = [
        percorso.nome,
        percorso.descrizione
      ].join(' ').toLowerCase();
      
      const matches = searchTerms.filter(term => searchText.includes(term)).length;
      
      if (matches > 0) {
        results.percorsi.push({
          ...percorso,
          relevance: matches / searchTerms.length
        });
      }
    });
    
    // Ordina per rilevanza
    results.nodi.sort((a, b) => b.relevance - a.relevance);
    results.risorse.sort((a, b) => b.relevance - a.relevance);
    results.percorsi.sort((a, b) => b.relevance - a.relevance);
    
    // Limita risultati
    if (options.limit) {
      results.nodi = results.nodi.slice(0, options.limit);
      results.risorse = results.risorse.slice(0, options.limit);
      results.percorsi = results.percorsi.slice(0, options.limit);
    }
    
    return results;
  }

  /**
   * 📤 ESPORTA MAPPA
   */
  async exportMap(mapId, format = 'json', options = {}) {
    const map = this.maps.get(mapId);
    if (!map) {
      throw new Error('Mappa non trovata');
    }
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(map, null, 2);
        
      case 'opml':
        return this._exportOPML(map);
        
      case 'graphml':
        return this._exportGraphML(map);
        
      case 'svg':
        return this._exportSVG(map);
        
      case 'pdf':
        return { message: 'PDF export disponibile nella versione completa' };
        
      default:
        throw new Error(`Formato non supportato: ${format}`);
    }
  }

  // === HELPER METHODS ===

  _selectNodesForDiagnostic(map, config) {
    let nodes = [...map.graph.nodes];
    
    // Filtra per difficoltà
    if (config.difficolta !== 'adattiva') {
      nodes = nodes.filter(n => n.metadata.difficolta === config.difficolta);
    }
    
    // Prioritizza nodi principali
    nodes.sort((a, b) => {
      if (a.tipo !== b.tipo) {
        return a.tipo === 'principale' ? -1 : 1;
      }
      return (b.metadata.importanza || 5) - (a.metadata.importanza || 5);
    });
    
    return nodes.slice(0, config.numDomande);
  }

  _calculateDiagnosticWeight(nodo) {
    let peso = 1;
    
    if (nodo.tipo === 'principale') peso += 0.5;
    if (nodo.metadata.difficolta === 'avanzato') peso += 0.3;
    if (nodo.metadata.importanza >= 7) peso += 0.2;
    
    return peso;
  }

  _determineLacunaType(risposta) {
    if (risposta.tempoRisposta > 60000) return 'lentezza';
    if (risposta.tentativiMultipli) return 'incertezza';
    return 'incomprensione';
  }

  _generateSuggerimenti(lacune, map) {
    const suggerimenti = [];
    
    lacune.forEach(lacuna => {
      const nodo = map.graph.nodes.find(n => n.id === lacuna.nodeId);
      if (!nodo) return;
      
      suggerimenti.push({
        tipo: 'ripasso',
        nodeId: lacuna.nodeId,
        concetto: lacuna.concetto,
        priorita: lacuna.gravita === 'alta' ? 'urgente' : 'normale',
        risorse: [
          { tipo: 'micro-lezione', durata: 10 },
          { tipo: 'flashcards', quantita: 5 },
          { tipo: 'quiz', quantita: 3 }
        ],
        tempoStimato: 25
      });
    });
    
    return suggerimenti;
  }

  _createRecoveryPath(lacune, map) {
    const nodiRecupero = [];
    
    lacune.forEach(lacuna => {
      // Aggiungi nodo con lacuna
      nodiRecupero.push(lacuna.nodeId);
      
      // Aggiungi prerequisiti
      const nodo = map.graph.nodes.find(n => n.id === lacuna.nodeId);
      if (nodo && nodo.metadata.prerequisiti) {
        nodo.metadata.prerequisiti.forEach(prereq => {
          if (!nodiRecupero.includes(prereq)) {
            nodiRecupero.push(prereq);
          }
        });
      }
    });
    
    return {
      id: uuidv4(),
      nome: 'Percorso di Recupero',
      descrizione: 'Percorso personalizzato per colmare le lacune',
      nodi: nodiRecupero,
      priorita: 'alta'
    };
  }

  _calculateRecoveryTime(percorso) {
    if (!percorso) return 0;
    return percorso.nodi.length * 15; // 15 minuti per nodo
  }

  _assignBadges(progress) {
    const badges = [
      { id: 'iniziato', nome: 'Iniziato!', condizione: () => progress.nodiCompletati.length >= 1 },
      { id: 'meta', nome: 'A metà strada', condizione: () => progress.percentualeCompletamento >= 50 },
      { id: 'completato', nome: 'Completato!', condizione: () => progress.percentualeCompletamento >= 100 },
      { id: 'perfetto', nome: 'Perfezionista', condizione: () => progress.statistiche.accuratezzaMedia >= 95 },
      { id: 'veloce', nome: 'Velocista', condizione: () => progress.tempoTotale < 30 * 60 },
      { id: 'costante', nome: 'Costante', condizione: () => progress.streak >= 7 }
    ];
    
    badges.forEach(badge => {
      if (badge.condizione() && !progress.badges.includes(badge.id)) {
        progress.badges.push(badge.id);
      }
    });
  }

  _mergeNodes(existingNodes, newNodes) {
    const nodeMap = new Map(existingNodes.map(n => [n.id, n]));
    
    newNodes.forEach(newNode => {
      if (nodeMap.has(newNode.id)) {
        // Aggiorna esistente
        nodeMap.set(newNode.id, { ...nodeMap.get(newNode.id), ...newNode });
      } else {
        // Aggiungi nuovo
        nodeMap.set(newNode.id, newNode);
      }
    });
    
    return Array.from(nodeMap.values());
  }

  _mergeEdges(existingEdges, newEdges) {
    const edgeMap = new Map(existingEdges.map(e => [e.id, e]));
    
    newEdges.forEach(newEdge => {
      edgeMap.set(newEdge.id || uuidv4(), newEdge);
    });
    
    return Array.from(edgeMap.values());
  }

  _selectRelevantNodes(map, obiettivo, vincoli) {
    // Selezione semplificata basata su keyword match
    const keywords = obiettivo.toLowerCase().split(/\s+/);
    
    return map.graph.nodes.filter(nodo => {
      const nodeText = [nodo.titolo, nodo.descrizione, ...(nodo.metadata.tags || [])].join(' ').toLowerCase();
      return keywords.some(keyword => nodeText.includes(keyword));
    });
  }

  _optimizeNodeOrder(nodi, vincoli) {
    // Ordina per importanza e difficoltà
    return nodi.sort((a, b) => {
      // Prima i prerequisiti
      if (a.livello !== b.livello) {
        return a.livello - b.livello;
      }
      // Poi per importanza
      return (b.metadata.importanza || 5) - (a.metadata.importanza || 5);
    });
  }

  _calculatePathEfficiency(path, obiettivo) {
    // Metrica semplificata di efficienza
    return Math.min(1, path.nodi.length / 10) * 100;
  }

  _exportOPML(map) {
    const opml = [];
    opml.push('<?xml version="1.0" encoding="UTF-8"?>');
    opml.push('<opml version="2.0">');
    opml.push('<head>');
    opml.push(`  <title>${map.nome}</title>`);
    opml.push('</head>');
    opml.push('<body>');
    
    // Esporta struttura gerarchica
    const rootNodes = map.graph.nodes.filter(n => n.livello === 0);
    rootNodes.forEach(root => {
      opml.push(`  <outline text="${root.titolo}">`);
      this._exportNodeChildren(root, map.graph.nodes, opml, 2);
      opml.push('  </outline>');
    });
    
    opml.push('</body>');
    opml.push('</opml>');
    
    return opml.join('\n');
  }

  _exportNodeChildren(parent, allNodes, opml, indent) {
    const children = allNodes.filter(n => n.parent === parent.id);
    const spaces = ' '.repeat(indent);
    
    children.forEach(child => {
      opml.push(`${spaces}<outline text="${child.titolo}">`);
      this._exportNodeChildren(child, allNodes, opml, indent + 2);
      opml.push(`${spaces}</outline>`);
    });
  }

  _exportGraphML(map) {
    // Formato GraphML per importazione in strumenti di visualizzazione
    return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="${map.id}" edgedefault="directed">
    ${map.graph.nodes.map(n => `<node id="${n.id}" label="${n.titolo}"/>`).join('\n    ')}
    ${map.graph.edges.map(e => `<edge source="${e.source}" target="${e.target}"/>`).join('\n    ')}
  </graph>
</graphml>`;
  }

  _exportSVG(map) {
    // SVG semplificato
    return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  ${map.graph.nodes.map(n => 
    `<circle cx="${n.posizione.x + 400}" cy="${n.posizione.y + 300}" r="${n.stile.dimensione}" fill="${n.stile.colore}"/>`
  ).join('\n  ')}
</svg>`;
  }
}

module.exports = IntelligentMapsExtended;
