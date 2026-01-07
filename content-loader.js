// SISTEMA CARICAMENTO CONTENUTI COMPLETO
// Carica tutti i contenuti, quiz e simulazioni

const fs = require('fs');
const path = require('path');

class ContentLoader {
  constructor(contentPath) {
    this.contentPath = contentPath;
    this.loadedContent = new Map();
    this.quizDatabase = new Map();
    this.simulationsDatabase = new Map();
  }

  // CARICA TUTTI I CONTENUTI
  async loadAllContent() {
    console.log('📚 Caricando tutti i contenuti...');
    
    try {
      // Carica contenuti materie
      await this.loadSubjectContents();
      
      // Genera quiz automatici
      await this.generateAllQuizzes();
      
      // Carica simulazioni
      await this.loadSimulations();
      
      console.log('✅ Tutti i contenuti caricati con successo');
      console.log(`📖 Materie caricate: ${this.loadedContent.size}`);
      console.log(`❓ Quiz generati: ${this.quizDatabase.size}`);
      console.log(`🎯 Simulazioni: ${this.simulationsDatabase.size}`);
      
    } catch (error) {
      console.error('❌ Errore caricamento contenuti:', error);
    }
  }

  // CARICA CONTENUTI MATERIE
  async loadSubjectContents() {
    const subjects = [
      'filosofia', 'matematica', 'fisica', 'storia', 'italiano',
      'arte', 'scienze', 'inglese', 'latino', 'religione'
    ];

    for (const subject of subjects) {
      try {
        // Prova prima con contenuti-completi-
        let filePath = path.join(this.contentPath, `contenuti-completi-${subject}.js`);
        
        if (!fs.existsSync(filePath)) {
          // Prova con contenuti-
          filePath = path.join(this.contentPath, `contenuti-${subject}.js`);
        }
        
        if (fs.existsSync(filePath)) {
          const content = await this.loadContentFromFile(filePath);
          if (content) {
            this.loadedContent.set(subject, content);
            console.log(`✅ ${subject}: ${content.argomenti?.length || 0} argomenti`);
          }
        } else {
          console.log(`⚠️ File non trovato per ${subject}`);
        }
      } catch (error) {
        console.error(`❌ Errore caricamento ${subject}:`, error);
      }
    }
  }

  // CARICA CONTENUTO DA FILE
  async loadContentFromFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Prova export default
      let match = fileContent.match(/export default\s*({[\s\S]*});?\s*$/);
      if (match) {
        return eval(`(${match[1]})`);
      }
      
