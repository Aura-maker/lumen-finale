// GENERATORE RISORSE DI APPRENDIMENTO
// Generazione automatica di quiz, flashcards ed esercizi

const { v4: uuidv4 } = require('uuid');

class LearningResourcesGenerator {
  constructor() {
    this.difficulties = ['base', 'intermedio', 'avanzato'];
    this.quizTypes = ['multiple_choice', 'true_false', 'fill_blank', 'matching', 'ordering'];
    this.flashcardTypes = ['definition', 'formula', 'example', 'concept', 'reverse'];
  }

  // ==================== FLASHCARDS ====================
  
  generateFlashcardsForNode(node, subject, level, minCards = 3) {
    const flashcards = [];
    
    // 1. Flashcard definizione
    if (node.metadata.definitions && node.metadata.definitions.length > 0) {
      flashcards.push(this.createDefinitionCard(node, subject));
    }
    
    // 2. Flashcard concetto inverso
    flashcards.push(this.createReverseCard(node, subject));
    
    // 3. Flashcard esempio
    if (node.metadata.examples && node.metadata.examples.length > 0) {
      flashcards.push(this.createExampleCard(node, subject));
    }
    
    // 4. Flashcard formula (se applicabile)
    if (node.type === 'formula' || node.metadata.formulas) {
      flashcards.push(this.createFormulaCard(node, subject));
    }
    
    // 5. Flashcard prerequisiti
    flashcards.push(this.createPrerequisiteCard(node, subject));
    
    // 6. Flashcard applicazione
    flashcards.push(this.createApplicationCard(node, subject, level));
    
    // Assicura minimo numero di carte
    while (flashcards.length < minCards) {
      flashcards.push(this.createAdditionalCard(node, subject, flashcards.length));
    }
    
    return flashcards.slice(0, Math.max(minCards, 5));
  }
  
