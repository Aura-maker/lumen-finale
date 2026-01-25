/**
 * 🎴 GENERATORE AVANZATO FLASHCARDS - Superiore a Flashka
 * Genera flashcards intelligenti con spaced repetition e AI
 */

const aiService = require('./ai-service');
const contenuti = require('../../data/data/contenuti-tutte-materie-complete');

class FlashcardsGeneratorAdvanced {
  constructor() {
    this.config = {
      tipologie: [
        'definizione',
        'formula',
        'esempio',
        'procedura',
        'confronto',
        'causa-effetto',
        'timeline',
        'mappa-mentale'
      ],
      sm2Algorithm: {
        defaultEase: 2.5,
        minEase: 1.3,
        maxEase: 2.5,
        easyBonus: 1.3,
        minInterval: 1,
        maxInterval: 365
      },
      generazione: {
        flashcardsPerSottoargomento: 45,
        includiImmaginiAI: true,
        includiAudio: false,
        includiFormuleLaTeX: true,
        includiEsempiInterattivi: true
      },
      qualita: {
        lunghezzaFronteMin: 10,
        lunghezzaFronteMax: 100,
        lunghezzaRetroMin: 30,
        lunghezzaRetroMax: 300,
        requiresFormula: ['matematica', 'fisica', 'chimica'],
        requiresEsempio: true
      }
    };
    
    this.generatedFlashcards = [];
    this.mazzi = new Map();
    this.uniqueHashes = new Set();
  }

  /**
   * 🎴 Genera Flashcards Massive Premium
   */
  async generateMassiveFlashcards(options = {}) {
    console.log('🎴 Avvio generazione massiva flashcards premium...');
    
    const results = {
      flashcards: [],
      mazzi: [],
      perMateria: {},
      stats: {},
      errors: []
    };

    try {
      // Per ogni materia nei contenuti
      for (const [materiaKey, materiaData] of Object.entries(contenuti)) {
        if (!materiaData.materia || !materiaData.argomenti) continue;
        
        const materiaName = materiaData.materia.nome;
        console.log(`\n📚 Generazione flashcards per ${materiaName}...`);
        
        // Crea mazzo per la materia
        const mazzo = this._createMazzo(materiaName, materiaData.materia);
        
        // Per ogni argomento
        for (const argomento of materiaData.argomenti) {
          console.log(`  📖 ${argomento.titolo}...`);
          
          // Per ogni sottoargomento
          for (const sottoargomento of (argomento.sottoargomenti || [])) {
            const flashcardsBatch = await this._generateFlashcardsForSottoargomento(
              materiaName,
              argomento.titolo,
              sottoargomento,
              options
            );
            
            // Aggiungi al mazzo
            mazzo.flashcards.push(...flashcardsBatch.success);
            results.flashcards.push(...flashcardsBatch.success);
            results.errors.push(...flashcardsBatch.errors);
          }
        }
        
        // Salva mazzo
        this.mazzi.set(materiaName, mazzo);
        results.mazzi.push(mazzo);
        
        // Stats per materia
        results.perMateria[materiaName] = {
          totaleFlashcards: mazzo.flashcards.length,
          tipologie: this._countByType(mazzo.flashcards),
          difficoltaMedia: this._calculateAverageDifficulty(mazzo.flashcards)
        };
      }

      // Calcola statistiche globali
      results.stats = this._calculateGlobalStats(results);
      
      // Salva risultati
      this.generatedFlashcards.push(...results.flashcards);
      
      console.log(`\n✅ Generazione completata: ${results.flashcards.length} flashcards totali`);
      return results;

    } catch (error) {
      console.error('❌ Errore generazione flashcards:', error);
      throw error;
    }
  }

  /**
   * 🎴 Genera Flashcards per Sottoargomento
   */
  async _generateFlashcardsForSottoargomento(materia, argomento, sottoargomento, options) {
    const results = { success: [], errors: [] };
    const numCards = options.flashcardsPerSottoargomento || this.config.generazione.flashcardsPerSottoargomento;
    
    // Estrai concetti chiave dal riassunto
    const concettiChiave = await this._extractKeyConcepts(sottoargomento);
    
    // Distribuisci tipologie
    const tipologie = this._distributeTipologie(numCards);
    
    for (let i = 0; i < numCards; i++) {
      try {
        const tipo = tipologie[i];
        const concetto = concettiChiave[i % concettiChiave.length] || sottoargomento.titolo;
        
        const flashcard = await this._generateSingleFlashcard({
          materia,
          argomento,
          sottoargomento: sottoargomento.titolo,
          riassunto: sottoargomento.riassunto,
          concetto,
          tipo
        });
        
        if (flashcard && this._validateFlashcard(flashcard)) {
          results.success.push(flashcard);
        }
      } catch (error) {
        results.errors.push({
          sottoargomento: sottoargomento.titolo,
          error: error.message
        });
      }
      
      // Delay per non sovraccaricare
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`    ✅ Generate ${results.success.length}/${numCards} flashcards`);
    return results;
  }

