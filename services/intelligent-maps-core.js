/**
 * 🗺️ INTELLIGENT MAPS CORE
 * Funzionalità core per mappe intelligenti
 */

const aiService = require('./ai-service');
const contenuti = require('../../data/data/contenuti-tutte-materie-complete');
const { v4: uuidv4 } = require('uuid');

class IntelligentMapsCore {
  constructor() {
    this.config = {
      graph: {
        maxNodes: 500,
        maxDepth: 5,
        autoExpand: true,
        clusterSimilar: true
      },
      learning: {
        microLessonDuration: [5, 15], // minuti
        dailyGoal: 30, // minuti
        adaptiveDifficulty: true,
        spaceRepetition: true
      },
      visualization: {
        layout: 'force-directed',
        animation: true,
        '3dEnabled': false,
        colorScheme: 'materia'
      },
      ai: {
        autoGenerate: true,
        extractRelations: true,
        suggestPaths: true,
        generateExercises: true
      }
    };
    
    this.maps = new Map();
    this.learningPaths = new Map();
    this.userProgress = new Map();
  }

  /**
   * 🗺️ CREA MAPPA INTELLIGENTE
   */
  async createIntelligentMap(input, options = {}) {
    console.log('🗺️ Creazione mappa intelligente...');
    
    const mapId = uuidv4();
    
    try {
      // 1. Estrai concetti
      const extractedData = await this._extractConcepts(input, options);
      
      // 2. Costruisci grafo
      const graph = await this._buildKnowledgeGraph(extractedData, options);
      
      // 3. Identifica relazioni
      const relations = await this._identifyRelations(graph);
      
      // 4. Genera risorse
      const resources = await this._generateLearningResources(graph, options);
      
      // 5. Crea percorsi
      const paths = await this._generateLearningPaths(graph, relations);
      
      // 6. Costruisci mappa
      const map = {
        id: mapId,
        nome: options.nome || extractedData.titolo || 'Mappa Concettuale',
        descrizione: options.descrizione || extractedData.descrizione || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          materia: extractedData.materia || options.materia || 'Generale',
          argomento: extractedData.argomento || options.argomento || '',
          livello: options.livello || 'intermedio',
          durataTotale: this._calculateTotalDuration(graph),
          tags: [...(extractedData.tags || []), ...(options.tags || [])]
        },
        graph: {
          nodes: graph.nodes,
          edges: relations.edges,
          clusters: relations.clusters,
          layout: options.layout || this.config.visualization.layout
        },
        learningPaths: paths,
        resources: resources,
        statistics: {
          totaleNodi: graph.nodes.length,
          totaleRelazioni: relations.edges.length,
          totalePercorsi: paths.length,
          totaleRisorse: Object.values(resources).flat().length,
          complessita: this._calculateComplexity(graph, relations)
        },
        settings: {
          public: options.public || false,
          collaborative: options.collaborative || false,
          aiAssisted: options.aiAssisted !== false
        }
      };
      
      this.maps.set(mapId, map);
      
      console.log(`✅ Mappa creata: ${mapId}`);
      return {
        success: true,
        mapId,
        map
      };
      
    } catch (error) {
      console.error('❌ Errore creazione mappa:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🎯 ESTRAI CONCETTI
   */
  async _extractConcepts(input, options) {
    console.log('🔍 Estrazione concetti...');
    
    let content = '';
    let inputType = 'text';
    
    // Determina tipo di input
    if (typeof input === 'string') {
      if (input.startsWith('http')) {
        inputType = 'url';
        content = input;
      } else if (input.endsWith('.pdf')) {
        inputType = 'pdf';
        content = 'PDF content';
      } else {
        content = input;
      }
    } else if (input.image) {
      inputType = 'image';
      content = 'OCR result';
    } else if (input.materia && input.argomento) {
      inputType = 'structured';
      content = this._getContentFromMateria(input.materia, input.argomento);
    }
    
    // Estrai con AI
    const extractionResult = await aiService.generateContent({
      type: 'extract-concepts',
      prompt: `Estrai concetti chiave, relazioni e formule da: "${content.substring(0, 2000)}"`
    });
    
    return {
      titolo: extractionResult.titolo || 'Mappa',
      descrizione: extractionResult.descrizione || '',
      materia: extractionResult.materia || options.materia,
      argomento: extractionResult.argomento || options.argomento,
      concettiPrincipali: extractionResult.concettiPrincipali || [],
      concettiSecondari: extractionResult.concettiSecondari || {},
      relazioni: extractionResult.relazioni || [],
      formule: extractionResult.formule || [],
      esempi: extractionResult.esempi || [],
      tags: extractionResult.tags || []
    };
  }

  /**
   * 🏗️ COSTRUISCI KNOWLEDGE GRAPH
   */
  async _buildKnowledgeGraph(extractedData, options) {
    console.log('🏗️ Costruzione knowledge graph...');
    
    const nodes = [];
    const nodeMap = new Map();
    
    // Nodo radice
    const rootNode = {
      id: uuidv4(),
      tipo: 'root',
      livello: 0,
      titolo: extractedData.titolo,
      descrizione: extractedData.descrizione,
      contenuto: {
        testo: extractedData.descrizione,
        formule: [],
        esempi: []
      },
      metadata: {
        difficolta: 'base',
        tempoStudio: 5,
        prerequisiti: [],
        tags: extractedData.tags,
        importanza: 10
      },
      posizione: { x: 0, y: 0, fixed: true },
      stile: {
        colore: '#3498db',
        dimensione: 30,
        forma: 'circle',
        icona: '🎯'
      }
    };
    
    nodes.push(rootNode);
    nodeMap.set(rootNode.titolo, rootNode.id);
    
    // Nodi principali
    extractedData.concettiPrincipali.forEach((concetto, index) => {
      const angle = (2 * Math.PI * index) / extractedData.concettiPrincipali.length;
      const radius = 200;
      
      const node = {
        id: uuidv4(),
        tipo: 'principale',
        livello: 1,
        titolo: concetto.nome || concetto,
        descrizione: concetto.descrizione || '',
        contenuto: {
          testo: concetto.spiegazione || '',
          formule: concetto.formule || [],
          esempi: concetto.esempi || []
        },
        metadata: {
          difficolta: concetto.difficolta || 'intermedio',
          tempoStudio: concetto.tempoStudio || 10,
          prerequisiti: concetto.prerequisiti || [],
          tags: concetto.tags || [],
          importanza: concetto.importanza || 5
        },
        posizione: {
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle)
        },
        stile: {
          colore: this._getColorByDifficulty(concetto.difficolta),
          dimensione: 20,
          forma: 'circle',
          icona: '📚'
        }
      };
      
      nodes.push(node);
      nodeMap.set(concetto.nome || concetto, node.id);
    });
    
    // Nodi secondari
    for (const [principale, secondari] of Object.entries(extractedData.concettiSecondari)) {
      const principaleId = nodeMap.get(principale);
      if (!principaleId) continue;
      
      const principaleNode = nodes.find(n => n.id === principaleId);
      if (!principaleNode) continue;
      
      (secondari || []).forEach((secondario, index) => {
        const angle = (2 * Math.PI * index) / secondari.length;
        const radius = 80;
        
        const node = {
          id: uuidv4(),
          tipo: 'secondario',
          livello: 2,
          parent: principaleId,
          titolo: secondario.nome || secondario,
          descrizione: secondario.descrizione || '',
          contenuto: {
            testo: secondario.spiegazione || '',
            formule: secondario.formule || [],
            esempi: secondario.esempi || []
          },
          metadata: {
            difficolta: secondario.difficolta || principaleNode.metadata.difficolta,
            tempoStudio: secondario.tempoStudio || 5,
            prerequisiti: [principaleId],
            tags: secondario.tags || []
          },
          posizione: {
            x: principaleNode.posizione.x + radius * Math.cos(angle),
            y: principaleNode.posizione.y + radius * Math.sin(angle)
          },
          stile: {
            colore: this._getColorByDifficulty(secondario.difficolta),
            dimensione: 12,
            forma: 'circle',
            icona: '📌'
          }
        };
        
        nodes.push(node);
        nodeMap.set(secondario.nome || secondario, node.id);
      });
    }
    
    return {
      nodes,
      nodeMap
    };
  }

  /**
   * 🔗 IDENTIFICA RELAZIONI
   */
  async _identifyRelations(graph) {
    console.log('🔗 Identificazione relazioni...');
    
    const edges = [];
    const clusters = [];
    
    // Relazioni padre-figlio
    graph.nodes.forEach(node => {
      if (node.parent) {
        edges.push({
          id: uuidv4(),
          source: node.parent,
          target: node.id,
          tipo: 'gerarchia',
          peso: 1,
          stile: {
            colore: '#95a5a6',
            spessore: 2,
            tratteggiato: false,
            freccia: true
          }
        });
      }
    });
    
    // Relazioni prerequisiti
    graph.nodes.forEach(node => {
      (node.metadata.prerequisiti || []).forEach(prereq => {
        const prereqId = typeof prereq === 'string' && prereq.length === 36 
          ? prereq 
          : graph.nodeMap.get(prereq);
        
        if (prereqId && prereqId !== node.parent) {
          edges.push({
            id: uuidv4(),
            source: prereqId,
            target: node.id,
            tipo: 'prerequisito',
            peso: 0.8,
            stile: {
              colore: '#e67e22',
              spessore: 2,
              tratteggiato: true,
              freccia: true,
              etichetta: 'richiede'
            }
          });
        }
      });
    });
    
    // Cluster per similarità
    if (this.config.graph.clusterSimilar) {
      const clusterMap = new Map();
      
      graph.nodes.forEach(node => {
        const clusterKey = `${node.tipo}-${node.metadata.difficolta}`;
        
        if (!clusterMap.has(clusterKey)) {
          clusterMap.set(clusterKey, {
            id: uuidv4(),
            nome: `${node.tipo} ${node.metadata.difficolta}`,
            nodi: [],
            colore: node.stile.colore
          });
        }
        
        clusterMap.get(clusterKey).nodi.push(node.id);
      });
      
      clusters.push(...clusterMap.values());
    }
    
    return {
      edges,
      clusters
    };
  }

  /**
   * 📚 GENERA RISORSE DI APPRENDIMENTO
   */
  async _generateLearningResources(graph, options) {
    console.log('📚 Generazione risorse...');
    
    const resources = {
      quiz: [],
      flashcards: [],
      esercizi: [],
      microLezioni: []
    };
    
    if (!this.config.ai.generateExercises) {
      return resources;
    }
    
    // Per ogni nodo principale
    for (const node of graph.nodes.filter(n => n.tipo === 'principale').slice(0, 5)) {
      // Quiz
      for (let i = 0; i < 3; i++) {
        resources.quiz.push({
          id: uuidv4(),
          nodeId: node.id,
          tipo: 'MCQ',
          domanda: `Domanda su ${node.titolo}`,
          opzioni: ['Opzione A', 'Opzione B', 'Opzione C', 'Opzione D'],
          rispostaCorretta: 0,
          spiegazione: 'Spiegazione dettagliata',
          difficolta: node.metadata.difficolta
        });
      }
      
      // Flashcards
      for (let i = 0; i < 2; i++) {
        resources.flashcards.push({
          id: uuidv4(),
          nodeId: node.id,
          fronte: `Cos'è ${node.titolo}?`,
          retro: node.descrizione,
          difficolta: node.metadata.difficolta
        });
      }
      
      // Micro-lezione
      resources.microLezioni.push({
        id: uuidv4(),
        nodeId: node.id,
        titolo: `Micro-lezione: ${node.titolo}`,
        durata: 10,
        contenuto: node.contenuto
      });
    }
    
    return resources;
  }

  /**
   * 🛤️ GENERA PERCORSI DI APPRENDIMENTO
   */
  async _generateLearningPaths(graph, relations) {
    console.log('🛤️ Generazione percorsi...');
    
    const paths = [];
    
    // Percorso base
    const basePath = {
      id: uuidv4(),
      nome: 'Percorso Base',
      descrizione: 'Introduzione ai concetti fondamentali',
      difficolta: 'base',
      durataTotale: 0,
      nodi: []
    };
    
    const nodiBase = graph.nodes
      .filter(n => n.metadata.difficolta === 'base' || n.livello <= 1)
      .sort((a, b) => a.livello - b.livello);
    
    basePath.nodi = nodiBase.map(n => n.id);
    basePath.durataTotale = nodiBase.reduce((sum, n) => sum + n.metadata.tempoStudio, 0);
    paths.push(basePath);
    
    // Percorso completo
    const completePath = {
      id: uuidv4(),
      nome: 'Percorso Completo',
      descrizione: 'Tutti i concetti in ordine logico',
      difficolta: 'avanzato',
      durataTotale: 0,
      nodi: []
    };
    
    const sortedNodes = this._topologicalSort(graph.nodes, relations.edges);
    completePath.nodi = sortedNodes.map(n => n.id);
    completePath.durataTotale = sortedNodes.reduce((sum, n) => sum + n.metadata.tempoStudio, 0);
    paths.push(completePath);
    
    // Percorso veloce
    const fastPath = {
      id: uuidv4(),
      nome: 'Percorso Veloce',
      descrizione: 'Solo concetti essenziali',
      difficolta: 'intermedio',
      durataTotale: 0,
      nodi: []
    };
    
    const essentialNodes = graph.nodes
      .filter(n => n.tipo === 'principale')
      .slice(0, 5);
    
    fastPath.nodi = essentialNodes.map(n => n.id);
    fastPath.durataTotale = essentialNodes.reduce((sum, n) => sum + n.metadata.tempoStudio, 0);
    paths.push(fastPath);
    
    return paths;
  }

  /**
   * 📊 UTILITY METHODS
   */
  _getColorByDifficulty(difficolta) {
    const colors = {
      'base': '#27ae60',
      'intermedio': '#f39c12',
      'avanzato': '#e74c3c'
    };
    return colors[difficolta] || '#95a5a6';
  }

  _getContentFromMateria(materia, argomento) {
    // Cerca nei contenuti esistenti
    const materiaData = Object.values(contenuti).find(m => 
      m.materia && m.materia.nome.toLowerCase().includes(materia.toLowerCase())
    );
    
    if (!materiaData) return '';
    
    const argomentoData = materiaData.argomenti.find(a =>
      a.titolo.toLowerCase().includes(argomento.toLowerCase())
    );
    
    if (!argomentoData) return materiaData.materia.descrizione || '';
    
    return argomentoData.sottoargomenti
      .map(s => s.riassunto)
      .join('\n\n')
      .substring(0, 3000);
  }

  _calculateTotalDuration(graph) {
    return graph.nodes.reduce((sum, node) => 
      sum + (node.metadata.tempoStudio || 5), 0
    );
  }

  _calculateComplexity(graph, relations) {
    const nodeCount = graph.nodes.length;
    const edgeCount = relations.edges.length;
    const avgDegree = edgeCount / nodeCount;
    
    if (avgDegree < 1.5) return 'semplice';
    if (avgDegree < 2.5) return 'moderata';
    return 'complessa';
  }

  _topologicalSort(nodes, edges) {
    // Implementazione semplificata
    return nodes.sort((a, b) => {
      if (a.livello !== b.livello) {
        return a.livello - b.livello;
      }
      return (a.metadata.importanza || 5) - (b.metadata.importanza || 5);
    });
  }
}

module.exports = IntelligentMapsCore;