  createDefinitionCard(node, subject) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'definition',
      front: `Cos'è ${node.text}?`,
      back: node.metadata.definitions[0].definition || `${node.text} è un concetto fondamentale in ${subject}`,
      difficulty: 'base',
      tags: [subject, node.type, 'definizione'],
      estimatedTime: 15,
      spacedRepetition: {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0
      },
      metadata: {
        created: new Date().toISOString(),
        lastReviewed: null,
        reviewCount: 0,
        averageScore: null
      }
    };
  }
  
  createReverseCard(node, subject) {
    const context = node.metadata.context || `Concetto importante in ${subject}`;
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'reverse',
      front: context.substring(0, 200) + '...\n\nQual è il concetto descritto?',
      back: node.text,
      difficulty: 'intermedio',
      tags: [subject, 'identificazione'],
      estimatedTime: 20,
      spacedRepetition: {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0
      }
    };
  }
  
  createExampleCard(node, subject) {
    const example = node.metadata.examples[0];
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'example',
      front: `Fornisci un esempio di ${node.text}`,
      back: example.text || example,
      difficulty: 'intermedio',
      tags: [subject, 'esempio', 'applicazione'],
      estimatedTime: 25,
      hasImage: example.image || false,
      imageUrl: example.imageUrl || null
    };
  }
  
  createFormulaCard(node, subject) {
    const formula = node.metadata.formulas?.[0] || node.metadata.formula;
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'formula',
      front: `Qual è la formula per ${node.text}?`,
      back: formula?.expression || formula || 'F = ma',
      difficulty: 'intermedio',
      tags: [subject, 'formula', 'matematica'],
      estimatedTime: 30,
      latex: true,
      variables: formula?.variables || []
    };
  }
  
  createPrerequisiteCard(node, subject) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'prerequisite',
      front: `Quali conoscenze sono necessarie per comprendere ${node.text}?`,
      back: this.generatePrerequisites(node, subject),
      difficulty: 'avanzato',
      tags: [subject, 'prerequisiti', 'collegamenti'],
      estimatedTime: 35
    };
  }
  
  createApplicationCard(node, subject, level) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'application',
      front: `Come si applica ${node.text} nella pratica?`,
      back: this.generateApplication(node, subject, level),
      difficulty: 'avanzato',
      tags: [subject, 'applicazione', 'pratica'],
      estimatedTime: 40
    };
  }
  
  // ==================== QUIZ ====================
  
  generateQuizzesForNode(node, subject, level, minQuizzes = 5) {
    const quizzes = [];
    
    // 1. Quiz a scelta multipla base
    quizzes.push(this.createMultipleChoiceQuiz(node, subject, 'base'));
    
    // 2. Quiz vero/falso
    quizzes.push(this.createTrueFalseQuiz(node, subject));
    
    // 3. Quiz di completamento
    quizzes.push(this.createFillBlankQuiz(node, subject));
    
    // 4. Quiz applicativo (per materie STEM)
    if (['Matematica', 'Fisica', 'Chimica', 'Informatica'].includes(subject)) {
      quizzes.push(this.createApplicationQuiz(node, subject, level));
    }
    
    // 5. Quiz di comprensione
    quizzes.push(this.createComprehensionQuiz(node, subject));
    
    // 6. Quiz di collegamento
    quizzes.push(this.createConnectionQuiz(node, subject));
    
    // 7. Quiz di ordinamento
    if (node.metadata.steps || node.type === 'processo') {
      quizzes.push(this.createOrderingQuiz(node, subject));
    }
    
    // Genera quiz aggiuntivi se necessario
    while (quizzes.length < minQuizzes) {
      quizzes.push(this.createAdditionalQuiz(node, subject, quizzes.length));
    }
    
    return quizzes.slice(0, Math.max(minQuizzes, 10));
  }
  
  createMultipleChoiceQuiz(node, subject, difficulty = 'base') {
    const question = this.generateMCQuestion(node, subject, difficulty);
    const options = this.generateMCOptions(node, subject, difficulty);
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'multiple_choice',
      difficulty,
      question: question.text,
      options: options,
      correctAnswer: 0,
      explanation: this.generateExplanation(node, question, options[0]),
      points: difficulty === 'base' ? 10 : difficulty === 'intermedio' ? 15 : 20,
      timeLimit: 60,
      tags: [subject, node.type, 'teoria'],
      hints: this.generateHints(node, 2),
      metadata: {
        created: new Date().toISOString(),
        attempts: 0,
        successRate: null,
        averageTime: null
      }
    };
  }
  
  createTrueFalseQuiz(node, subject) {
    const statement = this.generateTFStatement(node, subject);
    const isTrue = Math.random() > 0.5;
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'true_false',
      difficulty: 'base',
      question: statement.text,
      correctAnswer: isTrue,
      explanation: `Questa affermazione è ${isTrue ? 'vera' : 'falsa'} perché ${statement.reason}`,
      points: 5,
      timeLimit: 30,
      tags: [subject, 'verifica', 'veloce']
    };
  }
  
  createFillBlankQuiz(node, subject) {
    const sentence = this.generateFillBlankSentence(node, subject);
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'fill_blank',
      difficulty: 'intermedio',
      question: sentence.text,
      blanks: sentence.blanks,
      correctAnswers: sentence.answers,
      explanation: sentence.explanation,
      points: 15,
      timeLimit: 45,
      tags: [subject, 'completamento'],
      acceptableVariations: sentence.variations || []
    };
  }
  
  createApplicationQuiz(node, subject, level) {
    const problem = this.generateProblem(node, subject, level);
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'application',
      difficulty: 'avanzato',
      question: problem.text,
      problemData: problem.data,
      options: problem.options,
      correctAnswer: problem.correctIndex,
      solution: problem.solution,
      explanation: problem.explanation,
      points: 25,
      timeLimit: 180,
      tags: [subject, 'problema', 'applicazione'],
      steps: problem.steps,
      formula: problem.formula,
      units: problem.units
    };
  }
  
  createComprehensionQuiz(node, subject) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'comprehension',
      difficulty: 'intermedio',
      question: `Perché ${node.text} è importante in ${subject}?`,
      options: this.generateReasoningOptions(node, subject),
      correctAnswer: 0,
      explanation: `${node.text} è fondamentale perché ${this.getImportanceReason(node, subject)}`,
      points: 15,
      timeLimit: 90,
      tags: [subject, 'comprensione', 'ragionamento']
    };
  }
  
  createConnectionQuiz(node, subject) {
    const connections = this.generateConnections(node);
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'matching',
      difficulty: 'intermedio',
      question: `Collega ${node.text} con i concetti correlati:`,
      leftItems: connections.left,
      rightItems: connections.right,
      correctPairs: connections.pairs,
      explanation: connections.explanation,
      points: 20,
      timeLimit: 120,
      tags: [subject, 'collegamenti', 'relazioni']
    };
  }
  
  createOrderingQuiz(node, subject) {
    const steps = this.generateOrderedSteps(node);
    
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'ordering',
      difficulty: 'avanzato',
      question: `Ordina correttamente i passaggi per ${node.text}:`,
      items: this.shuffleArray(steps.items),
      correctOrder: steps.correctOrder,
      explanation: steps.explanation,
      points: 20,
      timeLimit: 90,
      tags: [subject, 'sequenza', 'procedura']
    };
  }
  
  // ==================== VALIDAZIONE E QUALITÀ ====================
  
  validateFlashcard(card) {
    const errors = [];
    
    if (!card.front || card.front.length < 5) {
      errors.push('Il fronte della carta è troppo corto');
    }
    if (!card.back || card.back.length < 5) {
      errors.push('Il retro della carta è troppo corto');
    }
    if (!card.difficulty || !this.difficulties.includes(card.difficulty)) {
      errors.push('Difficoltà non valida');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  validateQuiz(quiz) {
    const errors = [];
    
    if (!quiz.question || quiz.question.length < 10) {
      errors.push('La domanda è troppo corta');
    }
    
    if (quiz.type === 'multiple_choice') {
      if (!quiz.options || quiz.options.length < 3) {
        errors.push('Opzioni insufficienti');
      }
      const correctCount = quiz.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        errors.push('Deve esserci esattamente una risposta corretta');
      }
    }
    
    if (!quiz.explanation || quiz.explanation.length < 30) {
      errors.push('Spiegazione troppo breve o mancante');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // ==================== UTILITY HELPERS ====================
  
  generatePrerequisites(node, subject) {
    const prerequisites = [
      `Conoscenze di base di ${subject}`,
      'Capacità di ragionamento logico',
      'Comprensione dei concetti fondamentali'
    ];
    
    if (node.metadata.prerequisites) {
      prerequisites.push(...node.metadata.prerequisites);
    }
    
    return prerequisites.join(', ');
  }
  
  generateApplication(node, subject, level) {
    const applications = {
      'base': `${node.text} si applica in situazioni semplici e dirette`,
      'intermedio': `${node.text} è utile per risolvere problemi di media complessità`,
      'avanzato': `${node.text} è fondamentale per affrontare problemi complessi e interdisciplinari`
    };
    
    return applications[level] || applications['intermedio'];
  }
  
  generateMCQuestion(node, subject, difficulty) {
    const templates = [
      `Quale delle seguenti affermazioni su ${node.text} è corretta?`,
      `In ${subject}, ${node.text} si riferisce a:`,
      `Qual è la caratteristica principale di ${node.text}?`,
      `Come si definisce ${node.text}?`
    ];
    
    return {
      text: templates[Math.floor(Math.random() * templates.length)]
    };
  }
  
  generateMCOptions(node, subject, difficulty) {
    const correctOption = {
      text: node.metadata.definitions?.[0]?.definition || `Definizione corretta di ${node.text}`,
      isCorrect: true
    };
    
    const distractors = [
      { text: `Definizione di un concetto simile ma diverso`, isCorrect: false },
      { text: `Definizione opposta o contrastante`, isCorrect: false },
      { text: `Definizione di un altro ambito`, isCorrect: false }
    ];
    
    const options = [correctOption, ...distractors];
    return this.shuffleArray(options);
  }
  
  generateTFStatement(node, subject) {
    const statements = [
      {
        text: `${node.text} è un concetto fondamentale in ${subject}`,
        reason: 'fa parte dei concetti base della materia'
      },
      {
        text: `${node.text} ${node.metadata.definitions?.[0]?.definition || 'ha questa definizione'}`,
        reason: 'corrisponde alla definizione standard'
      }
    ];
    
    return statements[Math.floor(Math.random() * statements.length)];
  }
  
  generateFillBlankSentence(node, subject) {
    const definition = node.metadata.definitions?.[0]?.definition || '';
    const words = definition.split(' ');
    const blankIndex = Math.floor(Math.random() * words.length);
    const answer = words[blankIndex];
    words[blankIndex] = '_____';
    
    return {
      text: words.join(' '),
      blanks: [blankIndex],
      answers: [answer],
      explanation: `La parola mancante è "${answer}" per completare la definizione`,
      variations: [answer.toLowerCase(), answer.toUpperCase()]
    };
  }
  
  generateProblem(node, subject, level) {
    // Problema esempio per materie STEM
    return {
      text: `Un problema che richiede l'applicazione di ${node.text}`,
      data: { value1: 10, value2: 20 },
      options: [
        { text: '30', isCorrect: true },
        { text: '200', isCorrect: false },
        { text: '10', isCorrect: false },
        { text: '0.5', isCorrect: false }
      ],
      correctIndex: 0,
      solution: `Applicando ${node.text}: risultato = 30`,
      explanation: 'Spiegazione dettagliata del procedimento',
      steps: ['Passo 1', 'Passo 2', 'Risultato'],
      formula: 'x + y = z',
      units: 'unità'
    };
  }
  
  generateReasoningOptions(node, subject) {
    return [
      { text: `È fondamentale per comprendere altri concetti`, isCorrect: true },
      { text: `Non è particolarmente importante`, isCorrect: false },
      { text: `È solo teoria senza applicazioni`, isCorrect: false },
      { text: `È obsoleto e superato`, isCorrect: false }
    ];
  }
  
  getImportanceReason(node, subject) {
    return `costituisce una base per la comprensione approfondita di ${subject}`;
  }
  
  generateConnections(node) {
    return {
      left: ['Concetto A', 'Concetto B', 'Concetto C'],
      right: ['Definizione 1', 'Definizione 2', 'Definizione 3'],
      pairs: [[0, 2], [1, 0], [2, 1]],
      explanation: 'Ogni concetto è collegato alla sua definizione corretta'
    };
  }
  
  generateOrderedSteps(node) {
    const steps = ['Primo passo', 'Secondo passo', 'Terzo passo', 'Risultato finale'];
    return {
      items: steps,
      correctOrder: [0, 1, 2, 3],
      explanation: 'L\'ordine corretto segue la sequenza logica del processo'
    };
  }
  
  generateHints(node, count) {
    const hints = [];
    for (let i = 0; i < count; i++) {
      hints.push(`Suggerimento ${i + 1}: Pensa a ${node.text}`);
    }
    return hints;
  }
  
  generateExplanation(node, question, correctOption) {
    return `La risposta corretta è "${correctOption.text}" perché ${node.text} ${node.metadata.context || 'è definito in questo modo'}. Questo concetto è importante per comprendere ${node.metadata.relatedConcepts?.join(', ') || 'altri argomenti correlati'}.`;
  }
  
  createAdditionalCard(node, subject, index) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'concept',
      front: `Aspetto ${index + 1} di ${node.text}`,
      back: `Informazione aggiuntiva su ${node.text} in ${subject}`,
      difficulty: 'intermedio',
      tags: [subject, 'approfondimento'],
      estimatedTime: 20
    };
  }
  
  createAdditionalQuiz(node, subject, index) {
    return {
      id: uuidv4(),
      nodeId: node.id,
      type: 'multiple_choice',
      difficulty: 'intermedio',
      question: `Domanda ${index + 1} su ${node.text}`,
      options: this.generateMCOptions(node, subject, 'intermedio'),
      correctAnswer: 0,
      explanation: `Spiegazione per la domanda ${index + 1}`,
      points: 15,
      timeLimit: 60,
      tags: [subject, 'extra']
    };
  }
  
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

module.exports = LearningResourcesGenerator;
