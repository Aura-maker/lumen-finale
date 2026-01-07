// SISTEMA INTEGRAZIONE COMPLETO
// Carica e integra tutti i contenuti disponibili

const fs = require('fs');
const path = require('path');

class IntegrationLoader {
  constructor(contentPath) {
    this.contentPath = contentPath;
    this.allContent = new Map();
    this.allQuizzes = new Map();
    this.allFlashcards = new Map();
    this.allSimulations = [];
  }

  // CARICA TUTTO IL SISTEMA
  async loadEverything() {
    console.log('🚀 Caricamento sistema completo...');
    
    try {
      // Scansiona tutti i file disponibili
      await this.scanAllFiles();
      
      // Carica contenuti materie
      await this.loadAllSubjects();
      
      // Carica quiz esistenti
      await this.loadExistingQuizzes();
      
      // Carica flashcards esistenti
      await this.loadExistingFlashcards();
      
      // Genera simulazioni
      await this.generateSimulations();
      
      console.log('✅ Sistema completamente caricato!');
      this.printStats();
      
    } catch (error) {
      console.error('❌ Errore caricamento sistema:', error);
    }
  }

  // SCANSIONA TUTTI I FILE
  async scanAllFiles() {
    console.log('🔍 Scansionando file disponibili...');
    
    const files = fs.readdirSync(this.contentPath);
    // Priorità ai file completi
    const contentFiles = files.filter(f => 
      (f.startsWith('contenuti-completi-') || f.startsWith('contenuti-')) && 
      f.endsWith('.js')
    ).sort((a, b) => {
      // Priorità ai file completi
      if (a.includes('completi') && !b.includes('completi')) return -1;
      if (!a.includes('completi') && b.includes('completi')) return 1;
      return a.localeCompare(b);
    });
    const quizFiles = files.filter(f => f.startsWith('quiz-') && f.endsWith('.js'));
    const flashcardFiles = files.filter(f => f.startsWith('flashcards-') && f.endsWith('.js'));
    
    console.log(`📄 File contenuti: ${contentFiles.length}`);
    console.log(`❓ File quiz: ${quizFiles.length}`);
    console.log(`🃏 File flashcards: ${flashcardFiles.length}`);
    
    return { contentFiles, quizFiles, flashcardFiles };
  }

  // CARICA TUTTE LE MATERIE
  async loadAllSubjects() {
    console.log('📚 Caricando tutte le materie...');
    
    const subjects = [
      'filosofia', 'matematica', 'fisica', 'storia', 'italiano',
      'arte', 'scienze', 'inglese', 'latino', 'religione'
    ];

    for (const subject of subjects) {
      await this.loadSubject(subject);
    }
  }

  // CARICA SINGOLA MATERIA
  async loadSubject(subject) {
    try {
      console.log(`🔍 Cercando file per ${subject}...`);
      // Cerca il file migliore per la materia
      const filePath = this.findBestFileForSubject(subject);
      
      if (filePath) {
        console.log(`📖 Caricando ${filePath}...`);
        const content = await this.loadFileContent(filePath);
        if (content) {
          this.allContent.set(subject, content);
          console.log(`✅ ${subject}: ${content.argomenti?.length || 0} argomenti caricati`);
        } else {
          console.log(`❌ ${subject}: contenuto vuoto o non valido`);
        }
      } else {
        console.log(`⚠️ Nessun file trovato per ${subject}`);
      }
    } catch (error) {
      console.error(`❌ Errore caricamento ${subject}:`, error.message);
    }
  }

  // TROVA IL FILE MIGLIORE PER LA MATERIA
  findBestFileForSubject(subject) {
    const possibleFiles = [
      `contenuti-completi-${subject}-NEW.js`,
      `contenuti-completi-${subject}-AMPLIATO.js`,
      `contenuti-completi-${subject}.js`,
      `contenuti-${subject}-completo.js`,
      `contenuti-${subject}.js`
    ];
    
    console.log(`🔍 Cercando file per ${subject} in:`, possibleFiles);

    for (const fileName of possibleFiles) {
      const filePath = path.join(this.contentPath, fileName);
      if (fs.existsSync(filePath)) {
        console.log(`📖 Usando file: ${fileName} per ${subject}`);
        return filePath;
      }
    }

    return null;
  }

