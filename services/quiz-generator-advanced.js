/**
 * 🎯 GENERATORE AVANZATO QUIZ - Qualità Premium
 * Supera Flashka in ogni aspetto
 */

const aiService = require('./ai-service');
const contenuti = require('../../data/data/contenuti-tutte-materie-complete');

class QuizGeneratorAdvanced {
  constructor() {
    this.config = {
      tipologie: ['MCQ', 'VF', 'numerica', 'completamento', 'matching', 'ordinamento', 'errore_concettuale'],
      difficolta: {
        livelli: [1, 2, 3, 4, 5],
        distribuzione: [0.2, 0.25, 0.25, 0.2, 0.1]
      },
      qualita: {
        lunghezzaDomandaMin: 20,
        lunghezzaDomandaMax: 200,
        lunghezzaSpiegazioneMin: 50,
        lunghezzaSpiegazioneMax: 150,
        controlloGrammaticale: true,
        verificaCoerenza: true
      },
      generazione: {
        quizPerSottoargomento: 25,
        batchSize: 10,
        cacheEnabled: true
      }
    };
    
    this.cache = new Map();
    this.generatedQuizzes = [];
    this.uniqueHashes = new Set();
  }

  /**
   * 🎯 Genera Quiz Massivi da Contenuti
   */
  async generateMassiveQuizzes(options = {}) {
    console.log('🎯 Avvio generazione massiva quiz premium...');
    const results = {
      quiz: [],
      perMateria: {},
      errors: [],
      stats: {}
    };

    try {
      // Analizza tutti i contenuti disponibili
      for (const [materiaKey, materiaData] of Object.entries(contenuti)) {
        if (!materiaData.materia || !materiaData.argomenti) continue;
        
        const materiaName = materiaData.materia.nome;
        console.log(`\n📚 Generazione quiz per ${materiaName}...`);
        
        results.perMateria[materiaName] = {
          quiz: [],
          argomentiProcessati: 0
        };

        // Per ogni argomento
        for (const argomento of materiaData.argomenti) {
          console.log(`  📖 ${argomento.titolo}...`);
          
          // Per ogni sottoargomento
          for (const sottoargomento of (argomento.sottoargomenti || [])) {
            const quizBatch = await this._generateQuizForSottoargomento(
              materiaName,
              argomento.titolo,
              sottoargomento,
              options
            );
            
            results.quiz.push(...quizBatch.success);
            results.perMateria[materiaName].quiz.push(...quizBatch.success);
            results.errors.push(...quizBatch.errors);
          }
          
          results.perMateria[materiaName].argomentiProcessati++;
        }
      }

      // Calcola statistiche
      results.stats = this._calculateStats(results);
      
      // Salva risultati
      this.generatedQuizzes.push(...results.quiz);
      
      console.log(`\n✅ Generazione completata: ${results.quiz.length} quiz totali`);
      return results;

    } catch (error) {
      console.error('❌ Errore generazione massiva:', error);
      throw error;
    }
  }

