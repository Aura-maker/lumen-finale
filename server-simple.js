// SERVER BACKEND SEMPLIFICATO
// Senza Prisma per evitare problemi di compatibilità

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const IntegrationLoader = require('./integration-loader');

// IMPORTA GENERATORI ESAMI ORIGINALI
const GeneratoreEsamiMatematica = require('../files/src/services/esami-matematica-generator');
const GeneratoreEsamiMatematicaAvanzato = require('../files/src/services/esami-matematica-avanzato');
const GeneratoreEsamiItaliano = require('../files/src/services/esami-italiano-generator');
const GeneratoreEsamiItalianoAvanzato = require('../files/src/services/esami-italiano-avanzato');

// Inizializza i generatori originali
const generatoreMatematica = new GeneratoreEsamiMatematica();
const generatoreMatematicaAvanzato = new GeneratoreEsamiMatematicaAvanzato();
const generatoreItaliano = new GeneratoreEsamiItaliano();
const generatoreItalianoAvanzato = new GeneratoreEsamiItalianoAvanzato();

// Genera le 400 simulazioni originali
generatoreMatematica.genera(100); // 100 esami base
generatoreMatematicaAvanzato.genera(100); // 100 esami avanzati
generatoreItaliano.genera(100); // 100 esami base  
generatoreItalianoAvanzato.genera(100); // 100 esami avanzati
console.log('✅ 400 esami maturità pronti! (200 Matematica + 200 Italiano)');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Percorso ai contenuti
const CONTENT_PATH = path.join(__dirname, '..', 'files', 'src', 'data');
const integrationLoader = new IntegrationLoader(CONTENT_PATH);

console.log('📁 Percorso contenuti:', CONTENT_PATH);

// Inizializza sistema completo
integrationLoader.loadEverything().then(() => {
  console.log('✅ Sistema completamente inizializzato');
}).catch(error => {
  console.error('❌ Errore inizializzazione sistema:', error);
});

// Import routes mappe intelligenti
const intelligentMapsRoutes = require('./routes/intelligent-maps');
app.use('/api/intelligent-maps', intelligentMapsRoutes);

// ROUTE: Ottieni lista materie (caricate dinamicamente)
app.get('/api/subjects', (req, res) => {
  try {
    // Ottieni tutte le materie disponibili dall'IntegrationLoader
    const availableSubjects = integrationLoader.getAllSubjects();
    
    const subjectIcons = {
      'filosofia': '📙',
      'matematica': '🧮', 
      'fisica': '⚛️',
      'storia': '🏛️',
      'italiano': '📚',
      'arte': '🎨',
      'scienze': '�',
      'inglese': '🌍',
      'latino': '🏛️',
      'religione': '✝️'
    };
    
    const subjects = availableSubjects.map(subject => ({
      id: subject,
      name: subject.charAt(0).toUpperCase() + subject.slice(1),
      icon: subjectIcons[subject] || '📖',
      hasContent: true,
      argomentiCount: integrationLoader.getSubjectContent(subject)?.argomenti?.length || 0
    }));
    
    console.log(`📚 Materie caricate: ${subjects.length}`);
    subjects.forEach(s => console.log(`  - ${s.name}: ${s.argomentiCount} argomenti`));
    
    res.json(subjects);
  } catch (error) {
    console.error('❌ Errore lista materie:', error);
    res.status(500).json({ error: 'Errore server' });
  }
});

// ROUTE: Ottieni contenuto materia
app.get('/api/content/:subject', (req, res) => {
  try {
    const { subject } = req.params;
    
    console.log(`📖 Caricando contenuto per: ${subject}`);
    
    // Ottieni contenuto dall'IntegrationLoader
    const contentData = integrationLoader.getSubjectContent(subject);
    
    if (!contentData) {
      console.log(`⚠️ Contenuto non trovato per: ${subject}`);
      return res.status(404).json({ error: 'Materia non trovata' });
    }
    
    console.log(`✅ Contenuto caricato: ${contentData.materia?.nome || contentData.materia} - ${contentData.argomenti?.length || 0} argomenti`);
    
    res.json(contentData);
  } catch (error) {
    console.error('❌ Errore caricamento contenuto:', error);
    res.status(500).json({ error: 'Errore caricamento contenuto' });
  }
});