  /**
   * 🎴 Genera Singola Flashcard Premium
   */
  async _generateSingleFlashcard(params) {
    const prompt = this._buildFlashcardPrompt(params);
    
    const result = await aiService.generateContent({
      type: 'generate-flashcards',
      prompt,
      materia: params.materia
    });

    return this._processFlashcardResult(result, params);
  }

  /**
   * 📝 Costruzione Prompt Flashcard Premium
   */
  _buildFlashcardPrompt(params) {
    const { materia, argomento, sottoargomento, riassunto, concetto, tipo } = params;
    
    const templates = {
      definizione: `Crea una flashcard PREMIUM per la definizione di "${concetto}".
                    Contesto: ${materia} - ${argomento} - ${sottoargomento}
                    
                    Basati su: "${riassunto?.substring(0, 400) || ''}"
                    
                    FRONTE: Domanda concisa e chiara che richiede la definizione
                    RETRO: 
                    - Definizione precisa e completa
                    - Formula LaTeX se applicabile
                    - Esempio concreto illuminante
                    - Mnemotecnica o trucco per ricordare
                    - Collegamenti a concetti correlati
                    
                    Usa linguaggio formale ma accessibile a uno studente liceale.`,
                    
      formula: `Crea una flashcard per la FORMULA di "${concetto}".
                Contesto: ${materia} - ${argomento}
                
                FRONTE: "Qual è la formula per [calcolare/determinare] ${concetto}?"
                RETRO:
                - Formula in LaTeX perfettamente formattata
                - Spiegazione di ogni variabile
                - Unità di misura
                - Esempio numerico risolto passo-passo
                - Casi particolari o limitazioni
                - Formule correlate`,
                
      esempio: `Crea una flashcard con ESEMPIO PRATICO di "${concetto}".
                Contesto: ${materia} - ${argomento}
                
                FRONTE: Presenta un problema/situazione reale che richiede ${concetto}
                RETRO:
                - Soluzione dettagliata con tutti i passaggi
                - Spiegazione del ragionamento
                - Varianti dell'esempio
                - Errori comuni da evitare
                - Applicazioni nella vita reale`,
                
      procedura: `Crea una flashcard per la PROCEDURA/METODO di "${concetto}".
                  Contesto: ${materia} - ${argomento}
                  
                  FRONTE: "Come si [risolve/calcola/determina] ${concetto}?"
                  RETRO:
                  - Passaggi numerati e chiari
                  - Suggerimenti per ogni passaggio
                  - Controlli da effettuare
                  - Scorciatoie utili
                  - Errori frequenti e come evitarli`,
                  
      confronto: `Crea una flashcard di CONFRONTO per "${concetto}".
                  Contesto: ${materia} - ${argomento}
                  
                  FRONTE: "Confronta ${concetto} con [concetto simile/opposto]"
                  RETRO:
                  - Tabella comparativa
                  - Similitudini chiave
                  - Differenze fondamentali
                  - Quando usare l'uno o l'altro
                  - Esempi che mostrano le differenze`,
                  
      'causa-effetto': `Crea una flashcard CAUSA-EFFETTO per "${concetto}".
                        Contesto: ${materia} - ${argomento}
                        
                        FRONTE: "Quali sono le cause/conseguenze di ${concetto}?"
                        RETRO:
                        - Cause principali (numerate)
                        - Effetti diretti
                        - Effetti indiretti
                        - Catena causale completa
                        - Esempi storici/pratici`,
                        
      timeline: `Crea una flashcard TIMELINE per "${concetto}".
                 Contesto: ${materia} - ${argomento}
                 
                 FRONTE: "Traccia l'evoluzione temporale di ${concetto}"
                 RETRO:
                 - Date/periodi chiave
                 - Eventi principali in ordine
                 - Punti di svolta
                 - Conseguenze di ogni fase
                 - Mappa visuale del tempo`,
                 
      'mappa-mentale': `Crea una flashcard MAPPA MENTALE per "${concetto}".
                        Contesto: ${materia} - ${argomento}
                        
                        FRONTE: "Mappa concettuale di ${concetto}"
                        RETRO:
                        - Concetto centrale
                        - Rami principali (3-5)
                        - Sotto-rami per ogni principale
                        - Collegamenti trasversali
                        - Parole chiave per ogni nodo`
    };

    return templates[tipo] || templates.definizione;
  }

