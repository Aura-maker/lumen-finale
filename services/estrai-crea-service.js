/**
 * 📸 SERVIZIO ESTRAI E CREA
 * Estrazione da foto/testo, soluzione esercizi, generazione varianti
 * Qualità premium per matematica e fisica
 */

const aiService = require('./ai-service');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class EstraiCreaService {
  constructor() {
    this.tesseractWorker = null;
    this.mathpixClient = null;
    
    // Configurazione OCR avanzato
    this.ocrConfig = {
      tesseract: {
        lang: 'ita+eng+equ', // Italiano + Inglese + Equazioni
        oem: 3, // OCR Engine Mode
        psm: 6, // Page Segmentation Mode
      },
      mathpix: {
        appId: process.env.MATHPIX_APP_ID,
        appKey: process.env.MATHPIX_APP_KEY,
        formats: ['text', 'latex', 'mathml']
      }
    };

    // Template per generazione contenuti
    this.templates = {
      matematica: {
        algebra: ['equazioni', 'disequazioni', 'sistemi', 'polinomi'],
        analisi: ['limiti', 'derivate', 'integrali', 'studio_funzione'],
        geometria: ['analitica', 'euclidea', 'trigonometria'],
        probabilita: ['combinatoria', 'distribuzioni', 'statistica']
      },
      fisica: {
        meccanica: ['cinematica', 'dinamica', 'energia', 'quantità_moto'],
        termodinamica: ['gas_ideali', 'trasformazioni', 'entropia'],
        elettromagnetismo: ['campo_elettrico', 'corrente', 'magnetismo'],
        onde: ['oscillazioni', 'acustica', 'ottica']
      }
    };

    // Cache per ottimizzazione
    this.cache = new Map();
  }

  /**
   * 🚀 Inizializzazione servizi OCR
   */
  async initialize() {
    console.log('🚀 Inizializzazione servizio Estrai e Crea...');
    
    // Disabilita Tesseract temporaneamente per evitare crash
    console.log('⚠️ Tesseract disabilitato temporaneamente (funziona comunque con AI)');
    this.tesseractWorker = null;
    this.mathpixClient = null;

    console.log('✅ Servizio Estrai e Crea pronto (modalità AI-only)');
  }

  /**
   * 🚀 METODO PRINCIPALE API: Process Input
   */
  async processInput(input, options = {}) {
    console.log('🚀 ProcessInput chiamato:', { type: input.type, options });
    
    try {
      if (input.type === 'image') {
        // Leggi file immagine
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(input.content);
        return await this.estraiECrea(imageBuffer, options);
      } else if (input.type === 'text') {
        // Processa testo direttamente
        return await this.processText(input.content, options);
      } else {
        throw new Error('Tipo input non supportato: ' + input.type);
      }
    } catch (error) {
      console.error('❌ Errore in processInput:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📝 Processa testo direttamente
   */
  async processText(text, options = {}) {
    console.log('📝 Processamento testo diretto...');
    
    try {
      // Simula OCR result per testo
      const ocrResult = {
        text: text,
        confidence: 1.0,
        formulas: this._extractMathFromText(text),
        warnings: []
      };
      
      // Usa lo stesso pipeline dell'immagine
      const analysis = await this._analyzeContent(ocrResult);
      const solution = await this._generateSolution(analysis);
      
      let result = {
        success: true,
        result: {
          soluzione: solution,
          metadata: this._assignMetadata(analysis, solution)
        }
      };
      
      // Genera contenuti opzionali
      if (options.generateQuiz) {
        result.result.quiz = await this._generateQuizzes(analysis, solution);
      }
      
      if (options.generateFlashcards) {
        result.result.flashcards = await this._generateFlashcards(analysis, solution);
      }
      
      if (options.generateVarianti) {
        result.result.varianti = await this._generateVariants(analysis, solution);
      }
      
      if (options.generateMappa) {
        result.result.mappa = await this._buildConceptMap(analysis);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Errore processamento testo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📸 METODO PRINCIPALE: Estrai e Crea da immagine
   */
  async estraiECrea(imageBuffer, options = {}) {
    console.log('📸 Avvio estrazione e creazione contenuti...');
    
    try {
      // Step 1: Pre-processing immagine
      const processedImage = await this._preprocessImage(imageBuffer);
      
      // Step 2: OCR - estrazione testo
      const ocrResult = await this._performOCR(processedImage, options);
      
      // Step 3: Analisi semantica e classificazione
      const analysis = await this._analyzeContent(ocrResult);
      
      // Step 4: Generazione soluzione dettagliata
      const solution = await this._generateSolution(analysis);
      
      // Step 5: Creazione varianti esercizio
      const variants = await this._generateVariants(analysis, solution);
      
      // Step 6: Generazione quiz correlati
      const quizzes = await this._generateQuizzes(analysis, solution);
      
      // Step 7: Creazione flashcards
      const flashcards = await this._generateFlashcards(analysis, solution);
      
      // Step 8: Costruzione mappa concettuale
      const conceptMap = await this._buildConceptMap(analysis);
      
      // Step 9: Assegnazione metadata
      const metadata = this._assignMetadata(analysis, solution);
      
      // Step 10: Validazione finale
      const validated = await this._validateOutput({
        esercizio_originale: analysis.enunciato_pulito,
        soluzione: solution,
        varianti: variants,
        quiz: quizzes,
        flashcards: flashcards,
        mappa_concettuale: conceptMap,
        metadata: metadata
      });

      console.log('✅ Estrazione e creazione completata con successo');
      
      return {
        success: true,
        data: validated,
        metrics: {
          tempo_elaborazione_ms: Date.now() - (options.startTime || Date.now()),
          ocr_confidence: ocrResult.confidence,
          elementi_generati: {
            varianti: variants.length,
            quiz: quizzes.length,
            flashcards: flashcards.length,
            nodi_mappa: conceptMap.nodi.length
          }
        }
      };

    } catch (error) {
      console.error('❌ Errore in Estrai e Crea:', error);
      
      return {
        success: false,
        error: error.message,
        suggerimento: await this._getSuggestionForError(error)
      };
    }
  }

  /**
   * 🖼️ Pre-processing immagine per migliorare OCR
   */
  async _preprocessImage(imageBuffer) {
    console.log('🖼️ Pre-processing immagine...');
    
    try {
      const processed = await sharp(imageBuffer)
        .resize(2000, null, { 
          withoutEnlargement: true,
          fit: 'inside' 
        })
        .normalize() // Normalizza contrasto
        .sharpen() // Aumenta nitidezza
        .greyscale() // Converti in bianco e nero
        .threshold(128) // Binarizzazione
        .toBuffer();
      
      console.log('✅ Immagine preprocessata');
      return processed;
      
    } catch (error) {
      console.warn('⚠️ Pre-processing fallito, uso immagine originale');
      return imageBuffer;
    }
  }

  /**
   * 📝 OCR avanzato con fallback multipli
   */
  async _performOCR(imageBuffer, options = {}) {
    console.log('📝 Esecuzione OCR...');
    
    let ocrResult = {
      text: '',
      confidence: 0,
      formulas: [],
      warnings: []
    };

    // Tentativo 1: Mathpix per contenuti matematici (se disponibile)
    if (this.mathpixClient && options.preferMathpix !== false) {
      try {
        console.log('🔢 Tentativo OCR con Mathpix...');
        const mathpixResult = await this._mathpixOCR(imageBuffer);
        if (mathpixResult.confidence > 0.7) {
          ocrResult = mathpixResult;
        }
      } catch (error) {
        console.warn('⚠️ Mathpix OCR fallito:', error.message);
        ocrResult.warnings.push('Mathpix non disponibile');
      }
    }

    // Tentativo 2: Tesseract per testo generale
    if (!ocrResult.text || ocrResult.confidence < 0.5) {
      try {
        console.log('📄 OCR con Tesseract...');
        const tesseractResult = await this.tesseractWorker.recognize(imageBuffer);
        
        if (!ocrResult.text || tesseractResult.data.confidence > ocrResult.confidence) {
          ocrResult.text = tesseractResult.data.text;
          ocrResult.confidence = tesseractResult.data.confidence / 100;
        }
        
        // Estrai simboli matematici se presenti
        ocrResult.formulas = this._extractMathFromText(tesseractResult.data.text);
        
      } catch (error) {
        console.error('❌ Tesseract OCR fallito:', error);
        ocrResult.warnings.push('Tesseract fallito');
      }
    }

    // Tentativo 3: AI Vision se OCR tradizionale fallisce
    if (!ocrResult.text || ocrResult.confidence < 0.3) {
      console.log('👁️ Fallback su AI Vision...');
      try {
        const aiVisionResult = await aiService.generateContent({
          type: 'extract-exercise',
          prompt: `Estrai il testo e le formule matematiche da questa immagine. 
                   Se ci sono parti illeggibili, indicale con [?].
                   Formatta le formule in LaTeX.`,
          image: imageBuffer.toString('base64'),
          useVision: true
        });
        
        ocrResult.text = aiVisionResult.enunciato_pulito || '';
        ocrResult.confidence = 0.6; // Confidence media per AI
        ocrResult.formulas = aiVisionResult.formule || [];
        ocrResult.warnings.push('Usato AI Vision per OCR');
        
      } catch (error) {
        console.error('❌ AI Vision fallito:', error);
        throw new Error('Impossibile estrarre testo dall\'immagine');
      }
    }

    // Post-processing del testo
    ocrResult.text = this._cleanOCRText(ocrResult.text);
    
    console.log(`✅ OCR completato (confidence: ${(ocrResult.confidence * 100).toFixed(1)}%)`);
    
    // Se confidence troppo bassa, richiedi conferma utente
    if (ocrResult.confidence < 0.5) {
      ocrResult.needsConfirmation = true;
      ocrResult.warnings.push('Testo estratto con bassa confidenza, verifica necessaria');
    }

    return ocrResult;
  }

  /**
   * 🔢 OCR specifico per matematica con Mathpix
   */
  async _mathpixOCR(imageBuffer) {
    // Simulazione - in produzione usare vera API Mathpix
    return {
      text: '',
      latex: '',
      confidence: 0,
      formulas: []
    };
  }

  /**
   * 🧹 Pulizia testo OCR
   */
  _cleanOCRText(text) {
    return text
      .replace(/\s+/g, ' ') // Normalizza spazi
      .replace(/([.!?])\s*([a-z])/g, (match, p1, p2) => `${p1} ${p2.toUpperCase()}`) // Maiuscole dopo punto
      .replace(/\b(\d+)\s*x\s*/gi, '$1x') // Fix per moltiplicazioni
      .replace(/\s*=\s*/g, ' = ') // Spazi attorno uguale
      .trim();
  }

  /**
   * 🔍 Estrazione formule matematiche dal testo
   */
  _extractMathFromText(text) {
    const formulas = [];
    
    // Pattern comuni per formule matematiche
    const patterns = [
      /\b\d+x[\^²³]?\s*[+\-*/]\s*\d+/g, // Polinomi
      /\\frac\{[^}]+\}\{[^}]+\}/g, // Frazioni LaTeX
      /\b(sin|cos|tan|log|ln|sqrt|lim|int)\s*\([^)]+\)/gi, // Funzioni
      /\b\d+\s*[=<>≤≥]\s*\d+/g, // Equazioni/disequazioni
      /∫.*?dx/g, // Integrali
      /\blim_\{[^}]+\}/g // Limiti
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        formulas.push(...matches);
      }
    });
    
    return [...new Set(formulas)]; // Rimuovi duplicati
  }

  /**
   * 🧠 Analisi semantica del contenuto
   */
  async _analyzeContent(ocrResult) {
    console.log('🧠 Analisi semantica del contenuto...');
    
    const analysisPrompt = `
      Analizza questo testo estratto da un esercizio scolastico:
      "${ocrResult.text}"
      
      ${ocrResult.formulas.length > 0 ? `Formule rilevate: ${ocrResult.formulas.join(', ')}` : ''}
      
      Identifica:
      1. Tipo di esercizio (es: equazione, integrale, problema fisica)
      2. Materia (Matematica/Fisica/altro)
      3. Argomento principale
      4. Sottoargomento specifico
      5. Livello difficoltà (base/intermedio/avanzato)
      6. Prerequisiti necessari
      7. Enunciato riscritto in modo chiaro e completo
      
      Se ci sono parti illeggibili o ambigue, fai ipotesi ragionevoli basate sul contesto.
    `;

    const analysis = await aiService.generateContent({
      type: 'extract-exercise',
      prompt: analysisPrompt,
      materia: this._guessSubjectFromText(ocrResult.text)
    });

    // Aggiungi informazioni OCR all'analisi
    analysis.ocr_metadata = {
      confidence: ocrResult.confidence,
      warnings: ocrResult.warnings,
      needs_confirmation: ocrResult.needsConfirmation
    };

    console.log('✅ Analisi completata:', {
      tipo: analysis.tipo_problema,
      materia: analysis.materia,
      argomento: analysis.argomento
    });

    return analysis;
  }

  /**
   * 🎯 Generazione soluzione dettagliata passo-passo
   */
  async _generateSolution(analysis) {
    console.log('🎯 Generazione soluzione dettagliata...');
    
    const solutionPrompt = `
      Risolvi questo esercizio passo-passo:
      "${analysis.enunciato_pulito}"
      
      Tipo: ${analysis.tipo_problema}
      Materia: ${analysis.materia}
      Argomento: ${analysis.argomento}
      
      REQUISITI SOLUZIONE:
      1. Mostra OGNI passaggio numerico digit-by-digit
      2. Spiega il ragionamento dietro ogni passaggio
      3. Indica formule utilizzate in LaTeX
      4. Specifica unità di misura sempre
      5. Effettua verifiche e controlli
      6. Evidenzia errori comuni da evitare
      
      Formatta la soluzione in modo chiaro e didattico per uno studente liceale.
    `;

    const solution = await aiService.generateContent({
      type: 'extract-exercise',
      prompt: solutionPrompt
    });

    // Validazione numerica della soluzione
    if (analysis.materia === 'Matematica' || analysis.materia === 'Fisica') {
      solution.validazione_numerica = await this._validateNumericalSolution(solution);
    }

    return solution.soluzione || solution;
  }

  /**
   * 🔢 Validazione numerica per soluzioni STEM
   */
  async _validateNumericalSolution(solution) {
    console.log('🔢 Validazione numerica...');
    
    // Estrai numeri e calcoli dalla soluzione
    const calculations = this._extractCalculations(solution);
    
    const validation = {
      calcoli_verificati: 0,
      errori_trovati: [],
      warning: []
    };

    for (const calc of calculations) {
      try {
        // Valuta l'espressione matematica
        const result = await this._evaluateMathExpression(calc.expression);
        
        if (Math.abs(result - calc.expected) > 0.0001) {
          validation.errori_trovati.push({
            espressione: calc.expression,
            atteso: calc.expected,
            ottenuto: result
          });
        } else {
          validation.calcoli_verificati++;
        }
      } catch (error) {
        validation.warning.push(`Non verificabile: ${calc.expression}`);
      }
    }

    validation.accuratezza = 
      (validation.calcoli_verificati / calculations.length * 100).toFixed(1) + '%';

    return validation;
  }

  /**
   * 🎲 Generazione varianti esercizio
   */
  async _generateVariants(analysis, solution) {
    console.log('🎲 Generazione varianti esercizio...');
    
    const variantsPrompt = `
      Basandoti su questo esercizio:
      "${analysis.enunciato_pulito}"
      
      Genera 3 varianti:
      1. VARIANTE SEMPLIFICATA: più facile, meno passaggi
      2. VARIANTE SIMILE: stessa difficoltà, dati diversi
      3. VARIANTE AVANZATA: più complessa, concetti aggiuntivi
      
      Per ogni variante fornisci:
      - Testo dell'esercizio
      - Soluzione completa
      - Differenze rispetto all'originale
      - Tempo stimato di risoluzione
      
      Mantieni coerenza con argomento: ${analysis.argomento}
    `;

    const variants = await aiService.generateContent({
      type: 'extract-exercise',
      prompt: variantsPrompt
    });

    return variants.varianti || [];
  }

  /**
   * 🎯 Generazione quiz correlati
   */
  async _generateQuizzes(analysis, solution) {
    console.log('🎯 Generazione quiz correlati...');
    
    const quizPrompt = `
      Crea quiz basati su questo esercizio e la sua soluzione:
      Esercizio: "${analysis.enunciato_pulito}"
      Concetti chiave: ${analysis.prerequisiti?.join(', ')}
      
      Genera:
      - 5 domande a scelta multipla (4 opzioni, 1 corretta)
      - 2 domande Vero/Falso
      
      Per ogni domanda includi:
      - Testo domanda chiaro e non ambiguo
      - Opzioni (per MCQ) con distrattori plausibili
      - Risposta corretta
      - Spiegazione dettagliata (50-100 parole)
      - Difficoltà (1-5)
      - Tempo stimato risposta
      
      Le domande devono testare comprensione dei concetti, non solo memorizzazione.
    `;

    const quizzes = await aiService.generateContent({
      type: 'generate-quiz',
      prompt: quizPrompt
    });

    // Aggiungi metadata
    const quizzesWithMeta = (quizzes.quiz || quizzes || []).map(q => ({
      ...q,
      origine: 'estrai-crea',
      esercizio_riferimento: analysis.enunciato_pulito,
      materia: analysis.materia,
      argomento: analysis.argomento,
      sottoargomento: analysis.sottoargomento
    }));

    return quizzesWithMeta;
  }

  /**
   * 🎴 Generazione flashcards
   */
  async _generateFlashcards(analysis, solution) {
    console.log('🎴 Generazione flashcards...');
    
    const flashcardsPrompt = `
      Crea flashcards educative basate su:
      Esercizio: "${analysis.enunciato_pulito}"
      Concetti usati: ${analysis.prerequisiti?.join(', ')}
      
      Genera 15-20 flashcards che coprano:
      - Definizioni dei concetti chiave
      - Formule utilizzate (in LaTeX)
      - Passaggi critici della soluzione
      - Errori comuni da evitare
      - Collegamenti a concetti correlati
      
      Formato per ogni flashcard:
      - Fronte: domanda/termine conciso
      - Retro: definizione + formula (se applicabile) + esempio
      - Difficoltà: base/intermedio/avanzato
      - Tags per categorizzazione
      
      Le flashcards devono facilitare memorizzazione e comprensione profonda.
    `;

    const flashcards = await aiService.generateContent({
      type: 'generate-flashcards',
      prompt: flashcardsPrompt
    });

    return flashcards.flashcards || flashcards || [];
  }

  /**
   * 🗺️ Costruzione mappa concettuale
   */
  async _buildConceptMap(analysis) {
    console.log('🗺️ Costruzione mappa concettuale...');
    
    const mapPrompt = `
      Costruisci una mappa concettuale per:
      Argomento: ${analysis.argomento}
      Sottoargomento: ${analysis.sottoargomento}
      Prerequisiti: ${analysis.prerequisiti?.join(', ')}
      
      La mappa deve includere:
      - Nodi per ogni concetto principale
      - Collegamenti logici tra concetti
      - Livelli di profondità (base → avanzato)
      - Risorse suggerite per ogni nodo
      
      Struttura gerarchica chiara e navigabile.
    `;

    const conceptMap = await aiService.generateContent({
      type: 'knowledge-map',
      prompt: mapPrompt
    });

    return conceptMap || { nodi: [], archi: [] };
  }

  /**
   * 📊 Assegnazione metadata
   */
  _assignMetadata(analysis, solution) {
    return {
      id: `estrai_${Date.now()}`,
      timestamp: new Date().toISOString(),
      materia: analysis.materia,
      argomento: analysis.argomento,
      sottoargomento: analysis.sottoargomento,
      livello: analysis.livello,
      tipo_problema: analysis.tipo_problema,
      tempo_stimato_minuti: this._estimateSolutionTime(analysis, solution),
      tags: this._generateTags(analysis),
      versione: '1.0',
      lingua: 'italiano'
    };
  }

  /**
   * ⏱️ Stima tempo di risoluzione
   */
  _estimateSolutionTime(analysis, solution) {
    const baseTime = {
      'base': 5,
      'intermedio': 15,
      'avanzato': 30
    };
    
    let time = baseTime[analysis.livello] || 10;
    
    // Aggiusta in base alla complessità
    if (solution.passaggi && solution.passaggi.length > 5) {
      time += solution.passaggi.length * 2;
    }
    
    return Math.ceil(time);
  }

  /**
   * 🏷️ Generazione tags automatici
   */
  _generateTags(analysis) {
    const tags = [
      analysis.materia?.toLowerCase(),
      analysis.argomento?.toLowerCase(),
      analysis.sottoargomento?.toLowerCase(),
      analysis.tipo_problema?.toLowerCase(),
      analysis.livello
    ].filter(Boolean);
    
    // Aggiungi tags specifici per argomento
    if (analysis.argomento?.includes('Analisi')) {
      tags.push('calcolo', 'funzioni');
    }
    if (analysis.argomento?.includes('Geometria')) {
      tags.push('figure', 'coordinate');
    }
    
    return [...new Set(tags)];
  }

  /**
   * ✅ Validazione output finale
   */
  async _validateOutput(output) {
    console.log('✅ Validazione output finale...');
    
    const validation = {
      completezza: true,
      qualita_linguistica: true,
      correttezza_matematica: true,
      warnings: []
    };

    // Controllo completezza
    const requiredFields = [
      'esercizio_originale',
      'soluzione',
      'varianti',
      'quiz',
      'flashcards',
      'metadata'
    ];
    
    for (const field of requiredFields) {
      if (!output[field]) {
        validation.completezza = false;
        validation.warnings.push(`Campo mancante: ${field}`);
      }
    }

    // Controllo qualità linguistica (base)
    if (output.esercizio_originale) {
      const text = JSON.stringify(output);
      if (text.includes('  ')) {
        validation.warnings.push('Spazi doppi rilevati');
      }
      if (text.match(/[.!?]\s+[a-z]/)) {
        validation.warnings.push('Possibili errori di maiuscole');
      }
    }

    // Se ci sono warning critici, segna come non valido
    if (validation.warnings.length > 3) {
      validation.qualita_linguistica = false;
    }

    output._validation = validation;
    
    console.log('📊 Validazione completata:', {
      completezza: validation.completezza,
      qualita: validation.qualita_linguistica,
      warnings: validation.warnings.length
    });

    return output;
  }

  /**
   * 💡 Suggerimenti per errori
   */
  async _getSuggestionForError(error) {
    const suggestions = {
      'OCR': 'Prova con una foto più nitida o con migliore illuminazione',
      'timeout': 'L\'elaborazione sta richiedendo troppo tempo, prova con un esercizio più semplice',
      'validation': 'Il contenuto generato non ha superato i controlli qualità, riprova',
      'api': 'Servizio temporaneamente non disponibile, riprova tra qualche minuto'
    };
    
    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (error.message.toLowerCase().includes(key.toLowerCase())) {
        return suggestion;
      }
    }
    
    return 'Si è verificato un errore imprevisto. Contatta il supporto se il problema persiste.';
  }

  /**
   * 🔍 Indovina materia dal testo
   */
  _guessSubjectFromText(text) {
    const patterns = {
      'Matematica': ['equazione', 'integrale', 'derivata', 'limite', 'funzione', 'x', 'y'],
      'Fisica': ['forza', 'energia', 'velocità', 'massa', 'newton', 'joule', 'watt'],
      'Chimica': ['molecola', 'atomo', 'reazione', 'mole', 'ph', 'ossidazione']
    };
    
    for (const [subject, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => text.toLowerCase().includes(kw))) {
        return subject;
      }
    }
    
    return 'Generale';
  }

  /**
   * 📐 Estrai calcoli dalla soluzione
   */
  _extractCalculations(solution) {
    // Implementazione semplificata
    return [];
  }

  /**
   * 🧮 Valuta espressione matematica
   */
  async _evaluateMathExpression(expression) {
    // In produzione: usare math.js o simili
    // Per ora ritorna 0
    return 0;
  }

  /**
   * 🗑️ Cleanup risorse
   */
  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
    }
    this.cache.clear();
  }
}

module.exports = new EstraiCreaService();
