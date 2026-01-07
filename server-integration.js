/**
 * 🔧 SERVER INTEGRATION
 * Integrazione delle nuove funzionalità AI nel server
 */

const express = require('express');
const cors = require('cors');

// Import routes avanzate
console.log('📂 Caricamento route AI...');
const aiAdvancedRoutes = require('./routes/ai-advanced-routes');
console.log('📂 Caricamento servizio estrai-crea...');
const estraiCreaService = require('./services/estrai-crea-service');
console.log('📂 Caricamento route stats...');
const statsRoutes = require('./routes/stats-routes');
console.log('📂 Caricamento route maturita...');
const maturitaRoutes = require('./routes/maturita-routes');
console.log('📂 Caricamento route search...');
const searchRoutes = require('./routes/search-routes');
console.log('✅ Import completati');

/**
 * Integra le nuove route AI nel server esistente
 * @param {Express.Application} app - L'app Express esistente
 */
async function integrateAIFeatures(app) {
  console.log('🚀 Inizializzazione funzionalità AI...');
  
  // Configurazione CORS per AI endpoints
  app.use('/api/ai', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Registra le route AI (sempre, anche se i servizi falliscono)
  app.use('/api/ai', aiAdvancedRoutes);
  
  // Registra nuove route per statistiche e maturità
  app.use('/api/stats', statsRoutes);
  app.use('/api/maturita', maturitaRoutes);
  app.use('/api/search', searchRoutes);
  
  console.log('✅ Route AI avanzate registrate su /api/ai/*');
  console.log('   🧪 Test OpenAI: /api/ai/test-openai');
  console.log('   📸 Estrai e Crea: /api/ai/estrai-crea');
  console.log('   🎯 Generazione Quiz: /api/ai/generate-quiz');
  console.log('   🎴 Generazione Flashcards: /api/ai/generate-flashcards');
  console.log('   📚 My Contents: /api/ai/my-contents');
  console.log('   🗺️ Intelligent Maps: /api/ai/maps');
  console.log('   📊 Dashboard: /api/ai/dashboard');
  console.log('✅ Route Statistiche registrate su /api/stats/*');
  console.log('   🍅 Pomodoro: /api/stats/pomodoro');
  console.log('   📊 Wrapped: /api/stats/wrapped/:period');
  console.log('   👤 Profile: /api/stats/profile');
  console.log('✅ Route Maturità registrate su /api/maturita/*');
  console.log('   🎓 Profilo: /api/maturita/profilo');
  console.log('   📚 Piano Ripasso: /api/maturita/piano-ripasso');
  console.log('   📝 Simulazioni: /api/maturita/simulazioni');
  console.log('✅ Route Search registrate su /api/search/*');
  console.log('   🔍 Global: /api/search/global');

  // Inizializza servizi AI in background (non bloccante)
  setTimeout(async () => {
    try {
      console.log('🔄 Inizializzazione servizi AI in background...');
      await estraiCreaService.initialize();
      console.log('✅ Servizi AI OCR inizializzati');
    } catch (error) {
      console.warn('⚠️ Servizi OCR non disponibili (funzionerà comunque con AI):', error.message);
    }
  }, 1000);
}

/**
 * Modifica il server-standalone.js per includere le nuove funzionalità
 * Aggiungi questa linea dopo le altre route:
 * 
 * require('./backend/server-integration').integrateAIFeatures(app);
 */

module.exports = {
  integrateAIFeatures
};