  /**
   * ✅ Processa Risultato Flashcard
   */
  _processFlashcardResult(rawResult, metadata) {
    try {
      const flashcard = {
        id: this._generateId(),
        tipo: metadata.tipo,
        materia: metadata.materia,
        argomento: metadata.argomento,
        sottoargomento: metadata.sottoargomento,
        concetto: metadata.concetto,
        timestamp: new Date().toISOString(),
        versione: '2.0'
      };

      // Processa fronte e retro
      flashcard.fronte = rawResult.fronte || '';
      
      // Retro strutturato
      if (typeof rawResult.retro === 'string') {
        flashcard.retro = {
          testo: rawResult.retro,
          formula: null,
          esempio: null
        };
      } else {
        flashcard.retro = {
          testo: rawResult.retro?.definizione || rawResult.retro?.testo || '',
          formula: rawResult.retro?.formula || null,
          esempio: rawResult.retro?.esempio || null,
          mnemotecnica: rawResult.retro?.mnemotecnica || null,
          collegamenti: rawResult.retro?.collegamenti || [],
          prerequisiti: rawResult.retro?.prerequisiti || []
        };
      }

      // Difficoltà basata su contenuto
      flashcard.difficolta = this._calculateDifficulty(flashcard);
      
      // SM-2 fields per spaced repetition
      flashcard.sm2 = {
        ease: this.config.sm2Algorithm.defaultEase,
        interval: 1,
        repetitions: 0,
        nextReview: null,
        lastReview: null
      };
      
      // Tags intelligenti
      flashcard.tags = this._generateSmartTags(metadata, flashcard);
      
      // Media attachments (se richiesti)
      if (this.config.generazione.includiImmaginiAI) {
        flashcard.imagePrompt = this._generateImagePrompt(flashcard);
      }
      
      // Quality score
      flashcard.qualityScore = this._calculateQualityScore(flashcard);
      
      return flashcard;
      
    } catch (error) {
      console.error('Errore processamento flashcard:', error);
      return null;
    }
  }

  /**
   * ✅ Validazione Flashcard
   */
  _validateFlashcard(flashcard) {
    // Controlli base
    if (!flashcard.fronte || flashcard.fronte.length < this.config.qualita.lunghezzaFronteMin) {
      return false;
    }
    
    if (!flashcard.retro || !flashcard.retro.testo) {
      return false;
    }
    
    if (flashcard.retro.testo.length < this.config.qualita.lunghezzaRetroMin) {
      return false;
    }
    
    // Controllo formula per materie STEM
    if (this.config.qualita.requiresFormula.includes(flashcard.materia?.toLowerCase())) {
      if (!flashcard.retro.formula && flashcard.tipo === 'formula') {
        console.warn('Formula mancante per flashcard STEM');
        return false;
      }
    }
    
    // Controllo unicità
    const hash = this._hashContent(flashcard);
    if (this.uniqueHashes.has(hash)) {
      console.warn('Flashcard duplicata');
      return false;
    }
    this.uniqueHashes.add(hash);
    
    // Controllo qualità
    if (flashcard.qualityScore < 0.7) {
      console.warn('Flashcard sotto soglia qualità');
      return false;
    }
    
    return true;
  }

  /**
   * 🧠 Estrazione Concetti Chiave
   */
  async _extractKeyConcepts(sottoargomento) {
    if (!sottoargomento.riassunto) {
      return [sottoargomento.titolo];
    }
    
    try {
      const result = await aiService.generateContent({
        type: 'extract-concepts',
        prompt: `Dal seguente testo, estrai 15-20 concetti chiave fondamentali:
                 "${sottoargomento.riassunto.substring(0, 1000)}"
                 
                 Ritorna SOLO la lista di concetti, uno per riga, ordinati per importanza.`
      });
      
      const concepts = result.content?.split('\n')
        .filter(c => c.trim().length > 0)
        .map(c => c.replace(/^[-*•]\s*/, '').trim()) || [];
      
      return concepts.length > 0 ? concepts : [sottoargomento.titolo];
      
    } catch (error) {
      console.warn('Errore estrazione concetti:', error);
      return [sottoargomento.titolo];
    }
  }

