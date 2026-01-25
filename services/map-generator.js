// GENERATORE MAPPE INTELLIGENTI - CORE
// Analisi semantica e generazione mappe concettuali

const { v4: uuidv4 } = require('uuid');

class MapGenerator {
  constructor() {
    this.nodeTypes = {
      CONCEPT: 'concetto',
      DEFINITION: 'definizione',
      THEOREM: 'teorema',
      LAW: 'legge',
      FORMULA: 'formula',
      EXAMPLE: 'esempio',
      EXERCISE: 'esercizio',
      NOTE: 'nota'
    };
    
    this.relationTypes = {
      DEFINES: 'definisce',
      IMPLIES: 'implica',
      EXAMPLE_OF: 'è esempio di',
      CAUSES: 'è causa di',
      PREREQUISITE: 'è prerequisito di',
      APPLIES_TO: 'si applica a',
      FORMULA_FOR: 'formula per',
      PART_OF: 'parte di'
    };
  }

  generateMindMap(semanticAnalysis, options = {}) {
    const {
      detailLevel = 'normal',
      maxNodes = 8,
      layoutType = 'radial'
    } = options;
    
    const map = {
      id: uuidv4(),
      nodes: [],
      connections: [],
      metadata: {
        created: new Date().toISOString(),
        detailLevel,
        layoutType,
        version: '1.0'
      }
    };
    
    // 1. Nodo centrale
    const centralNode = this.createCentralNode(semanticAnalysis);
    map.nodes.push(centralNode);
    
    // 2. Nodi principali (primo livello)
    const mainNodes = this.createMainNodes(semanticAnalysis, centralNode, maxNodes);
    map.nodes.push(...mainNodes);
    
    // 3. Connessioni dal centro
    mainNodes.forEach(node => {
      map.connections.push(this.createConnection(centralNode, node));
    });
    
    // 4. Nodi secondari se detailLevel > normal
    if (detailLevel === 'detailed') {
      const secondaryNodes = this.createSecondaryNodes(semanticAnalysis, mainNodes);
      map.nodes.push(...secondaryNodes.nodes);
      map.connections.push(...secondaryNodes.connections);
    }
    
    // 5. Connessioni trasversali
    const crossConnections = this.findCrossConnections(map.nodes, semanticAnalysis.relations);
    map.connections.push(...crossConnections);
    
    return map;
  }
  
  createCentralNode(analysis) {
    const central = this.identifyCentralConcept(analysis);
    
    return {
      id: uuidv4(),
      text: central.text,
      type: 'central',
      level: 0,
      position: { x: 600, y: 400 },
      style: {
        color: '#9f7aea',
        size: 'large',
        shape: 'diamond',
        fontSize: 18,
        fontWeight: 'bold'
      },
      metadata: {
        importance: 1.0,
        definitions: central.definitions || [],
        context: central.context,
        tags: central.tags || []
      },
      expandable: true,
      expanded: true
    };
  }
  
  createMainNodes(analysis, centralNode, maxNodes) {
    const nodes = [];
    const concepts = this.rankConcepts(analysis.entities);
    const selected = concepts.slice(0, Math.min(maxNodes, concepts.length));
    
    const angle = (2 * Math.PI) / selected.length;
    const radius = 250;
    
    selected.forEach((concept, index) => {
      const x = centralNode.position.x + radius * Math.cos(angle * index - Math.PI / 2);
      const y = centralNode.position.y + radius * Math.sin(angle * index - Math.PI / 2);
      
      nodes.push({
        id: uuidv4(),
        text: concept.text,
        type: concept.type || this.nodeTypes.CONCEPT,
        level: 1,
        position: { x, y },
        style: {
          color: this.getNodeColor(concept.type),
          size: 'medium',
          shape: 'rounded',
          fontSize: 14
        },
        metadata: {
          importance: concept.importance,
          definitions: concept.definitions || [],
          examples: concept.examples || [],
          formulas: concept.formulas || [],
          context: concept.context
        },
        expandable: true,
        expanded: false
      });
    });
    
    return nodes;
  }
  
  createSecondaryNodes(analysis, parentNodes) {
    const nodes = [];
    const connections = [];
    
    parentNodes.forEach(parent => {
      const subConcepts = this.findSubConcepts(analysis, parent);
      const subAngle = Math.PI / (subConcepts.length + 1);
      const subRadius = 150;
      
      subConcepts.forEach((subConcept, index) => {
        const angle = -Math.PI / 2 + subAngle * (index + 1);
        const x = parent.position.x + subRadius * Math.cos(angle);
        const y = parent.position.y + subRadius * Math.sin(angle);
        
        const node = {
          id: uuidv4(),
          text: subConcept.text,
          type: subConcept.type,
          level: 2,
          position: { x, y },
          style: {
            color: this.getNodeColor(subConcept.type),
            size: 'small',
            shape: 'circle',
            fontSize: 12
          },
          metadata: subConcept.metadata || {},
          expandable: false,
          expanded: false,
          parentId: parent.id
        };
        
        nodes.push(node);
        connections.push(this.createConnection(parent, node, subConcept.relationType));
      });
    });
    
    return { nodes, connections };
  }
  