  // CARICA CONTENUTO FILE
  async loadFileContent(filePath) {
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

  // CARICA QUIZ ESISTENTI
  async loadExistingQuizzes() {
    console.log('❓ Caricando quiz esistenti...');
    
    const quizFiles = fs.readdirSync(this.contentPath)
      .filter(f => f.startsWith('quiz-') && f.endsWith('.js'));

    for (const file of quizFiles) {
      try {
        const filePath = path.join(this.contentPath, file);
        const quizData = await this.loadFileContent(filePath);
        
        if (quizData) {
          const subject = file.replace('quiz-', '').replace('.js', '').replace('-p1', '').replace('-p2', '').replace('-p3', '');
          
          if (!this.allQuizzes.has(subject)) {
            this.allQuizzes.set(subject, []);
          }
          
          // Gestisci diversi formati di quiz
          let quizArray = [];
          if (Array.isArray(quizData)) {
            quizArray = quizData;
          } else if (quizData.quiz && Array.isArray(quizData.quiz)) {
            quizArray = quizData.quiz;
          } else if (quizData.domande && Array.isArray(quizData.domande)) {
            quizArray = quizData.domande;
          } else if (quizData.questions && Array.isArray(quizData.questions)) {
            quizArray = quizData.questions;
          }
          
          // Normalizza formato quiz
          const normalizedQuizzes = quizArray.map((q, index) => ({
            id: q.id || `${subject}_${file}_${index}`,
            question: q.question || q.domanda || q.testo || '',
            options: q.options || q.opzioni || q.risposte || [],
            correct: q.correct !== undefined ? q.correct : (q.corretta !== undefined ? q.corretta : 0),
            explanation: q.explanation || q.spiegazione || q.motivazione || '',
            difficulty: q.difficulty || q.difficolta || 'medium',
            subject: subject,
            topic: q.topic || q.argomento || 'generale'
          }));
          
          this.allQuizzes.get(subject).push(...normalizedQuizzes);
          console.log(`✅ Quiz ${subject}: ${this.allQuizzes.get(subject).length} domande`);
        }
      } catch (error) {
        console.error(`❌ Errore caricamento quiz ${file}:`, error);
      }
    }
    
    // Genera quiz automatici per materie senza quiz
    await this.generateAutomaticQuizzes();
  }

  // CARICA FLASHCARDS ESISTENTI
  async loadExistingFlashcards() {
    console.log('🃏 Caricando flashcards esistenti...');
    
    const flashcardFiles = fs.readdirSync(this.contentPath)
      .filter(f => f.startsWith('flashcards-') && f.endsWith('.js'));

    for (const file of flashcardFiles) {
      try {
        const filePath = path.join(this.contentPath, file);
        const flashcardData = await this.loadFileContent(filePath);
        
        if (flashcardData) {
          const subject = file.replace('flashcards-', '').replace('.js', '');
          this.allFlashcards.set(subject, flashcardData);
          console.log(`✅ Flashcards ${subject}: caricati`);
        }
      } catch (error) {
        console.error(`❌ Errore caricamento flashcards ${file}:`, error);
      }
    }
  }

  // GENERA SIMULAZIONI COMPLETE
  async generateSimulations() {
    console.log('🎯 Generando simulazioni complete...');
    
    const simulations = [];
    
    // Simulazioni per ogni materia caricata
    for (const [subject, content] of this.allContent) {
      // Simulazione Maturità
      simulations.push({
        id: `maturita_${subject}`,
        title: `Simulazione Maturità - ${this.getSubjectDisplayName(subject)}`,
        description: `Simulazione completa dell'esame di ${subject} per la maturità`,
        subject: subject,
        difficulty: 'expert',
        duration: 360,
        questions: this.generateMaturitaQuestions(subject, content)
      });
      
      // Test Intermedio
      simulations.push({
        id: `test_${subject}`,
        title: `Test ${this.getSubjectDisplayName(subject)} - Verifica`,
        description: `Verifica completa sui principali argomenti di ${subject}`,
        subject: subject,
        difficulty: 'medium',
        duration: 120,
        questions: this.generateTestQuestions(subject, content)
      });
      
      // Quiz Rapido
      simulations.push({
        id: `quiz_${subject}`,
        title: `Quiz Rapido - ${this.getSubjectDisplayName(subject)}`,
        description: `Quiz veloce per ripassare ${subject}`,
        subject: subject,
        difficulty: 'easy',
        duration: 30,
        questions: this.generateQuickQuestions(subject, content)
      });
    }
    
    // Simulazioni speciali
    simulations.push(
      {
        id: 'maturita_completa',
        title: 'Simulazione Maturità Completa',
        description: 'Simulazione completa con tutte le materie',
        subject: 'tutte',
        difficulty: 'expert',
        duration: 480,
        questions: this.generateCompleteMaturitaQuestions()
      },
      {
        id: 'ripasso_generale',
        title: 'Ripasso Generale - Tutte le Materie',
        description: 'Quiz di ripasso per tutte le materie',
        subject: 'tutte',
        difficulty: 'medium',
        duration: 90,
        questions: this.generateGeneralReviewQuestions()
      }
    );

    this.allSimulations = simulations;
    console.log(`✅ Generate ${simulations.length} simulazioni`);
  }

  // GENERA DOMANDE FILOSOFIA
  generatePhilosophyQuestions() {
    return [
      {
        type: 'essay',
        question: 'Analizza il concetto di imperativo categorico in Kant e le sue implicazioni etiche nella società contemporanea',
        points: 20,
        timeLimit: 120,
        keywords: ['Kant', 'imperativo categorico', 'etica', 'morale', 'dovere']
      },
      {
        type: 'essay',
        question: 'Confronta il pensiero di Hegel e Schopenhauer riguardo al concetto di realtà e volontà',
        points: 15,
        timeLimit: 90,
        keywords: ['Hegel', 'Schopenhauer', 'dialettica', 'volontà', 'pessimismo']
      },
      {
        type: 'multiple',
        question: 'Secondo Nietzsche, l\'Übermensch rappresenta:',
        options: [
          'Il superamento dei valori tradizionali e la creazione di nuovi valori',
          'Un ritorno ai valori classici dell\'antichità greca',
          'L\'accettazione passiva del nichilismo moderno',
          'La negazione completa della volontà di potenza'
        ],
        correct: 0,
        points: 5,
        explanation: 'L\'Übermensch nietzschiano rappresenta l\'individuo che supera i valori tradizionali per creare nuovi valori autentici.'
      }
    ];
  }

  // GENERA DOMANDE MATEMATICA
  generateMathQuestions() {
    return [
      {
        type: 'calculation',
        question: 'Calcola il limite: lim(x→0) (sin(x)/x)',
        answer: '1',
        points: 10,
        steps: ['Riconoscere il limite notevole', 'Applicare la definizione', 'Verificare il risultato'],
        formula: 'lim(x→0) (sin(x)/x) = 1'
      },
      {
        type: 'calculation',
        question: 'Trova la derivata di f(x) = x²·ln(x)',
        answer: '2x·ln(x) + x',
        points: 8,
        steps: ['Applicare la regola del prodotto', 'Derivare x²', 'Derivare ln(x)', 'Semplificare'],
        formula: 'd/dx[u·v] = u\'·v + u·v\''
      }
    ];
  }

  // GENERA DOMANDE FISICA
  generatePhysicsQuestions() {
    return [
      {
        type: 'problem',
        question: 'Un corpo di massa 5kg viene lanciato verticalmente verso l\'alto con velocità iniziale 20m/s. Calcola l\'altezza massima raggiunta (g=10m/s²)',
        answer: '20m',
        points: 12,
        formula: 'h = v₀²/(2g)',
        steps: ['Identificare i dati', 'Applicare la conservazione dell\'energia', 'Calcolare il risultato']
      }
    ];
  }

  // GENERA DOMANDE STORIA
  generateHistoryQuestions() {
    return [
      {
        type: 'essay',
        question: 'Analizza le cause e le conseguenze della Prima Guerra Mondiale nel contesto europeo',
        points: 25,
        timeLimit: 45,
        keywords: ['Prima Guerra Mondiale', 'cause', 'conseguenze', 'Europa', 'nazionalismo']
      }
    ];
  }

  // GENERA DOMANDE ITALIANO
  generateItalianQuestions() {
    return [
      {
        type: 'analysis',
        question: 'Analizza il seguente sonetto di Petrarca dal Canzoniere: "Voi ch\'ascoltate in rime sparse il suono..."',
        text: 'Voi ch\'ascoltate in rime sparse il suono\ndi quei sospiri ond\'io nudriva \'l core\nin sul mio primo giovenile errore\nquand\'era in parte altr\'uom da quel ch\'i\' sono...',
        points: 30,
        aspects: ['Struttura metrica', 'Figure retoriche', 'Temi principali', 'Contesto storico-letterario']
      }
    ];
  }

  // OTTIENI CONTENUTO MATERIA
  getSubjectContent(subject) {
    return this.allContent.get(subject);
  }

  // OTTIENI TUTTE LE MATERIE DISPONIBILI
  getAllSubjects() {
    return Array.from(this.allContent.keys());
  }

  // OTTIENI QUIZ MATERIA
  getSubjectQuizzes(subject) {
    return this.allQuizzes.get(subject) || [];
  }

  // OTTIENI FLASHCARDS MATERIA
  getSubjectFlashcards(subject) {
    return this.allFlashcards.get(subject);
  }

  // OTTIENI TUTTE LE SIMULAZIONI
  getAllSimulations() {
    return this.allSimulations;
  }

  // OTTIENI SIMULAZIONI PER MATERIA
  getSimulationsBySubject(subject) {
    return this.allSimulations.filter(sim => sim.subject === subject);
  }

  // STATISTICHE COMPLETE
  getCompleteStats() {
    let totalTopics = 0;
    let totalSubtopics = 0;
    let totalQuizzes = 0;

    for (const [subject, content] of this.allContent) {
      if (content.argomenti) {
        totalTopics += content.argomenti.length;
        content.argomenti.forEach(arg => {
          if (arg.sottoargomenti) {
            totalSubtopics += arg.sottoargomenti.length;
          }
        });
      }
    }

    for (const [subject, quizzes] of this.allQuizzes) {
      totalQuizzes += quizzes.length;
    }

    return {
      subjects: this.allContent.size,
      topics: totalTopics,
      subtopics: totalSubtopics,
      quizzes: totalQuizzes,
      flashcards: this.allFlashcards.size,
      simulations: this.allSimulations.length
    };
  }

  // STAMPA STATISTICHE
  printStats() {
    const stats = this.getCompleteStats();
    console.log('\n📊 STATISTICHE SISTEMA:');
    console.log(`📚 Materie: ${stats.subjects}`);
    console.log(`📖 Argomenti: ${stats.topics}`);
    console.log(`📝 Sottoargomenti: ${stats.subtopics}`);
    console.log(`❓ Quiz: ${stats.quizzes}`);
    console.log(`🃏 Flashcards: ${stats.flashcards} materie`);
    console.log(`🎯 Simulazioni: ${stats.simulations}`);
    console.log('');
  }

  // GENERA QUIZ AUTOMATICI PER MATERIE SENZA QUIZ
  async generateAutomaticQuizzes() {
    console.log('🤖 Generando quiz automatici...');
    
    for (const [subject, content] of this.allContent) {
      if (!this.allQuizzes.has(subject) || this.allQuizzes.get(subject).length === 0) {
        console.log(`📝 Generando quiz per ${subject}...`);
        
        const autoQuizzes = [];
        
        if (content.argomenti) {
          content.argomenti.forEach((argomento, argIndex) => {
            // Quiz per argomento
            autoQuizzes.push({
              id: `auto_${subject}_${argIndex}_1`,
              question: `Quale delle seguenti affermazioni su "${argomento.titolo}" è corretta?`,
              options: [
                'È un concetto fondamentale della materia',
                'Non ha rilevanza per gli studi',
                'È un argomento secondario',
                'Non è collegato ad altri argomenti'
              ],
              correct: 0,
              explanation: `${argomento.titolo} è effettivamente un concetto fondamentale che richiede studio approfondito.`,
              difficulty: 'easy',
              subject: subject,
              topic: argomento.titolo
            });
            
            // Quiz sui sottoargomenti
            if (argomento.sottoargomenti) {
              argomento.sottoargomenti.forEach((sott, sottIndex) => {
                autoQuizzes.push({
                  id: `auto_${subject}_${argIndex}_${sottIndex}_2`,
                  question: `In relazione a "${argomento.titolo}", cosa riguarda "${sott.titolo}"?`,
                  options: [
                    'Gli aspetti teorici fondamentali',
                    'Solo gli aspetti pratici',
                    'Esclusivamente la storia',
                    'Nessun aspetto rilevante'
                  ],
                  correct: 0,
                  explanation: `${sott.titolo} si concentra sugli aspetti teorici fondamentali di ${argomento.titolo}.`,
                  difficulty: 'medium',
                  subject: subject,
                  topic: argomento.titolo
                });
              });
            }
          });
        }
        
        this.allQuizzes.set(subject, autoQuizzes);
        console.log(`✅ Generati ${autoQuizzes.length} quiz automatici per ${subject}`);
      }
    }
  }

  // UTILITY FUNCTIONS
  getSubjectDisplayName(subject) {
    const names = {
      filosofia: 'Filosofia',
      matematica: 'Matematica',
      fisica: 'Fisica',
      storia: 'Storia',
      italiano: 'Italiano',
      arte: 'Arte',
      scienze: 'Scienze',
      inglese: 'Inglese',
      latino: 'Latino',
      religione: 'Religione'
    };
    return names[subject] || subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  generateMaturitaQuestions(subject, content) {
    const questions = [];
    
    if (content.argomenti && content.argomenti.length > 0) {
      const mainTopic = content.argomenti[0];
      questions.push({
        type: 'essay',
        question: `Analizza in modo approfondito il tema "${mainTopic.titolo}" nel contesto di ${subject}`,
        points: 25,
        timeLimit: 120,
        keywords: [mainTopic.titolo, subject]
      });
    }
    
    return questions;
  }

  generateTestQuestions(subject, content) {
    const questions = [];
    
    if (content.argomenti) {
      content.argomenti.slice(0, 3).forEach((arg, index) => {
        questions.push({
          type: 'multiple',
          question: `Quale aspetto caratterizza principalmente "${arg.titolo}"?`,
          options: [
            'La sua importanza teorica',
            'La sua irrilevanza',
            'La sua complessità eccessiva',
            'La sua semplicità estrema'
          ],
          correct: 0,
          points: 5,
          explanation: `${arg.titolo} è caratterizzato principalmente dalla sua importanza teorica.`,
          difficulty: 'easy',
          subject: subject,
          topic: arg.titolo
        });
      });
    }
    
    return questions;
  }

  generateQuickQuestions(subject, content) {
    const questions = [];
    
    if (content.argomenti) {
      content.argomenti.slice(0, 5).forEach((arg, index) => {
        questions.push({
          type: 'true_false',
          question: `"${arg.titolo}" è un argomento importante in ${subject}`,
          correct: true,
          points: 2,
          explanation: `Sì, ${arg.titolo} è effettivamente un argomento importante.`,
          difficulty: 'easy',
          subject: subject,
          topic: arg.titolo
        });
      });
    }
    
    return questions;
  }

  generateCompleteMaturitaQuestions() {
    const questions = [];
    
    for (const [subject, content] of this.allContent) {
      if (content.argomenti && content.argomenti.length > 0) {
        questions.push({
          type: 'essay',
          question: `Domanda di ${subject}: ${content.argomenti[0].titolo}`,
          points: 15,
          timeLimit: 60,
          subject: subject
        });
      }
    }
    
    return questions;
  }

  generateGeneralReviewQuestions() {
    const questions = [];
    
    for (const [subject, quizzes] of this.allQuizzes) {
      if (quizzes.length > 0) {
        questions.push(...quizzes.slice(0, 2));
      }
    }
    
    return questions.slice(0, 20);
  }

  printStats() {
    const stats = this.getCompleteStats();
    console.log('\n📊 STATISTICHE SISTEMA COMPLETO:');
    console.log(`📚 Materie: ${stats.subjects}`);
    console.log(`📖 Argomenti: ${stats.topics}`);
    console.log(`📝 Sottoargomenti: ${stats.subtopics}`);
    console.log(`❓ Quiz: ${stats.quizzes}`);
    console.log(`🎴 Flashcards: ${stats.flashcards} materie`);
    console.log(`🎯 Simulazioni: ${stats.simulations}`);
    console.log('');
  }
}

module.exports = IntegrationLoader;