  /**
   * 📊 Calcolo Difficoltà
   */
  _calculateDifficulty(flashcard) {
    let difficulty = 'intermedio';
    
    // Fattori che aumentano la difficoltà
    const complexityFactors = {
      hasFormula: flashcard.retro.formula !== null,
      longText: flashcard.retro.testo.length > 200,
      multiplePrerequisites: (flashcard.retro.prerequisiti?.length || 0) > 2,
      isComparison: flashcard.tipo === 'confronto',
      isProcedure: flashcard.tipo === 'procedura'
    };
    
    const complexityScore = Object.values(complexityFactors).filter(Boolean).length;
    
    if (complexityScore <= 1) difficulty = 'base';
    else if (complexityScore >= 4) difficulty = 'avanzato';
    
    return difficulty;
  }

  /**
   * 🏷️ Generazione Tags Intelligenti
   */
  _generateSmartTags(metadata, flashcard) {
    const tags = new Set();
    
    // Tags base
    tags.add(metadata.materia?.toLowerCase().replace(/\s+/g, '-'));
    tags.add(metadata.argomento?.toLowerCase().replace(/\s+/g, '-'));
    tags.add(metadata.tipo);
    tags.add(`difficolta-${flashcard.difficolta}`);
    
    // Tags dal concetto
    if (metadata.concetto) {
      const words = metadata.concetto.toLowerCase().split(/\s+/);
      words.slice(0, 3).forEach(w => tags.add(w));
    }
    
    // Tags speciali
    if (flashcard.retro.formula) tags.add('con-formula');
    if (flashcard.retro.esempio) tags.add('con-esempio');
    if (flashcard.retro.mnemotecnica) tags.add('mnemotecnica');
    
    return Array.from(tags);
  }

  /**
   * 🎨 Genera Prompt Immagine
   */
  _generateImagePrompt(flashcard) {
    return `Educational illustration for: ${flashcard.concetto}. 
            Style: Clean, minimal, academic diagram. 
            Include: ${flashcard.tipo === 'formula' ? 'mathematical notation' : 'conceptual visualization'}.
            Context: ${flashcard.materia} - ${flashcard.argomento}`;
  }