// ROUTE: Ottieni argomento specifico
app.get('/api/content/:subject/:topicId', (req, res) => {
  try {
    const { subject, topicId } = req.params;
    const filePath = path.join(CONTENT_PATH, `contenuti-${subject}.js`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Materia non trovata' });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const match = fileContent.match(/export default\s*({[\s\S]*});?\s*$/);
    
    if (!match) {
      return res.status(400).json({ error: 'Formato file non valido' });
    }
    
    const contentData = eval(`(${match[1]})`);
    const topic = contentData.argomenti?.find(arg => 
      arg.id === topicId || arg.titolo.toLowerCase().replace(/\s+/g, '-') === topicId
    );
    
    if (!topic) {
      return res.status(404).json({ error: 'Argomento non trovato' });
    }
    
    res.json(topic);
  } catch (error) {
    console.error('❌ Errore caricamento argomento:', error);
    res.status(500).json({ error: 'Errore caricamento argomento' });
  }
});

// ROUTE: Genera quiz per argomento
app.post('/api/quiz/generate', (req, res) => {
  try {
    const { subject, topic, difficulty = 'medium', count = 5 } = req.body;
    
    // Ottieni quiz dall'IntegrationLoader
    const quizzes = integrationLoader.getSubjectQuizzes(subject);
    
    // Filtra per difficoltà se specificata
    let filteredQuizzes = quizzes;
    if (difficulty !== 'all') {
      filteredQuizzes = quizzes.filter(q => q.difficulty === difficulty);
    }
    
    // Limita il numero
    const selectedQuizzes = filteredQuizzes.slice(0, count);
    
    res.json({
      subject,
      topic,
      difficulty,
      questions: selectedQuizzes,
      total: quizzes.length,
      available: filteredQuizzes.length
    });
  } catch (error) {
    console.error('❌ Errore generazione quiz:', error);
    res.status(500).json({ error: 'Errore generazione quiz' });
  }
});

// ROUTE: Ottieni tutti i quiz per materia
app.get('/api/quiz/:subject', (req, res) => {
  try {
    const { subject } = req.params;
    const { difficulty, limit = 20, offset = 0 } = req.query;
    
    let quizzes = integrationLoader.getSubjectQuizzes(subject);
    
    if (!quizzes || quizzes.length === 0) {
      return res.status(404).json({ error: 'Quiz non trovati per questa materia' });
    }
    
    // Filtra per difficoltà se specificata
    if (difficulty && difficulty !== 'all') {
      quizzes = quizzes.filter(q => q.difficulty === difficulty);
    }
    
    // Paginazione
    const total = quizzes.length;
    const paginatedQuizzes = quizzes.slice(offset, offset + parseInt(limit));
    
    res.json({
      subject,
      total,
      count: paginatedQuizzes.length,
      quizzes: paginatedQuizzes,
      hasMore: offset + parseInt(limit) < total
    });
  } catch (error) {
    console.error('❌ Errore caricamento quiz:', error);
    res.status(500).json({ error: 'Errore caricamento quiz' });
  }
});

// ROUTE: Ottieni flashcards per materia
app.get('/api/flashcards/:subject', (req, res) => {
  try {
    const { subject } = req.params;
    const flashcards = integrationLoader.getSubjectFlashcards(subject);
    
    if (!flashcards) {
      return res.status(404).json({ error: 'Flashcards non trovate per questa materia' });
    }
    
    res.json({
      subject,
      count: Array.isArray(flashcards) ? flashcards.length : Object.keys(flashcards).length,
      flashcards
    });
  } catch (error) {
    console.error('❌ Errore caricamento flashcards:', error);
    res.status(500).json({ error: 'Errore caricamento flashcards' });
  }
});

// ROUTE: Ottieni statistiche complete sistema
app.get('/api/stats', (req, res) => {
  try {
    const subjects = integrationLoader.getAllSubjects();
    const stats = {
      totalSubjects: subjects.length,
      subjects: {},
      totals: {
        topics: 0,
        quizzes: 0,
        flashcards: 0,
        exams: 400 // Matematica + Italiano
      }
    };
    
    subjects.forEach(subject => {
      const content = integrationLoader.getSubjectContent(subject);
      const quizzes = integrationLoader.getSubjectQuizzes(subject);
      const flashcards = integrationLoader.getSubjectFlashcards(subject);
      
      stats.subjects[subject] = {
        name: subject.charAt(0).toUpperCase() + subject.slice(1),
        topics: content?.argomenti?.length || 0,
        quizzes: quizzes?.length || 0,
        flashcards: Array.isArray(flashcards) ? flashcards.length : (flashcards ? Object.keys(flashcards).length : 0),
        hasContent: !!content
      };
      
      stats.totals.topics += stats.subjects[subject].topics;
      stats.totals.quizzes += stats.subjects[subject].quizzes;
      stats.totals.flashcards += stats.subjects[subject].flashcards;
    });
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Errore statistiche:', error);
    res.status(500).json({ error: 'Errore caricamento statistiche' });
  }
});

// ROUTE: Salva progresso utente
app.post('/api/progress/save', (req, res) => {
  try {
    const { userId, subject, topic, score, timeSpent } = req.body;
    
    // Simula salvataggio progresso
    console.log(`💾 Progresso salvato: User ${userId}, ${subject}/${topic}, Score: ${score}`);
    
    res.json({ 
      success: true, 
      message: 'Progresso salvato',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Errore salvataggio progresso:', error);
    res.status(500).json({ error: 'Errore salvataggio progresso' });
  }
});

// ROUTE: API materie (compatibilità frontend)
app.get('/api/materie', (req, res) => {
  try {
    const subjects = integrationLoader.getAllSubjects();
    
    const subjectIcons = {
      'filosofia': '📙',
      'matematica': '🧮', 
      'fisica': '⚛️',
      'storia': '🏛️',
      'italiano': '📚',
      'arte': '🎨',
      'scienze': '🔬',
      'inglese': '🌍',
      'latino': '🏛️',
      'religione': '✝️'
    };
    
    const materie = subjects.map(subject => ({
      id: subject,
      nome: subject.charAt(0).toUpperCase() + subject.slice(1),
      icona: subjectIcons[subject] || '📖',
      colore: '#667eea',
      argomenti: integrationLoader.getSubjectContent(subject)?.argomenti?.length || 0
    }));
    
    res.json(materie);
  } catch (error) {
    console.error('❌ Errore API materie:', error);
    res.status(500).json({ error: 'Errore caricamento materie' });
  }
});

// ROUTE: Contenuti materie (compatibilità frontend)
app.get('/api/contenuti/materie', (req, res) => {
  try {
    const materie = integrationLoader.getAllSubjects();
    const materieArray = materie.map(materia => {
      const content = integrationLoader.getSubjectContent(materia);
      return {
        id: materia,
        nome: content?.materia?.nome || materia.charAt(0).toUpperCase() + materia.slice(1),
        descrizione: content?.materia?.descrizione || `Contenuti completi di ${materia}`,
        argomenti: content?.argomenti || []
      };
    });
    
    res.json(materieArray);
  } catch (error) {
    console.error('❌ Errore contenuti materie:', error);
    res.status(500).json({ error: 'Errore caricamento contenuti' });
  }
});

// ROUTE: Contenuti singola materia
app.get('/api/contenuti/:materia', (req, res) => {
  try {
    const { materia } = req.params;
    const content = integrationLoader.getSubjectContent(materia);
    
    if (!content) {
      return res.status(404).json({ error: 'Materia non trovata' });
    }
    
    res.json(content);
  } catch (error) {
    console.error('❌ Errore contenuto materia:', error);
    res.status(500).json({ error: 'Errore caricamento contenuto' });
  }
});

// ROUTE: API contenuti materie (compatibilità)
app.get('/api/contenuti/materie', (req, res) => {
  try {
    const subjects = integrationLoader.getAllSubjects();
    
    const materie = subjects.map(subject => {
      const content = integrationLoader.getSubjectContent(subject);
      return {
        id: subject,
        nome: subject.charAt(0).toUpperCase() + subject.slice(1),
        descrizione: `Contenuti completi di ${subject}`,
        argomenti: content?.argomenti || [],
        totaleArgomenti: content?.argomenti?.length || 0,
        quiz: integrationLoader.getSubjectQuizzes(subject).length,
        flashcards: integrationLoader.getSubjectFlashcards(subject) ? 
          (Array.isArray(integrationLoader.getSubjectFlashcards(subject)) ? 
            integrationLoader.getSubjectFlashcards(subject).length : 
            Object.keys(integrationLoader.getSubjectFlashcards(subject)).length) : 0
      };
    });
    
    res.json(materie);
  } catch (error) {
    console.error('❌ Errore API contenuti materie:', error);
    res.status(500).json({ error: 'Errore caricamento contenuti materie' });
  }
});

// ROUTE: Contenuto materia specifica (compatibilità)
app.get('/api/contenuti/:materia', (req, res) => {
  try {
    const { materia } = req.params;
    const content = integrationLoader.getSubjectContent(materia);
    
    if (!content) {
      return res.status(404).json({ error: 'Materia non trovata' });
    }
    
    res.json({
      materia: {
        id: materia,
        nome: materia.charAt(0).toUpperCase() + materia.slice(1)
      },
      argomenti: content.argomenti || [],
      totaleArgomenti: content.argomenti?.length || 0
    });
  } catch (error) {
    console.error('❌ Errore contenuto materia:', error);
    res.status(500).json({ error: 'Errore caricamento contenuto materia' });
  }
});

// ROUTE: Gamification dashboard (compatibilità)
app.get('/api/gamification/dashboard', (req, res) => {
  try {
    res.json({
      badges: [
        { 
          id: 'primo_quiz', 
          nome: 'Primo Quiz', 
          descrizione: 'Completa il tuo primo quiz', 
          sbloccato: true,
          icona: '🎯',
          punti: 10
        },
        { 
          id: 'studioso', 
          nome: 'Studioso', 
          descrizione: 'Studia per 7 giorni consecutivi', 
          sbloccato: false,
          icona: '📚',
          punti: 50
        },
        { 
          id: 'esperto', 
          nome: 'Esperto', 
          descrizione: 'Ottieni 100% in 5 quiz', 
          sbloccato: false,
          icona: '🏆',
          punti: 100
        }
      ],
      xp: 150,
      xpTotale: 150,
      livello: 2,
      livelloGlobale: 2,
      titoloLivello: '🌿 Studente',
      streak: 3,
      streakMassimo: 7,
      puntiTotali: 150,
      prossimoBadge: {
        nome: 'Studioso',
        progressoCorrente: 3,
        progressoRichiesto: 7,
        descrizione: 'Studia per 7 giorni consecutivi'
      },
      statistiche: {
        quizCompletati: 12,
        quizTotali: 45,
        tempoStudio: 240,
        tempoStudioOggi: 30,
        argomentiSbloccati: 8,
        argomentiTotali: 67,
        mappeCreate: 3,
        simulazioniCompletate: 2,
        flashcardsStudiate: 25,
        accuratezzaMedia: 78.5
      },
      progressoLivello: {
        xpCorrente: 150,
        xpProssimoLivello: 200,
        percentuale: 75
      },
      attivitaRecenti: [
        {
          tipo: 'quiz',
          materia: 'Filosofia',
          argomento: 'Illuminismo',
          punteggio: 85,
          timestamp: new Date().toISOString()
        },
        {
          tipo: 'mappa',
          titolo: 'Mappa Concettuale Storia',
          nodi: 8,
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      profilo: {
        id: 'user123',
        xpTotale: 150,
        livelloGlobale: 2,
        titoloLivello: '🌿 Studente',
        streak: 3,
        badge: ['primo_quiz'],
        materie: {
          filosofia: { livello: 2, xp: 50 },
          matematica: { livello: 1, xp: 30 },
          storia: { livello: 1, xp: 25 }
        },
        statistiche: {
          tempoStudioTotale: 240,
          quizCompletati: 12,
          quizCorretti: 9,
          accuratezzaMedia: 78.5
        },
        obiettiviSettimanali: {
          tempoStudio: { target: 300, progresso: 240 },
          quiz: { target: 20, progresso: 12 },
          flashcard: { target: 100, progresso: 25 },
          streak: { target: 7, progresso: 3 }
        },
        progressoLivello: {
          xpAttuali: 150,
          xpNecessari: 200,
          percentuale: 75
        }
      }
    });
  } catch (error) {
    console.error('❌ Errore gamification dashboard:', error);
    res.status(500).json({ error: 'Errore caricamento dashboard' });
  }
});

// ROUTE: Gamification profilo (compatibilità)
app.get('/api/gamification/profilo', (req, res) => {
  try {
    res.json({
      id: 'user123',
      nome: 'Studente',
      livello: 2,
      xp: 150,
      streak: 3,
      badges: ['primo_quiz'],
      statistiche: {
        quizCompletati: 12,
        tempoStudio: 240,
        accuratezzaMedia: 78.5
      },
      preferenze: {
        materie: ['filosofia', 'matematica', 'storia'],
        difficolta: 'intermedio'
      }
    });
  } catch (error) {
    console.error('❌ Errore profilo gamification:', error);
    res.status(500).json({ error: 'Errore caricamento profilo' });
  }
});

// ROUTE: Gamification notifiche (compatibilità)
app.get('/api/gamification/notifiche', (req, res) => {
  try {
    res.json([
      {
        id: 1,
        tipo: 'quiz_completato',
        titolo: 'Quiz Completato',
        messaggio: 'Hai completato il quiz di Filosofia!',
        xp: 15,
        timestamp: new Date().toISOString(),
        letta: false
      },
      {
        id: 2,
        tipo: 'badge_sbloccato',
        titolo: 'Nuovo Badge',
        messaggio: 'Hai sbloccato il badge "Primo Quiz"!',
        xp: 10,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        letta: false
      },
      {
        id: 3,
        tipo: 'streak_aggiornato',
        titolo: 'Streak Attivo',
        messaggio: 'Hai mantenuto lo streak per 3 giorni!',
        xp: 5,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        letta: true
      }
    ]);
  } catch (error) {
    console.error('❌ Errore notifiche gamification:', error);
    res.status(500).json({ error: 'Errore caricamento notifiche' });
  }
});

// ROUTE: Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server backend attivo'
  });
});

// ========================================
// ESAMI ORIGINALI - 400 SIMULAZIONI
// ========================================

// ROUTE: Lista esami matematica (200 esami)
app.get('/api/esami/matematica', (req, res) => {
  try {
    const esamiBase = generatoreMatematica.esami.map(e => ({...e, livello: 'base'}));
    const esamiAvanzati = generatoreMatematicaAvanzato.esami.map(e => ({...e, livello: 'avanzato'}));
    const tuttiEsami = [...esamiBase, ...esamiAvanzati];
    
    const esami = tuttiEsami.map(e => ({
      id: e.id,
      titolo: e.titolo,
      sottotitolo: e.sottotitolo,
      durata: e.durata,
      struttura: e.struttura,
      livello: e.livello,
      difficolta: e.metadata?.difficolta || 'standard'
    }));
    
    res.json({
      totale: esami.length,
      esami
    });
  } catch (error) {
    console.error('❌ Errore esami matematica:', error);
    res.status(500).json({ error: 'Errore esami matematica' });
  }
});

// ROUTE: Esame matematica casuale
app.get('/api/esami/matematica/casuale', (req, res) => {
  try {
    const useAvanzato = Math.random() > 0.5;
    const esame = useAvanzato ? 
      generatoreMatematicaAvanzato.getEsameCasuale() : 
      generatoreMatematica.getEsameCasuale();
    res.json(esame);
  } catch (error) {
    console.error('❌ Errore esame casuale matematica:', error);
    res.status(500).json({ error: 'Errore esame casuale matematica' });
  }
});

// ROUTE: Esame matematica specifico
app.get('/api/esami/matematica/:id', (req, res) => {
  try {
    let esame = generatoreMatematica.getEsame(req.params.id);
    if (!esame) {
      esame = generatoreMatematicaAvanzato.getEsame(req.params.id);
    }
    
    if (!esame) {
      return res.status(404).json({ error: 'Esame non trovato' });
    }
    
    res.json(esame);
  } catch (error) {
    console.error('❌ Errore esame matematica:', error);
    res.status(500).json({ error: 'Errore esame matematica' });
  }
});

// ROUTE: Lista esami italiano (200 esami)
app.get('/api/esami/italiano', (req, res) => {
  try {
    const esamiBase = generatoreItaliano.esami.map(e => ({...e, livello: 'base'}));
    const esamiAvanzati = generatoreItalianoAvanzato.esami.map(e => ({...e, livello: 'avanzato'}));
    const tuttiEsami = [...esamiBase, ...esamiAvanzati];
    
    const esami = tuttiEsami.map(e => ({
      id: e.id,
      titolo: e.titolo,
      sottotitolo: e.sottotitolo,
      durata: e.durata,
      livello: e.livello,
      difficolta: e.metadata?.difficolta || 'standard',
      tracce: e.tracce.map(t => ({
        tipologia: t.tipologia,
        titolo: t.titolo
      }))
    }));
    
    res.json({
      totale: esami.length,
      esami
    });
  } catch (error) {
    console.error('❌ Errore esami italiano:', error);
    res.status(500).json({ error: 'Errore esami italiano' });
  }
});

// ROUTE: Esame italiano casuale
app.get('/api/esami/italiano/casuale', (req, res) => {
  try {
    const useAvanzato = Math.random() > 0.5;
    const esame = useAvanzato ? 
      generatoreItalianoAvanzato.getEsameCasuale() : 
      generatoreItaliano.getEsameCasuale();
    res.json(esame);
  } catch (error) {
    console.error('❌ Errore esame casuale italiano:', error);
    res.status(500).json({ error: 'Errore esame casuale italiano' });
  }
});

// ROUTE: Esame italiano specifico
app.get('/api/esami/italiano/:id', (req, res) => {
  try {
    let esame = generatoreItaliano.getEsame(req.params.id);
    if (!esame) {
      esame = generatoreItalianoAvanzato.getEsame(req.params.id);
    }
    
    if (!esame) {
      return res.status(404).json({ error: 'Esame non trovato' });
    }
    
    res.json(esame);
  } catch (error) {
    console.error('❌ Errore esame italiano:', error);
    res.status(500).json({ error: 'Errore esame italiano' });
  }
});

// ROUTE: Statistiche esami
app.get('/api/esami/stats', (req, res) => {
  try {
    res.json({
      matematica: {
        totale: generatoreMatematica.esami.length + generatoreMatematicaAvanzato.esami.length,
        durata: '6 ore',
        struttura: '1 problema (su 2) + 4 quesiti (su 8)'
      },
      italiano: {
        totale: generatoreItaliano.esami.length + generatoreItalianoAvanzato.esami.length,
        durata: '6 ore',
        struttura: '1 traccia (A1, A2, B, C)'
      },
      totaleEsami: generatoreMatematica.esami.length + generatoreMatematicaAvanzato.esami.length + generatoreItaliano.esami.length + generatoreItalianoAvanzato.esami.length
    });
  } catch (error) {
    console.error('❌ Errore statistiche esami:', error);
    res.status(500).json({ error: 'Errore statistiche esami' });
  }
});

// ROUTE: Ottieni flashcards per materia
app.get('/api/flashcards/:subject', (req, res) => {
  try {
    const { subject } = req.params;
    const flashcards = integrationLoader.getSubjectFlashcards(subject);
    
    if (!flashcards) {
      return res.status(404).json({ error: 'Flashcards non trovate per questa materia' });
    }
    
    res.json(flashcards);
  } catch (error) {
    console.error('❌ Errore caricamento flashcards:', error);
    res.status(500).json({ error: 'Errore caricamento flashcards' });
  }
});

// ROUTE: Ottieni tutti i quiz per materia
app.get('/api/quiz/:subject', (req, res) => {
  try {
    const { subject } = req.params;
    const quizzes = integrationLoader.getSubjectQuizzes(subject);
    
    res.json({
      subject,
      total: quizzes.length,
      quizzes: quizzes
    });
  } catch (error) {
    console.error('❌ Errore caricamento quiz materia:', error);
    res.status(500).json({ error: 'Errore caricamento quiz materia' });
  }
});

// ROUTE: Ottieni tutte le materie con contenuti
app.get('/api/subjects/complete', (req, res) => {
  try {
    const subjects = [];
    
    for (const [subjectId, content] of integrationLoader.allContent) {
      const quizzes = integrationLoader.getSubjectQuizzes(subjectId);
      const flashcards = integrationLoader.getSubjectFlashcards(subjectId);
      const simulations = integrationLoader.getSimulationsBySubject(subjectId);
      
      subjects.push({
        id: subjectId,
        name: integrationLoader.getSubjectDisplayName(subjectId),
        icon: getSubjectIcon(subjectId),
        color: getSubjectColor(subjectId),
        stats: {
          topics: content.argomenti ? content.argomenti.length : 0,
          subtopics: content.argomenti ? content.argomenti.reduce((sum, arg) => sum + (arg.sottoargomenti ? arg.sottoargomenti.length : 0), 0) : 0,
          quizzes: quizzes.length,
          flashcards: flashcards ? 1 : 0,
          simulations: simulations.length
        }
      });
    }
    
    res.json(subjects);
  } catch (error) {
    console.error('❌ Errore lista materie complete:', error);
    res.status(500).json({ error: 'Errore lista materie complete' });
  }
});

// ROUTE: Statistiche contenuti
app.get('/api/stats', (req, res) => {
  try {
    const stats = integrationLoader.getCompleteStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      status: 'active'
    });
  } catch (error) {
    console.error('❌ Errore statistiche:', error);
    res.status(500).json({ error: 'Errore statistiche' });
  }
});

