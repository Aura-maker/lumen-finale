/**
 * 🎓 MATURITÀ ROUTES - Preparazione esame di stato
 * Endpoint per profilo maturità, piano ripasso, simulazioni
 */

const express = require('express');
const router = express.Router();

// Database helper
let db = null;
try {
  const { PrismaClient } = require('@prisma/client');
  db = new PrismaClient();
} catch (e) {
  console.log('⚠️ Prisma non disponibile per maturita-routes');
}

// Auth middleware
const authenticateUser = (req, res, next) => {
  req.userId = req.user?.id || req.headers['x-user-id'] || 'demo-user';
  next();
};

/**
 * GET /api/maturita/profilo
 * Recupera profilo maturità utente
 */
router.get('/profilo', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    let profilo = {
      indirizzo: 'scientifico',
      scuola: null,
      creditiTerzo: 0,
      creditiQuarto: 0,
      creditiQuinto: 0,
      obiettivoPunteggio: 80,
      materiePriorita: [],
      modalitaStudio: 'normale'
    };

    if (db) {
      try {
        const dbProfilo = await db.profiloMaturita.findUnique({
          where: { utenteId: userId }
        });
        if (dbProfilo) {
          profilo = {
            ...profilo,
            ...dbProfilo,
            materiePriorita: dbProfilo.materiePriorita || []
          };
        }
      } catch (e) {}
    }

    res.json(profilo);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maturita/profilo
 * Aggiorna profilo maturità
 */
router.post('/profilo', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      indirizzo, 
      scuola,
      creditiTerzo, 
      creditiQuarto, 
      creditiQuinto, 
      obiettivoPunteggio,
      materiePriorita,
      modalitaStudio 
    } = req.body;

    let profilo = req.body;

    if (db) {
      try {
        profilo = await db.profiloMaturita.upsert({
          where: { utenteId: userId },
          update: {
            indirizzo: indirizzo || undefined,
            scuola: scuola || undefined,
            creditiTerzo: creditiTerzo !== undefined ? parseInt(creditiTerzo) : undefined,
            creditiQuarto: creditiQuarto !== undefined ? parseInt(creditiQuarto) : undefined,
            creditiQuinto: creditiQuinto !== undefined ? parseInt(creditiQuinto) : undefined,
            obiettivoPunteggio: obiettivoPunteggio !== undefined ? parseInt(obiettivoPunteggio) : undefined,
            materiePriorita: materiePriorita || undefined,
            modalitaStudio: modalitaStudio || undefined
          },
          create: {
            utenteId: userId,
            indirizzo: indirizzo || 'scientifico',
            scuola,
            creditiTerzo: parseInt(creditiTerzo) || 0,
            creditiQuarto: parseInt(creditiQuarto) || 0,
            creditiQuinto: parseInt(creditiQuinto) || 0,
            obiettivoPunteggio: parseInt(obiettivoPunteggio) || 80,
            materiePriorita: materiePriorita || [],
            modalitaStudio: modalitaStudio || 'normale'
          }
        });
      } catch (e) {
        console.error('DB error profilo maturita:', e);
      }
    }

    res.json({ success: true, profilo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/maturita/piano-ripasso
 * Recupera piano ripasso attivo
 */
router.get('/piano-ripasso', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    let piano = null;

    if (db) {
      try {
        piano = await db.pianoRipasso.findFirst({
          where: { utenteId: userId, attivo: true },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {}
    }

    if (!piano) {
      // Genera piano di default
      piano = generaPianoDefault(userId);
    }

    res.json(piano);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maturita/genera-piano
 * Genera nuovo piano di ripasso AI
 */
router.post('/genera-piano', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { modalita, materiePriorita, giorniMancanti } = req.body;

    // Disattiva piani precedenti
    if (db) {
      try {
        await db.pianoRipasso.updateMany({
          where: { utenteId: userId, attivo: true },
          data: { attivo: false }
        });
      } catch (e) {}
    }

    // Genera nuovo piano
    const piano = generaPianoPersonalizzato(userId, modalita, materiePriorita, giorniMancanti);

    // Salva nel DB
    if (db) {
      try {
        const saved = await db.pianoRipasso.create({
          data: {
            utenteId: userId,
            dataInizio: new Date(),
            dataFine: new Date(Date.now() + (giorniMancanti || 200) * 24 * 60 * 60 * 1000),
            modalita: modalita || 'normale',
            materiePriorita: materiePriorita || [],
            piano: piano,
            attivo: true
          }
        });
        piano.id = saved.id;
      } catch (e) {
        console.error('DB error genera piano:', e);
      }
    }

    res.json(piano);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/maturita/simulazioni
 * Lista simulazioni esame completate
 */
router.get('/simulazioni', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    let simulazioni = [];

    if (db) {
      try {
        simulazioni = await db.simulazioneEsame.findMany({
          where: { utenteId: userId },
          orderBy: { completataAt: 'desc' },
          take: 20
        });
      } catch (e) {}
    }

    res.json(simulazioni);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/maturita/simulazione
 * Salva risultato simulazione esame
 */
router.post('/simulazione', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { tipoProva, tipologia, materia, punteggio, punteggioMax, durataMinuti, risposte } = req.body;

    const simulazione = {
      utenteId: userId,
      tipoProva,
      tipologia,
      materia,
      punteggio: parseInt(punteggio),
      punteggioMax: parseInt(punteggioMax),
      durataMinuti: parseInt(durataMinuti),
      risposte,
      completataAt: new Date()
    };

    if (db) {
      try {
        const saved = await db.simulazioneEsame.create({ data: simulazione });
        simulazione.id = saved.id;
      } catch (e) {
        console.error('DB error simulazione:', e);
      }
    }

    // Calcola feedback
    const percentuale = Math.round(punteggio / punteggioMax * 100);
    const feedback = {
      percentuale,
      votoEquivalente: calcolaVotoEquivalente(percentuale, tipoProva),
      suggerimenti: generaSuggerimenti(percentuale, tipoProva, materia)
    };

    res.json({ success: true, simulazione, feedback });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/maturita/statistiche
 * Statistiche preparazione maturità
 */
router.get('/statistiche', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    let stats = {
      simulazioniCompletate: 0,
      mediaVoti: 0,
      oreStudioTotali: 0,
      progressoMaterie: {},
      puntiForti: [],
      puntiDeboli: []
    };

    if (db) {
      try {
        // Simulazioni
        const simulazioni = await db.simulazioneEsame.findMany({
          where: { utenteId: userId }
        });
        
        stats.simulazioniCompletate = simulazioni.length;
        
        if (simulazioni.length > 0) {
          const totalePercentuale = simulazioni.reduce((sum, s) => 
            sum + (s.punteggio / s.punteggioMax * 100), 0
          );
          stats.mediaVoti = Math.round(totalePercentuale / simulazioni.length);
        }

        // Ore studio totali
        const sessioni = await db.sessioneStudio.aggregate({
          where: { utenteId: userId },
          _sum: { durataMinuti: true }
        });
        stats.oreStudioTotali = Math.round((sessioni._sum.durataMinuti || 0) / 60);

        // Progresso per materia
        const perMateria = {};
        simulazioni.forEach(s => {
          if (s.materia) {
            if (!perMateria[s.materia]) {
              perMateria[s.materia] = { totale: 0, count: 0 };
            }
            perMateria[s.materia].totale += (s.punteggio / s.punteggioMax * 100);
            perMateria[s.materia].count++;
          }
        });

        Object.entries(perMateria).forEach(([materia, data]) => {
          const media = Math.round(data.totale / data.count);
          stats.progressoMaterie[materia] = media;
          
          if (media >= 75) stats.puntiForti.push(materia);
          if (media < 60) stats.puntiDeboli.push(materia);
        });

      } catch (e) {
        console.error('DB error statistiche maturita:', e);
      }
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// === HELPER FUNCTIONS ===

function generaPianoDefault(userId) {
  const oggi = new Date();
  const maturita = new Date('2025-06-18');
  const giorniMancanti = Math.ceil((maturita - oggi) / (1000 * 60 * 60 * 24));

  return {
    giorniTotali: giorniMancanti,
    completamentoPrevisto: '95%',
    progressi: {
      'Italiano': 60,
      'Matematica': 55,
      'Storia': 65,
      'Filosofia': 50,
      'Fisica': 45,
      'Inglese': 70,
      'Scienze': 55,
      'Arte': 60,
      'Latino': 40
    }
  };
}

function generaPianoPersonalizzato(userId, modalita, materiePriorita, giorniMancanti) {
  const orePerGiorno = {
    'intensiva': 6,
    'normale': 4,
    'leggera': 2
  }[modalita] || 4;

  const piano = {
    giorniTotali: giorniMancanti || 200,
    modalita,
    orePerGiorno,
    materiePriorita: materiePriorita || [],
    completamentoPrevisto: `${Math.min(95, 70 + orePerGiorno * 5)}%`,
    settimane: [],
    progressi: {}
  };

  // Genera piano settimanale
  const materie = materiePriorita?.length > 0 
    ? materiePriorita 
    : ['Italiano', 'Matematica', 'Storia', 'Fisica', 'Filosofia'];

  for (let s = 0; s < Math.ceil(giorniMancanti / 7); s++) {
    const settimana = {
      numero: s + 1,
      focus: materie[s % materie.length],
      obiettivi: [
        `Ripasso ${materie[s % materie.length]}`,
        `Quiz pratici`,
        `Simulazione parziale`
      ]
    };
    piano.settimane.push(settimana);
  }

  return piano;
}

function calcolaVotoEquivalente(percentuale, tipoProva) {
  if (tipoProva === 'prima' || tipoProva === 'seconda') {
    // Scala 0-20
    return Math.round(percentuale / 5);
  } else if (tipoProva === 'orale') {
    // Scala 0-20
    return Math.round(percentuale / 5);
  }
  return Math.round(percentuale / 10); // Scala 0-10
}

function generaSuggerimenti(percentuale, tipoProva, materia) {
  const suggerimenti = [];

  if (percentuale < 50) {
    suggerimenti.push('Concentrati sul ripasso delle basi');
    suggerimenti.push('Dedica più tempo a questa materia nel piano di studio');
  } else if (percentuale < 70) {
    suggerimenti.push('Buon livello, ma c\'è margine di miglioramento');
    suggerimenti.push('Fai più esercizi pratici');
  } else if (percentuale < 85) {
    suggerimenti.push('Ottimo lavoro! Sei sulla strada giusta');
    suggerimenti.push('Concentrati sui dettagli e casi particolari');
  } else {
    suggerimenti.push('Eccellente! Mantieni questo livello');
    suggerimenti.push('Potresti aiutare altri compagni');
  }

  if (tipoProva === 'prima') {
    suggerimenti.push('Pratica la scrittura con tracce diverse');
  } else if (tipoProva === 'seconda') {
    suggerimenti.push('Esercitati con problemi di anni precedenti');
  } else if (tipoProva === 'orale') {
    suggerimenti.push('Prepara collegamenti interdisciplinari');
  }

  return suggerimenti;
}

module.exports = router;