      // Prova module.exports
      match = fileContent.match(/module\.exports\s*=\s*({[\s\S]*});?\s*$/);
      if (match) {
        return eval(`(${match[1]})`);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Errore parsing file:', error);
      return null;
    }
  }

  // GENERA TUTTI I QUIZ
  async generateAllQuizzes() {
    console.log('🎯 Generando quiz automatici...');
    
    for (const [subject, content] of this.loadedContent) {
      if (content.argomenti) {
        for (const argomento of content.argomenti) {
          const quizzes = this.generateQuizzesForTopic(subject, argomento);
          const key = `${subject}_${argomento.titolo.toLowerCase().replace(/\s+/g, '_')}`;
          this.quizDatabase.set(key, quizzes);
        }
      }
    }
  }

  // GENERA QUIZ PER ARGOMENTO
  generateQuizzesForTopic(subject, argomento) {
    const quizzes = [];
    
    // Quiz di base
    quizzes.push({
      id: `${subject}_${Date.now()}_1`,
      question: `Quale delle seguenti affermazioni su "${argomento.titolo}" è corretta?`,
      options: [
        'È un concetto fondamentale della materia',
        'Non ha rilevanza storica',
        'È stato sviluppato nel XXI secolo',
        'Non ha applicazioni pratiche'
      ],
      correct: 0,
      explanation: `${argomento.titolo} è effettivamente un concetto fondamentale che richiede studio approfondito.`,
      difficulty: 'easy',
      subject: subject,
      topic: argomento.titolo
    });

    // Quiz intermedio
    if (argomento.sottoargomenti && argomento.sottoargomenti.length > 0) {
      const sottoarg = argomento.sottoargomenti[0];
      quizzes.push({
        id: `${subject}_${Date.now()}_2`,
        question: `In relazione a "${argomento.titolo}", quale aspetto riguarda "${sottoarg.titolo}"?`,
        options: [
          'Gli aspetti teorici fondamentali',
          'Solo gli aspetti pratici',
          'Esclusivamente la storia',
          'Nessun aspetto rilevante'
        ],
        correct: 0,
        explanation: `${sottoarg.titolo} si concentra sugli aspetti teorici fondamentali di ${argomento.titolo}.`,
        difficulty: 'medium',
        subject: subject,
        topic: argomento.titolo
      });
    }

    // Quiz avanzato
    quizzes.push({
      id: `${subject}_${Date.now()}_3`,
      question: `Quale metodologia di studio è più efficace per "${argomento.titolo}"?`,
      options: [
        'Analisi critica e collegamenti interdisciplinari',
        'Memorizzazione meccanica',
        'Studio superficiale',
        'Ignorare i dettagli'
      ],
      correct: 0,
      explanation: `Per ${argomento.titolo} è essenziale l'analisi critica e la capacità di creare collegamenti con altri argomenti.`,
      difficulty: 'hard',
      subject: subject,
      topic: argomento.titolo
    });

    return quizzes;
  }

  // CARICA SIMULAZIONI
  async loadSimulations() {
    console.log('🎯 Caricando simulazioni...');
    
    const simulations = [
      {
        id: 'sim_filosofia_maturita',
        title: 'Simulazione Maturità - Filosofia',
        description: 'Simulazione completa dell\'esame di filosofia per la maturità scientifica',
        subject: 'filosofia',
        difficulty: 'expert',
        duration: 360, // 6 ore
        questions: [
          {
            type: 'essay',
            question: 'Analizza il concetto di imperativo categorico in Kant e le sue implicazioni etiche',
            points: 20,
            timeLimit: 120
          },
          {
            type: 'essay',
            question: 'Confronta il pensiero di Hegel e Schopenhauer riguardo al concetto di realtà',
            points: 15,
            timeLimit: 90
          },
          {
            type: 'multiple',
            question: 'Secondo Nietzsche, l\'Übermensch rappresenta:',
            options: [
              'Il superamento dei valori tradizionali',
              'Un ritorno ai valori classici',
              'L\'accettazione del nichilismo',
              'La negazione della volontà'
            ],
            correct: 0,
            points: 5
          }
        ]
      },
      {
        id: 'sim_matematica_analisi',
        title: 'Test Matematica - Analisi Matematica',
        description: 'Verifica completa su limiti, derivate e integrali',
        subject: 'matematica',
        difficulty: 'advanced',
        duration: 180, // 3 ore
        questions: [
          {
            type: 'calculation',
            question: 'Calcola il limite: lim(x→0) (sin(x)/x)',
            answer: '1',
            points: 10,
            steps: [
              'Riconoscere il limite notevole',
              'Applicare la definizione',
              'Verificare il risultato'
            ]
          },
          {
            type: 'calculation',
            question: 'Trova la derivata di f(x) = x²·ln(x)',
            answer: '2x·ln(x) + x',
            points: 8,
            steps: [
              'Applicare la regola del prodotto',
              'Derivare x²',
              'Derivare ln(x)',
              'Semplificare'
            ]
          }
        ]
      },
      {
        id: 'sim_fisica_meccanica',
        title: 'Simulazione Fisica - Meccanica Classica',
        description: 'Test completo sui principi della meccanica newtoniana',
        subject: 'fisica',
        difficulty: 'advanced',
        duration: 120, // 2 ore
        questions: [
          {
            type: 'problem',
            question: 'Un corpo di massa 5kg viene lanciato verticalmente verso l\'alto con velocità iniziale 20m/s. Calcola l\'altezza massima raggiunta (g=10m/s²)',
            answer: '20m',
            points: 12,
            formula: 'h = v₀²/(2g)',
            steps: [
              'Identificare i dati',
              'Applicare la conservazione dell\'energia',
              'Calcolare il risultato'
            ]
          }
        ]
      },
      {
        id: 'sim_storia_novecento',
        title: 'Simulazione Storia - XX Secolo',
        description: 'Verifica sui principali eventi del Novecento',
        subject: 'storia',
        difficulty: 'medium',
        duration: 90,
        questions: [
          {
            type: 'essay',
            question: 'Analizza le cause e le conseguenze della Prima Guerra Mondiale',
            points: 25,
            timeLimit: 45
          },
          {
            type: 'multiple',
            question: 'La Rivoluzione Russa del 1917 portò al potere:',
            options: [
              'I bolscevichi guidati da Lenin',
              'I menscevichi',
              'I socialisti rivoluzionari',
              'I cadetti'
            ],
            correct: 0,
            points: 5
          }
        ]
      },
      {
        id: 'sim_italiano_letteratura',
        title: 'Simulazione Italiano - Letteratura',
        description: 'Analisi testuale e storia letteraria',
        subject: 'italiano',
        difficulty: 'advanced',
        duration: 240, // 4 ore
        questions: [
          {
            type: 'analysis',
            question: 'Analizza il seguente sonetto di Petrarca dal Canzoniere',
            text: 'Voi ch\'ascoltate in rime sparse il suono...',
            points: 30,
            aspects: [
              'Struttura metrica',
              'Figure retoriche',
              'Temi principali',
              'Contesto storico-letterario'
            ]
          }
        ]
      }
    ];

    simulations.forEach(sim => {
      this.simulationsDatabase.set(sim.id, sim);
    });
  }

  // OTTIENI CONTENUTO MATERIA
  getSubjectContent(subject) {
    return this.loadedContent.get(subject);
  }

  // OTTIENI QUIZ PER ARGOMENTO
  getQuizzesForTopic(subject, topic) {
    const key = `${subject}_${topic.toLowerCase().replace(/\s+/g, '_')}`;
    return this.quizDatabase.get(key) || [];
  }

  // OTTIENI TUTTE LE SIMULAZIONI
  getAllSimulations() {
    return Array.from(this.simulationsDatabase.values());
  }

  // OTTIENI SIMULAZIONI PER MATERIA
  getSimulationsBySubject(subject) {
    return Array.from(this.simulationsDatabase.values())
      .filter(sim => sim.subject === subject);
  }

  // OTTIENI SIMULAZIONE PER ID
  getSimulationById(id) {
    return this.simulationsDatabase.get(id);
  }

  // STATISTICHE CONTENUTI
  getContentStats() {
    let totalTopics = 0;
    let totalSubtopics = 0;
    
    for (const [subject, content] of this.loadedContent) {
      if (content.argomenti) {
        totalTopics += content.argomenti.length;
        content.argomenti.forEach(arg => {
          if (arg.sottoargomenti) {
            totalSubtopics += arg.sottoargomenti.length;
          }
        });
      }
    }

    return {
      subjects: this.loadedContent.size,
      topics: totalTopics,
      subtopics: totalSubtopics,
      quizzes: Array.from(this.quizDatabase.values()).reduce((sum, quizzes) => sum + quizzes.length, 0),
      simulations: this.simulationsDatabase.size
    };
  }
}

module.exports = ContentLoader;