// UTILITY FUNCTIONS
function getSubjectIcon(subject) {
  const icons = {
    filosofia: '📙',
    matematica: '🧮',
    fisica: '⚛️',
    storia: '🏛️',
    italiano: '📚',
    arte: '🎨',
    scienze: '🔬',
    inglese: '🌍',
    latino: '🏛️',
    religione: '✝️'
  };
  return icons[subject] || '📚';
}

function getSubjectColor(subject) {
  const colors = {
    filosofia: '#9C27B0',
    matematica: '#2196F3',
    fisica: '#4CAF50',
    storia: '#FF9800',
    italiano: '#E91E63',
    arte: '#673AB7',
    scienze: '#00BCD4',
    inglese: '#795548',
    latino: '#607D8B',
    religione: '#8BC34A'
  };
  return colors[subject] || '#667eea';
}

// Gestione errori globale
app.use((error, req, res, next) => {
  console.error('❌ Errore server:', error);
  res.status(500).json({ error: 'Errore interno del server' });
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Server backend avviato su porta ${PORT}`);
  console.log(`📡 API disponibili su http://localhost:${PORT}/api`);
  console.log(`📁 Contenuti caricati da: ${CONTENT_PATH}`);
  
  // Verifica contenuti disponibili
  try {
    const files = fs.readdirSync(CONTENT_PATH)
      .filter(file => file.startsWith('contenuti-') && file.endsWith('.js'));
    console.log(`📚 Contenuti trovati: ${files.length} materie`);
    files.forEach(file => console.log(`  - ${file}`));
  } catch (error) {
    console.log(`⚠️ Cartella contenuti non trovata: ${CONTENT_PATH}`);
  }
});

module.exports = app;