  createConnection(fromNode, toNode, type = null) {
    return {
      id: uuidv4(),
      from: fromNode.id,
      to: toNode.id,
      type: type || this.determineRelationType(fromNode, toNode),
      style: {
        type: 'bezier',
        color: '#4a5568',
        width: 2,
        arrow: true,
        dashed: false
      },
      label: this.getRelationLabel(type),
      metadata: {
        strength: this.calculateConnectionStrength(fromNode, toNode)
      }
    };
  }
  
  findCrossConnections(nodes, relations) {
    const connections = [];
    
    relations.forEach(relation => {
      const fromNode = nodes.find(n => n.text.toLowerCase() === relation.from.toLowerCase());
      const toNode = nodes.find(n => n.text.toLowerCase() === relation.to.toLowerCase());
      
      if (fromNode && toNode && fromNode.id !== toNode.id) {
        connections.push({
          id: uuidv4(),
          from: fromNode.id,
          to: toNode.id,
          type: relation.type,
          style: {
            type: 'straight',
            color: '#718096',
            width: 1,
            arrow: true,
            dashed: true
          },
          label: relation.type,
          metadata: {
            isCrossConnection: true
          }
        });
      }
    });
    
    return connections;
  }
  
  identifyCentralConcept(analysis) {
    let maxScore = 0;
    let central = null;
    
    analysis.entities.forEach(entity => {
      const score = (entity.importance || 0) * (entity.frequency || 1) * (entity.centrality || 1);
      if (score > maxScore) {
        maxScore = score;
        central = entity;
      }
    });
    
    return central || {
      text: 'Concetto Principale',
      importance: 1.0
    };
  }
  
  rankConcepts(entities) {
    return entities
      .map(entity => ({
        ...entity,
        score: (entity.importance || 0) * (entity.frequency || 1)
      }))
      .sort((a, b) => b.score - a.score);
  }
  
  findSubConcepts(analysis, parentNode) {
    const subConcepts = [];
    
    // Trova esempi collegati
    if (parentNode.metadata.examples) {
      parentNode.metadata.examples.slice(0, 2).forEach(ex => {
        subConcepts.push({
          text: ex.title || 'Esempio',
          type: this.nodeTypes.EXAMPLE,
          relationType: this.relationTypes.EXAMPLE_OF,
          metadata: { content: ex.text }
        });
      });
    }
    
    // Trova formule collegate
    if (parentNode.metadata.formulas) {
      parentNode.metadata.formulas.slice(0, 2).forEach(formula => {
        subConcepts.push({
          text: formula.name || 'Formula',
          type: this.nodeTypes.FORMULA,
          relationType: this.relationTypes.FORMULA_FOR,
          metadata: { latex: formula.expression }
        });
      });
    }
    
    // Trova definizioni collegate
    if (parentNode.metadata.definitions && parentNode.metadata.definitions.length > 1) {
      parentNode.metadata.definitions.slice(1, 3).forEach(def => {
        subConcepts.push({
          text: def.term || 'Definizione',
          type: this.nodeTypes.DEFINITION,
          relationType: this.relationTypes.DEFINES,
          metadata: { content: def.definition }
        });
      });
    }
    
    return subConcepts;
  }
  
  getNodeColor(type) {
    const colors = {
      'central': '#9f7aea',
      'concetto': '#667eea',
      'definizione': '#48bb78',
      'teorema': '#ed8936',
      'legge': '#38b2ac',
      'formula': '#f56565',
      'esempio': '#fbd38d',
      'esercizio': '#fc8181',
      'nota': '#a0aec0',
      'domanda': '#4fd1c5'
    };
    return colors[type] || '#667eea';
  }
  
  determineRelationType(fromNode, toNode) {
    if (fromNode.type === 'central') {
      return this.relationTypes.PART_OF;
    }
    if (toNode.type === this.nodeTypes.EXAMPLE) {
      return this.relationTypes.EXAMPLE_OF;
    }
    if (toNode.type === this.nodeTypes.FORMULA) {
      return this.relationTypes.FORMULA_FOR;
    }
    return this.relationTypes.DEFINES;
  }
  
  getRelationLabel(type) {
    if (!type) return '';
    const labels = {
      'definisce': 'def',
      'implica': '→',
      'è esempio di': 'es',
      'è causa di': '⇒',
      'è prerequisito di': 'pre',
      'si applica a': 'app',
      'formula per': 'f(x)',
      'parte di': '⊂'
    };
    return labels[type] || '';
  }
  
  calculateConnectionStrength(fromNode, toNode) {
    const levelDiff = Math.abs(fromNode.level - toNode.level);
    const importanceAvg = ((fromNode.metadata.importance || 0) + (toNode.metadata.importance || 0)) / 2;
    return Math.max(0.1, Math.min(1, importanceAvg / (levelDiff + 1)));
  }
}

module.exports = MapGenerator;