  /**
   * 🎲 Genera Quiz per Sottoargomento
   */
  async _generateQuizForSottoargomento(materia, argomento, sottoargomento, options) {
    const results = { success: [], errors: [] };
    const numQuiz = options.quizPerSottoargomento || this.config.generazione.quizPerSottoargomento;
    
    // Distribuisci tipologie equamente
    const tipologie = this._distributeTipologie(numQuiz);
    
    for (let i = 0; i < numQuiz; i++) {
      try {
        const tipo = tipologie[i];
        const difficolta = this._selectDifficolta();
        
        const quiz = await this._generateSingleQuiz({
          materia,
          argomento,
          sottoargomento: sottoargomento.titolo,
          riassunto: sottoargomento.riassunto,
          tipo,
          difficolta
        });
        
        if (quiz && this._validateQuiz(quiz)) {
          results.success.push(quiz);
        }
      } catch (error) {
        results.errors.push({
          sottoargomento: sottoargomento.titolo,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * 🎯 Genera Singolo Quiz
   */
  async _generateSingleQuiz(params) {
    // Check cache
    const cacheKey = this._getCacheKey(params);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const prompt = this._buildQuizPrompt(params);
    
    const result = await aiService.generateContent({
      type: 'generate-quiz',
      prompt,
      materia: params.materia
    });

    const quiz = this._processQuizResult(result, params);
    
    // Cache se valido
    if (quiz) {
      this.cache.set(cacheKey, quiz);
    }
    
    return quiz;
  }

  /**
   * 📝 Costruzione Prompt Quiz Premium
   */
  _buildQuizPrompt(params) {
    const { materia, argomento, sottoargomento, riassunto, tipo, difficolta } = params;
    
    const templates = {
      MCQ: `Genera una domanda a scelta multipla PREMIUM di difficoltà ${difficolta}/5.
            Contesto: ${materia} - ${argomento} - ${sottoargomento}
            
            Basati su questo contenuto:
            "${riassunto?.substring(0, 500) || sottoargomento}"
            
            REQUISITI OBBLIGATORI:
            1. Domanda chiara, non ambigua, grammaticalmente perfetta
            2. Esattamente 4 opzioni
            3. 3 distrattori plausibili basati su errori comuni degli studenti
            4. Spiegazione dettagliata (80-120 parole) che motiva OGNI opzione
            5. Tempo stimato realistico per uno studente medio
            
            Formato JSON richiesto:
            {
              "domanda": "...",
              "opzioni": ["A) ...", "B) ...", "C) ...", "D) ..."],
              "risposta_corretta": 0,
              "spiegazione": "...",
              "distrattori_motivazione": ["perché A è sbagliato", "perché B...", "perché C..."],
              "tempo_stimato_secondi": 60,
              "concetti_testati": ["concetto1", "concetto2"],
              "prerequisiti": ["prereq1", "prereq2"]
            }`,
            
      VF: `Genera un'affermazione Vero/Falso SOFISTICATA di difficoltà ${difficolta}/5.
           Contesto: ${materia} - ${argomento} - ${sottoargomento}
           
           L'affermazione deve:
           - Testare comprensione profonda, non memorizzazione
           - Includere dettagli sottili che richiedono ragionamento
           - Avere spiegazione che evidenzi le sfumature
           
           Formato JSON:
           {
             "affermazione": "...",
             "risposta_corretta": true/false,
             "spiegazione": "...",
             "tranello": "quale aspetto potrebbe confondere",
             "eccezioni": "eventuali casi particolari"
           }`,
           
      errore_concettuale: `Genera un esercizio "Trova l'errore concettuale" di difficoltà ${difficolta}/5.
                           Contesto: ${materia} - ${argomento} - ${sottoargomento}
                           
                           Presenta un ragionamento o soluzione con un errore sottile ma importante.
                           Lo studente deve identificare e correggere l'errore.
                           
                           Formato JSON:
                           {
                             "testo_con_errore": "...",
                             "errore_nascosto": "descrizione dell'errore",
                             "correzione": "versione corretta",
                             "spiegazione": "perché è importante questo errore",
                             "errori_comuni_correlati": ["errore1", "errore2"]
                           }`,
                           
      numerica: `Genera un problema numerico REALISTICO di difficoltà ${difficolta}/5.
                 Contesto: ${materia} - ${argomento} - ${sottoargomento}
                 
                 Il problema deve:
                 - Avere applicazione pratica/reale
                 - Richiedere ${difficolta > 3 ? 'multipli' : 'pochi'} passaggi
                 - Includere unità di misura appropriate
                 
                 Formato JSON:
                 {
                   "problema": "...",
                   "dati": { "dato1": "valore1", "dato2": "valore2" },
                   "incognite": ["x", "y"],
                   "passaggi_soluzione": [
                     { "descrizione": "...", "formula": "...", "calcolo": "...", "risultato": "..." }
                   ],
                   "risultato_finale": "... con unità",
                   "verifica": "come verificare il risultato",
                   "errori_comuni": ["errore1", "errore2"]
                 }`
    };

    return templates[tipo] || templates.MCQ;
  }

  /**
   * ✅ Processa e Valida Risultato Quiz
   */
  _processQuizResult(rawResult, metadata) {
    try {
      const quiz = {
        id: this._generateId(),
        tipo: metadata.tipo,
        materia: metadata.materia,
        argomento: metadata.argomento,
        sottoargomento: metadata.sottoargomento,
        difficolta: metadata.difficolta,
        timestamp: new Date().toISOString(),
        versione: '2.0'
      };

      // Estrai dati in base al tipo
      if (metadata.tipo === 'MCQ') {
        quiz.domanda = rawResult.domanda;
        quiz.opzioni = rawResult.opzioni;
        quiz.rispostaCorretta = rawResult.risposta_corretta;
        quiz.spiegazione = rawResult.spiegazione;
        quiz.distratториMotivazione = rawResult.distrattori_motivazione;
      } else if (metadata.tipo === 'VF') {
        quiz.affermazione = rawResult.affermazione;
        quiz.rispostaCorretta = rawResult.risposta_corretta;
        quiz.spiegazione = rawResult.spiegazione;
        quiz.tranello = rawResult.tranello;
      } else if (metadata.tipo === 'errore_concettuale') {
        quiz.testoConErrore = rawResult.testo_con_errore;
        quiz.erroreNascosto = rawResult.errore_nascosto;
        quiz.correzione = rawResult.correzione;
        quiz.spiegazione = rawResult.spiegazione;
      }

      // Metadati comuni
      quiz.tempoStimato = rawResult.tempo_stimato_secondi || this._stimaTempo(metadata.tipo, metadata.difficolta);
      quiz.concettiTestati = rawResult.concetti_testati || [];
      quiz.prerequisiti = rawResult.prerequisiti || [];
      quiz.tags = this._generateTags(metadata);
      
      // Score qualità
      quiz.qualityScore = this._calculateQualityScore(quiz);
      
      return quiz;
      
    } catch (error) {
      console.error('Errore processamento quiz:', error);
      return null;
    }
  }

  /**
   * ✅ Validazione Quiz
   */
  _validateQuiz(quiz) {
    // Controlli base
    if (!quiz.id || !quiz.tipo) return false;
    
    // Controlli specifici per tipo
    if (quiz.tipo === 'MCQ') {
      if (!quiz.domanda || quiz.domanda.length < this.config.qualita.lunghezzaDomandaMin) return false;
      if (!quiz.opzioni || quiz.opzioni.length !== 4) return false;
      if (quiz.rispostaCorretta === undefined) return false;
      if (!quiz.spiegazione || quiz.spiegazione.length < this.config.qualita.lunghezzaSpiegazioneMin) return false;
    }
    
    // Controllo unicità
    const hash = this._hashContent(quiz);
    if (this.uniqueHashes.has(hash)) {
      console.warn('Quiz duplicato rilevato');
      return false;
    }
    this.uniqueHashes.add(hash);
    
    // Controllo qualità minima
    if (quiz.qualityScore && quiz.qualityScore < 0.7) {
      console.warn('Quiz sotto soglia qualità:', quiz.qualityScore);
      return false;
    }
    
    return true;
  }

  /**
   * 📊 Calcolo Quality Score
   */
  _calculateQualityScore(quiz) {
    let score = 1.0;
    
    // Penalità per contenuti troppo corti o lunghi
    const textLength = (quiz.domanda || quiz.affermazione || '').length;
    if (textLength < this.config.qualita.lunghezzaDomandaMin) score -= 0.3;
    if (textLength > this.config.qualita.lunghezzaDomandaMax) score -= 0.1;
    
    // Bonus per metadati completi
    if (quiz.concettiTestati && quiz.concettiTestati.length > 0) score += 0.1;
    if (quiz.prerequisiti && quiz.prerequisiti.length > 0) score += 0.1;
    
    // Controllo grammaticale base
    const text = JSON.stringify(quiz);
    if (text.includes('  ')) score -= 0.1; // Spazi doppi
    if (text.match(/[.!?]\s+[a-z]/)) score -= 0.1; // Maiuscole mancanti
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 🎲 Distribuzione Tipologie
   */
  _distributeTipologie(numQuiz) {
    const tipologie = [];
    const tipi = this.config.tipologie;
    
    for (let i = 0; i < numQuiz; i++) {
      tipologie.push(tipi[i % tipi.length]);
    }
    
    // Shuffle per varietà
    return tipologie.sort(() => Math.random() - 0.5);
  }

  /**
   * 🎲 Selezione Difficoltà Pesata
   */
  _selectDifficolta() {
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < this.config.difficolta.distribuzione.length; i++) {
      cumulative += this.config.difficolta.distribuzione[i];
      if (random < cumulative) {
        return i + 1;
      }
    }
    
    return 3; // Default medio
  }

  /**
   * ⏱️ Stima Tempo
   */
  _stimaTempo(tipo, difficolta) {
    const tempiBase = {
      'MCQ': 60,
      'VF': 30,
      'numerica': 180,
      'completamento': 45,
      'matching': 90,
      'ordinamento': 60,
      'errore_concettuale': 120
    };
    
    let tempo = tempiBase[tipo] || 60;
    tempo = tempo * (1 + (difficolta - 3) * 0.15);
    
    return Math.round(tempo);
  }

  /**
   * 🏷️ Generazione Tags
   */
  _generateTags(metadata) {
    const tags = [
      metadata.materia?.toLowerCase().replace(/\s+/g, '-'),
      metadata.argomento?.toLowerCase().replace(/\s+/g, '-'),
      metadata.tipo?.toLowerCase(),
      `livello-${metadata.difficolta}`
    ].filter(Boolean);
    
    if (metadata.sottoargomento) {
      const words = metadata.sottoargomento.toLowerCase().split(/\s+/);
      tags.push(...words.slice(0, 3));
    }
    
    return [...new Set(tags)];
  }

  /**
   * 🔑 Cache Key
   */
  _getCacheKey(params) {
    return `${params.materia}-${params.argomento}-${params.sottoargomento}-${params.tipo}-${params.difficolta}`;
  }

  /**
   * 🔐 Hash Content
   */
  _hashContent(quiz) {
    const content = JSON.stringify({
      tipo: quiz.tipo,
      domanda: quiz.domanda || quiz.affermazione,
      materia: quiz.materia,
      argomento: quiz.argomento
    });
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 🆔 Generate ID
   */
  _generateId() {
    return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 Calculate Stats
   */
  _calculateStats(results) {
    const stats = {
      totaleQuiz: results.quiz.length,
      perTipologia: {},
      perDifficolta: {},
      perMateria: {},
      qualitaMedia: 0,
      tempoMedioStimato: 0
    };

    results.quiz.forEach(quiz => {
      // Per tipologia
      stats.perTipologia[quiz.tipo] = (stats.perTipologia[quiz.tipo] || 0) + 1;
      
      // Per difficoltà
      stats.perDifficolta[quiz.difficolta] = (stats.perDifficolta[quiz.difficolta] || 0) + 1;
      
      // Per materia
      stats.perMateria[quiz.materia] = (stats.perMateria[quiz.materia] || 0) + 1;
      
      // Qualità media
      stats.qualitaMedia += quiz.qualityScore || 0;
      
      // Tempo medio
      stats.tempoMedioStimato += quiz.tempoStimato || 0;
    });

    if (results.quiz.length > 0) {
      stats.qualitaMedia = (stats.qualitaMedia / results.quiz.length).toFixed(2);
      stats.tempoMedioStimato = Math.round(stats.tempoMedioStimato / results.quiz.length);
    }

    return stats;
  }

  /**
   * 🔍 Ricerca Quiz
   */
  searchQuizzes(query, filters = {}) {
    let results = [...this.generatedQuizzes];
    
    // Filtra per query testuale
    if (query) {
      const searchTerms = query.toLowerCase().split(/\s+/);
      results = results.filter(quiz => {
        const searchableText = [
          quiz.domanda || quiz.affermazione || '',
          quiz.spiegazione || '',
          quiz.materia || '',
          quiz.argomento || '',
          quiz.sottoargomento || '',
          ...(quiz.tags || [])
        ].join(' ').toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
      });
    }
    
    // Applica filtri
    if (filters.materia) {
      results = results.filter(q => q.materia === filters.materia);
    }
    if (filters.difficolta) {
      results = results.filter(q => q.difficolta === filters.difficolta);
    }
    if (filters.tipo) {
      results = results.filter(q => q.tipo === filters.tipo);
    }
    
    return results;
  }

  /**
   * 📤 Esporta Quiz
   */
  exportQuizzes(format = 'json', quizzes = null) {
    const data = quizzes || this.generatedQuizzes;
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
        
      case 'csv':
        return this._exportCSV(data);
        
      case 'pdf':
        return this._exportPDF(data);
        
      default:
        return data;
    }
  }

  /**
   * 📄 Export CSV
   */
  _exportCSV(quizzes) {
    const csv = ['Tipo,Materia,Argomento,Domanda,Risposta,Difficoltà,Tempo'];
    
    quizzes.forEach(q => {
      const domanda = (q.domanda || q.affermazione || '').replace(/"/g, '""');
      const risposta = q.rispostaCorretta?.toString() || '';
      csv.push(`"${q.tipo}","${q.materia}","${q.argomento}","${domanda}","${risposta}",${q.difficolta},${q.tempoStimato}`);
    });
    
    return csv.join('\n');
  }

  /**
   * 📄 Export PDF (placeholder)
   */
  _exportPDF(quizzes) {
    // In produzione: usare libreria PDF
    return {
      message: 'PDF export requires additional configuration',
      quizCount: quizzes.length
    };
  }
}

module.exports = new QuizGeneratorAdvanced();