  /**
   * 📊 Calcolo Quality Score
   */
  _calculateQualityScore(flashcard) {
    let score = 1.0;
    
    // Penalità per contenuti troppo corti
    if (flashcard.fronte.length < this.config.qualita.lunghezzaFronteMin) score -= 0.2;
    if (flashcard.retro.testo.length < this.config.qualita.lunghezzaRetroMin) score -= 0.2;
    
    // Bonus per contenuti extra
    if (flashcard.retro.formula) score += 0.1;
    if (flashcard.retro.esempio) score += 0.1;
    if (flashcard.retro.mnemotecnica) score += 0.05;
    if (flashcard.retro.collegamenti?.length > 0) score += 0.05;
    
    // Controllo grammaticale base
    const text = flashcard.fronte + ' ' + flashcard.retro.testo;
    if (text.includes('  ')) score -= 0.05;
    if (text.match(/[.!?]\s+[a-z]/)) score -= 0.05;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 📚 Crea Mazzo
   */
  _createMazzo(nome, metadata) {
    return {
      id: this._generateId('mazzo'),
      nome,
      descrizione: metadata.descrizione || '',
      materia: nome,
      flashcards: [],
      createdAt: new Date().toISOString(),
      lastStudied: null,
      stats: {
        totale: 0,
        imparate: 0,
        daRipassare: 0,
        difficili: 0
      }
    };
  }

  /**
   * 🎲 Distribuzione Tipologie
   */
  _distributeTipologie(num) {
    const tipologie = [];
    const tipi = this.config.tipologie;
    
    // Distribuzione bilanciata
    for (let i = 0; i < num; i++) {
      tipologie.push(tipi[i % tipi.length]);
    }
    
    // Shuffle
    return tipologie.sort(() => Math.random() - 0.5);
  }

  /**
   * 🔐 Hash Content
   */
  _hashContent(flashcard) {
    const content = flashcard.fronte + flashcard.retro.testo;
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
  _generateId(prefix = 'flashcard') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 📊 Count By Type
   */
  _countByType(flashcards) {
    const counts = {};
    flashcards.forEach(f => {
      counts[f.tipo] = (counts[f.tipo] || 0) + 1;
    });
    return counts;
  }

  /**
   * 📊 Calculate Average Difficulty
   */
  _calculateAverageDifficulty(flashcards) {
    if (flashcards.length === 0) return 'intermedio';
    
    const difficultyMap = { 'base': 1, 'intermedio': 2, 'avanzato': 3 };
    const sum = flashcards.reduce((acc, f) => acc + (difficultyMap[f.difficolta] || 2), 0);
    const avg = sum / flashcards.length;
    
    if (avg <= 1.5) return 'base';
    if (avg >= 2.5) return 'avanzato';
    return 'intermedio';
  }

  /**
   * 📊 Calculate Global Stats
   */
  _calculateGlobalStats(results) {
    return {
      totaleFlashcards: results.flashcards.length,
      totaleMazzi: results.mazzi.length,
      tipologieUsate: this._countByType(results.flashcards),
      qualitaMedia: this._calculateAverageQuality(results.flashcards),
      flashcardsPerMateria: Object.keys(results.perMateria).map(m => ({
        materia: m,
        totale: results.perMateria[m].totaleFlashcards
      }))
    };
  }

  /**
   * 📊 Calculate Average Quality
   */
  _calculateAverageQuality(flashcards) {
    if (flashcards.length === 0) return 0;
    
    const sum = flashcards.reduce((acc, f) => acc + (f.qualityScore || 0), 0);
    return (sum / flashcards.length).toFixed(2);
  }

  /**
   * 🎯 Algoritmo SM-2 per Spaced Repetition
   */
  updateSM2(flashcard, quality) {
    // quality: 0-5 (0=fail, 5=perfect)
    const sm2 = flashcard.sm2;
    
    if (quality < 3) {
      // Reset if failed
      sm2.repetitions = 0;
      sm2.interval = 1;
    } else {
      // Success
      sm2.repetitions++;
      
      if (sm2.repetitions === 1) {
        sm2.interval = 1;
      } else if (sm2.repetitions === 2) {
        sm2.interval = 6;
      } else {
        sm2.interval = Math.round(sm2.interval * sm2.ease);
      }
      
      // Update ease factor
      sm2.ease = Math.max(
        this.config.sm2Algorithm.minEase,
        Math.min(
          this.config.sm2Algorithm.maxEase,
          sm2.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        )
      );
    }
    
    // Set next review date
    sm2.lastReview = new Date().toISOString();
    sm2.nextReview = new Date(Date.now() + sm2.interval * 24 * 60 * 60 * 1000).toISOString();
    
    return sm2;
  }

  /**
   * 🔍 Ricerca Flashcards
   */
  searchFlashcards(query, filters = {}) {
    let results = [...this.generatedFlashcards];
    
    // Ricerca testuale
    if (query) {
      const searchTerms = query.toLowerCase().split(/\s+/);
      results = results.filter(f => {
        const searchableText = [
          f.fronte,
          f.retro.testo,
          f.concetto || '',
          ...(f.tags || [])
        ].join(' ').toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
      });
    }
    
    // Filtri
    if (filters.materia) {
      results = results.filter(f => f.materia === filters.materia);
    }
    if (filters.difficolta) {
      results = results.filter(f => f.difficolta === filters.difficolta);
    }
    if (filters.tipo) {
      results = results.filter(f => f.tipo === filters.tipo);
    }
    if (filters.daRipassare) {
      const now = new Date();
      results = results.filter(f => 
        f.sm2.nextReview && new Date(f.sm2.nextReview) <= now
      );
    }
    
    return results;
  }

  /**
   * 📤 Esporta Flashcards
   */
  exportFlashcards(format = 'json', flashcards = null) {
    const data = flashcards || this.generatedFlashcards;
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
        
      case 'anki':
        return this._exportAnki(data);
        
      case 'csv':
        return this._exportCSV(data);
        
      default:
        return data;
    }
  }

  /**
   * 🎴 Export Anki
   */
  _exportAnki(flashcards) {
    return flashcards.map(f => ({
      deckName: `ImparaFacile::${f.materia}::${f.argomento}`,
      modelName: 'Basic',
      fields: {
        Front: f.fronte,
        Back: f.retro.formula 
          ? `${f.retro.testo}\n\nFormula: ${f.retro.formula}\n\nEsempio: ${f.retro.esempio || 'N/A'}`
          : f.retro.testo
      },
      tags: f.tags,
      options: {
        allowDuplicate: false
      }
    }));
  }

  /**
   * 📄 Export CSV
   */
  _exportCSV(flashcards) {
    const csv = ['Fronte,Retro,Materia,Argomento,Tipo,Difficoltà,Tags'];
    
    flashcards.forEach(f => {
      const fronte = f.fronte.replace(/"/g, '""');
      const retro = f.retro.testo.replace(/"/g, '""');
      const tags = f.tags.join(';');
      csv.push(`"${fronte}","${retro}","${f.materia}","${f.argomento}","${f.tipo}","${f.difficolta}","${tags}"`);
    });
    
    return csv.join('\n');
  }
}

module.exports = new FlashcardsGeneratorAdvanced();
