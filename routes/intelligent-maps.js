// API ROUTES - MAPPE INTELLIGENTI
// Gestione completa delle API per creazione, modifica e gestione mappe

const express = require('express');
const router = express.Router();
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');

const SemanticAnalyzer = require('../services/semantic-analyzer');
const MapGenerator = require('../services/map-generator');
const LearningResourcesGenerator = require('../services/learning-resources-generator');

// Configurazione upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato'));
    }
  }
});

// Inizializza servizi
const semanticAnalyzer = new SemanticAnalyzer();
const mapGenerator = new MapGenerator();
const resourcesGenerator = new LearningResourcesGenerator();

// Storage in memoria per demo (in produzione usare database)
const mapsStorage = new Map();
const userMaps = new Map(); // userId -> [mapIds]
const publicMaps = new Set();

// ==================== CREAZIONE MAPPA ====================

// Crea mappa da testo
router.post('/create/text', async (req, res) => {
  try {
    const {
      text,
      subject,
      level = 'intermedio',
      detailLevel = 'normal',
      generateResources = true,
      userId
    } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Testo richiesto' });
    }
    
    // Analisi semantica
    const analysis = semanticAnalyzer.analyze(text, {
      subject,
      level,
      maxConcepts: detailLevel === 'detailed' ? 20 : 10
    });
    
    // Generazione mappa
    const mindMap = mapGenerator.generateMindMap(analysis, {
      detailLevel,
      maxNodes: detailLevel === 'minimal' ? 6 : detailLevel === 'detailed' ? 12 : 8
    });
    
    // Generazione risorse (quiz e flashcards)
    let resources = null;
    if (generateResources) {
      resources = {
        flashcards: [],
        quizzes: []
      };
      
      for (const node of mindMap.nodes) {
        const flashcards = resourcesGenerator.generateFlashcardsForNode(
          node, 
          subject || 'Generale', 
          level
        );
        const quizzes = resourcesGenerator.generateQuizzesForNode(
          node,
          subject || 'Generale',
          level
        );
        
        resources.flashcards.push(...flashcards);
        resources.quizzes.push(...quizzes);
      }
    }
    
    // Salva mappa
    const mapData = {
      ...mindMap,
      resources,
      metadata: {
        ...mindMap.metadata,
        subject,
        level,
        userId,
        inputType: 'text',
        originalText: text.substring(0, 500),
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        views: 0,
        isPublic: false
      }
    };
    
    mapsStorage.set(mindMap.id, mapData);
    
    // Associa a utente
    if (userId) {
      if (!userMaps.has(userId)) {
        userMaps.set(userId, []);
      }
      userMaps.get(userId).push(mindMap.id);
    }
    
    res.json({
      success: true,
      mapId: mindMap.id,
      map: mapData,
      stats: {
        nodeCount: mindMap.nodes.length,
        connectionCount: mindMap.connections.length,
        flashcardCount: resources?.flashcards.length || 0,
        quizCount: resources?.quizzes.length || 0
      }
    });
    
  } catch (error) {
    console.error('Errore creazione mappa da testo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crea mappa da immagine
router.post('/create/image', upload.single('image'), async (req, res) => {
  try {
    const {
      subject,
      level = 'intermedio',
      detailLevel = 'normal',
      generateResources = true,
      userId
    } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Immagine richiesta' });
    }
    
    // OCR
    const { data: { text } } = await Tesseract.recognize(
      req.file.buffer,
      'ita',
      { logger: m => console.log(m) }
    );
    
    if (!text || text.length < 50) {
      return res.status(400).json({ 
        error: 'Testo estratto insufficiente. Assicurati che l\'immagine sia chiara e contenga testo leggibile.' 
      });
    }
    
    // Procedi come per il testo
    const analysis = semanticAnalyzer.analyze(text, {
      subject,
      level,
      maxConcepts: detailLevel === 'detailed' ? 20 : 10
    });
    
    const mindMap = mapGenerator.generateMindMap(analysis, {
      detailLevel,
      maxNodes: detailLevel === 'minimal' ? 6 : detailLevel === 'detailed' ? 12 : 8
    });
    
    let resources = null;
    if (generateResources) {
      resources = {
        flashcards: [],
        quizzes: []
      };
      
      for (const node of mindMap.nodes) {
        const flashcards = resourcesGenerator.generateFlashcardsForNode(
          node,
          subject || 'Generale',
          level
        );
        const quizzes = resourcesGenerator.generateQuizzesForNode(
          node,
          subject || 'Generale',
          level
        );
        
        resources.flashcards.push(...flashcards);
        resources.quizzes.push(...quizzes);
      }
    }
    
    const mapData = {
      ...mindMap,
      resources,
      metadata: {
        ...mindMap.metadata,
        subject,
        level,
        userId,
        inputType: 'image',
        ocrText: text.substring(0, 500),
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        views: 0,
        isPublic: false
      }
    };
    
    mapsStorage.set(mindMap.id, mapData);
    
    if (userId) {
      if (!userMaps.has(userId)) {
        userMaps.set(userId, []);
      }
      userMaps.get(userId).push(mindMap.id);
    }
    
    res.json({
      success: true,
      mapId: mindMap.id,
      map: mapData,
      extractedText: text.substring(0, 200) + '...',
      stats: {
        nodeCount: mindMap.nodes.length,
        connectionCount: mindMap.connections.length,
        flashcardCount: resources?.flashcards.length || 0,
        quizCount: resources?.quizzes.length || 0
      }
    });
    
  } catch (error) {
    console.error('Errore creazione mappa da immagine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crea mappa da PDF
router.post('/create/pdf', upload.single('pdf'), async (req, res) => {
  try {
    const {
      subject,
      level = 'intermedio',
      detailLevel = 'normal',
      generateResources = true,
      userId
    } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'PDF richiesto' });
    }
    
    // Estrazione da PDF (semplificata)
    async function processPDF(pdfBuffer) {
      try {
        // Per ora ritorna messaggio - implementazione PDF complessa
        return 'Testo estratto da PDF - funzionalità in sviluppo. Usa testo o immagini per ora.';
      } catch (error) {
        throw new Error(`Errore estrazione PDF: ${error.message}`);
      }
    }
    
    const text = await processPDF(req.file.buffer);
    
    if (!text || text.length < 50) {
      return res.status(400).json({ 
        error: 'Testo estratto dal PDF insufficiente.' 
      });
    }
    
    // Procedi come per il testo
    const analysis = semanticAnalyzer.analyze(text, {
      subject,
      level,
      maxConcepts: detailLevel === 'detailed' ? 20 : 10
    });
    
    const mindMap = mapGenerator.generateMindMap(analysis, {
      detailLevel,
      maxNodes: detailLevel === 'minimal' ? 6 : detailLevel === 'detailed' ? 12 : 8
    });
    
    let resources = null;
    if (generateResources) {
      resources = {
        flashcards: [],
        quizzes: []
      };
      
      for (const node of mindMap.nodes) {
        const flashcards = resourcesGenerator.generateFlashcardsForNode(
          node,
          subject || 'Generale',
          level
        );
        const quizzes = resourcesGenerator.generateQuizzesForNode(
          node,
          subject || 'Generale',
          level
        );
        
        resources.flashcards.push(...flashcards);
        resources.quizzes.push(...quizzes);
      }
    }
    
    const mapData = {
      ...mindMap,
      resources,
      metadata: {
        ...mindMap.metadata,
        subject,
        level,
        userId,
        inputType: 'pdf',
        pdfInfo: { title: 'PDF Document' },
        pageCount: 1,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        views: 0,
        isPublic: false
      }
    };
    
    mapsStorage.set(mindMap.id, mapData);
    
    if (userId) {
      if (!userMaps.has(userId)) {
        userMaps.set(userId, []);
      }
      userMaps.get(userId).push(mindMap.id);
    }
    
    res.json({
      success: true,
      mapId: mindMap.id,
      map: mapData,
      pdfInfo: {
        pages: 1,
        title: 'PDF Document'
      },
      stats: {
        nodeCount: mindMap.nodes.length,
        connectionCount: mindMap.connections.length,
        flashcardCount: resources?.flashcards.length || 0,
        quizCount: resources?.quizzes.length || 0
      }
    });
    
  } catch (error) {
    console.error('Errore creazione mappa da PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GESTIONE MAPPE ====================

// Ottieni mappa per ID
router.get('/:mapId', (req, res) => {
  const { mapId } = req.params;
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  // Incrementa visualizzazioni
  map.metadata.views++;
  
  res.json({
    success: true,
    map
  });
});

// Aggiorna mappa
router.put('/:mapId', (req, res) => {
  const { mapId } = req.params;
  const updates = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  // Aggiorna nodi
  if (updates.nodes) {
    map.nodes = updates.nodes;
  }
  
  // Aggiorna connessioni
  if (updates.connections) {
    map.connections = updates.connections;
  }
  
  // Aggiorna metadata
  if (updates.metadata) {
    map.metadata = { ...map.metadata, ...updates.metadata };
  }
  
  map.metadata.lastModified = new Date().toISOString();
  
  mapsStorage.set(mapId, map);
  
  res.json({
    success: true,
    map
  });
});

// Elimina mappa
router.delete('/:mapId', (req, res) => {
  const { mapId } = req.params;
  const { userId } = req.body;
  
  if (!mapsStorage.has(mapId)) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  // Rimuovi da storage
  mapsStorage.delete(mapId);
  
  // Rimuovi da user maps
  if (userId && userMaps.has(userId)) {
    const maps = userMaps.get(userId);
    const index = maps.indexOf(mapId);
    if (index > -1) {
      maps.splice(index, 1);
    }
  }
  
  // Rimuovi da public maps
  publicMaps.delete(mapId);
  
  res.json({
    success: true,
    message: 'Mappa eliminata con successo'
  });
});

// ==================== NODI E CONNESSIONI ====================

// Aggiungi nodo
router.post('/:mapId/nodes', (req, res) => {
  const { mapId } = req.params;
  const { node } = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  const newNode = {
    id: uuidv4(),
    ...node
  };
  
  map.nodes.push(newNode);
  map.metadata.lastModified = new Date().toISOString();
  
  res.json({
    success: true,
    node: newNode,
    map
  });
});

// Aggiorna nodo
router.put('/:mapId/nodes/:nodeId', (req, res) => {
  const { mapId, nodeId } = req.params;
  const updates = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  const nodeIndex = map.nodes.findIndex(n => n.id === nodeId);
  
  if (nodeIndex === -1) {
    return res.status(404).json({ error: 'Nodo non trovato' });
  }
  
  map.nodes[nodeIndex] = { ...map.nodes[nodeIndex], ...updates };
  map.metadata.lastModified = new Date().toISOString();
  
  res.json({
    success: true,
    node: map.nodes[nodeIndex],
    map
  });
});

// Elimina nodo
router.delete('/:mapId/nodes/:nodeId', (req, res) => {
  const { mapId, nodeId } = req.params;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  // Rimuovi nodo
  map.nodes = map.nodes.filter(n => n.id !== nodeId);
  
  // Rimuovi connessioni collegate
  map.connections = map.connections.filter(c => 
    c.from !== nodeId && c.to !== nodeId
  );
  
  map.metadata.lastModified = new Date().toISOString();
  
  res.json({
    success: true,
    map
  });
});

// Aggiungi connessione
router.post('/:mapId/connections', (req, res) => {
  const { mapId } = req.params;
  const { connection } = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  const newConnection = {
    id: uuidv4(),
    ...connection
  };
  
  map.connections.push(newConnection);
  map.metadata.lastModified = new Date().toISOString();
  
  res.json({
    success: true,
    connection: newConnection,
    map
  });
});

// ==================== RISORSE APPRENDIMENTO ====================

// Genera flashcards per nodo
router.post('/:mapId/nodes/:nodeId/flashcards', (req, res) => {
  const { mapId, nodeId } = req.params;
  const { count = 5, difficulty = 'intermedio' } = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  const node = map.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return res.status(404).json({ error: 'Nodo non trovato' });
  }
  
  const flashcards = resourcesGenerator.generateFlashcardsForNode(
    node,
    map.metadata.subject || 'Generale',
    map.metadata.level || 'intermedio',
    count
  );
  
  // Aggiungi a risorse della mappa
  if (!map.resources) {
    map.resources = { flashcards: [], quizzes: [] };
  }
  map.resources.flashcards.push(...flashcards);
  
  res.json({
    success: true,
    flashcards,
    totalFlashcards: map.resources.flashcards.length
  });
});

// Genera quiz per nodo
router.post('/:mapId/nodes/:nodeId/quizzes', (req, res) => {
  const { mapId, nodeId } = req.params;
  const { count = 5, types = ['multiple_choice', 'true_false'] } = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  const node = map.nodes.find(n => n.id === nodeId);
  
  if (!node) {
    return res.status(404).json({ error: 'Nodo non trovato' });
  }
  
  const quizzes = resourcesGenerator.generateQuizzesForNode(
    node,
    map.metadata.subject || 'Generale',
    map.metadata.level || 'intermedio',
    count
  );
  
  // Filtra per tipi richiesti
  const filteredQuizzes = quizzes.filter(q => types.includes(q.type));
  
  // Aggiungi a risorse della mappa
  if (!map.resources) {
    map.resources = { flashcards: [], quizzes: [] };
  }
  map.resources.quizzes.push(...filteredQuizzes);
  
  res.json({
    success: true,
    quizzes: filteredQuizzes,
    totalQuizzes: map.resources.quizzes.length
  });
});

// ==================== USER MAPS ====================

// Ottieni mappe utente
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { 
    subject, 
    level,
    sortBy = 'created',
    order = 'desc',
    limit = 20,
    offset = 0
  } = req.query;
  
  const mapIds = userMaps.get(userId) || [];
  let maps = mapIds.map(id => mapsStorage.get(id)).filter(Boolean);
  
  // Filtra per materia
  if (subject) {
    maps = maps.filter(m => m.metadata.subject === subject);
  }
  
  // Filtra per livello
  if (level) {
    maps = maps.filter(m => m.metadata.level === level);
  }
  
  // Ordina
  maps.sort((a, b) => {
    const aVal = a.metadata[sortBy];
    const bVal = b.metadata[sortBy];
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });
  
  // Paginazione
  const paginatedMaps = maps.slice(offset, offset + limit);
  
  res.json({
    success: true,
    maps: paginatedMaps,
    total: maps.length,
    hasMore: offset + limit < maps.length
  });
});

// ==================== CONDIVISIONE ====================

// Rendi pubblica una mappa
router.post('/:mapId/publish', (req, res) => {
  const { mapId } = req.params;
  const { userId, tags = [] } = req.body;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  // Verifica proprietà
  if (map.metadata.userId !== userId) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }
  
  map.metadata.isPublic = true;
  map.metadata.tags = tags;
  map.metadata.publishedAt = new Date().toISOString();
  
  publicMaps.add(mapId);
  
  res.json({
    success: true,
    message: 'Mappa pubblicata con successo',
    shareUrl: `/maps/public/${mapId}`
  });
});

// Ottieni mappe pubbliche
router.get('/public', (req, res) => {
  const { 
    subject,
    level,
    search,
    sortBy = 'views',
    limit = 20,
    offset = 0
  } = req.query;
  
  let maps = Array.from(publicMaps)
    .map(id => mapsStorage.get(id))
    .filter(Boolean);
  
  // Filtra per materia
  if (subject) {
    maps = maps.filter(m => m.metadata.subject === subject);
  }
  
  // Filtra per livello
  if (level) {
    maps = maps.filter(m => m.metadata.level === level);
  }
  
  // Ricerca testuale
  if (search) {
    const searchLower = search.toLowerCase();
    maps = maps.filter(m => 
      m.metadata.tags?.some(t => t.toLowerCase().includes(searchLower)) ||
      m.nodes.some(n => n.text.toLowerCase().includes(searchLower))
    );
  }
  
  // Ordina
  maps.sort((a, b) => {
    const aVal = a.metadata[sortBy] || 0;
    const bVal = b.metadata[sortBy] || 0;
    return bVal - aVal;
  });
  
  // Paginazione
  const paginatedMaps = maps.slice(offset, offset + limit);
  
  res.json({
    success: true,
    maps: paginatedMaps,
    total: maps.length,
    hasMore: offset + limit < maps.length
  });
});

// ==================== EXPORT ====================

// Esporta mappa in vari formati
router.get('/:mapId/export', (req, res) => {
  const { mapId } = req.params;
  const { format = 'json' } = req.query;
  
  const map = mapsStorage.get(mapId);
  
  if (!map) {
    return res.status(404).json({ error: 'Mappa non trovata' });
  }
  
  switch (format) {
    case 'json':
      res.json(map);
      break;
      
    case 'opml':
      // Genera OPML
      const opml = generateOPML(map);
      res.set('Content-Type', 'text/x-opml');
      res.send(opml);
      break;
      
    case 'csv':
      // Genera CSV per flashcards/quiz
      const csv = generateCSV(map.resources);
      res.set('Content-Type', 'text/csv');
      res.send(csv);
      break;
      
    default:
      res.status(400).json({ error: 'Formato non supportato' });
  }
});

// Helper functions
function generateOPML(map) {
  let opml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  opml += '<opml version="2.0">\n';
  opml += '<head><title>Mind Map Export</title></head>\n';
  opml += '<body>\n';
  
  // Trova nodo centrale
  const centralNode = map.nodes.find(n => n.level === 0);
  if (centralNode) {
    opml += `<outline text="${centralNode.text}">\n`;
    
    // Aggiungi nodi figli
    map.nodes.filter(n => n.level === 1).forEach(node => {
      opml += `  <outline text="${node.text}">\n`;
      
      // Aggiungi sotto-nodi
      map.nodes.filter(n => n.parentId === node.id).forEach(subNode => {
        opml += `    <outline text="${subNode.text}"/>\n`;
      });
      
      opml += '  </outline>\n';
    });
    
    opml += '</outline>\n';
  }
  
  opml += '</body>\n</opml>';
  return opml;
}

function generateCSV(resources) {
  if (!resources) return '';
  
  let csv = 'Type,Front,Back,Difficulty,Tags\n';
  
  // Flashcards
  if (resources.flashcards) {
    resources.flashcards.forEach(card => {
      csv += `Flashcard,"${card.front}","${card.back}",${card.difficulty},"${card.tags?.join(';')}"\n`;
    });
  }
  
  // Quiz
  if (resources.quizzes) {
    resources.quizzes.forEach(quiz => {
      csv += `Quiz,"${quiz.question}","${quiz.explanation}",${quiz.difficulty},"${quiz.tags?.join(';')}"\n`;
    });
  }
  
  return csv;
}

module.exports = router;
