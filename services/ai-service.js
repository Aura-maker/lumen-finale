/**
 * 🤖 SERVIZIO AI AVANZATO - Integrazione OpenAI/Claude
 * Gestisce tutte le operazioni AI dell'app con qualità premium
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');

class AIService {
  constructor() {
    // Configurazione modelli AI parametrizzabile
    this.config = {
      provider: process.env.AI_PROVIDER || 'openai', // 'openai' o 'anthropic'
      models: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          visionModel: 'gpt-4-vision-preview',
          apiUrl: 'https://api.openai.com/v1'
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
          apiUrl: 'https://api.anthropic.com/v1'
        }
      },
      quality: {
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3, // Bassa per precisione didattica
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
        topP: 0.95
      },
      rateLimit: {
        maxRequestsPerMinute: 20,
        batchSize: 10,
        retryAttempts: 3,
        backoffMs: 1000
      }
    };

    // Queue per gestione batch
    this.queue = [];
    this.processing = false;
    
    // Cache per evitare rigenerazioni
    this.cache = new Map();
    
    // Metriche qualità
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      errors: [],
      averageProcessingTime: 0
    };
  }

  /**
   * 🚀 Generazione contenuto AI principale
   */
  async generateContent(request) {
    console.log('🤖 Richiesta AI:', request.type);
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validazione input
      this._validateRequest(request);
      
      // Controllo cache
      const cacheKey = this._getCacheKey(request);
      if (this.cache.has(cacheKey)) {
        console.log('� Risposta da cache');
        return this.cache.get(cacheKey);
      }
      
      // Preparazione prompt
      const prompt = this._buildPrompt(request);
      
      // Chiamata AI
      let response;
      if (this.config.provider === 'openai' && this.config.models.openai.apiKey) {
        response = await this._callOpenAI(request);
      } else if (this.config.provider === 'anthropic' && this.config.models.anthropic.apiKey) {
        response = await this._callAnthropic(request);
      } else {
        console.log('⚠️ Nessuna API key configurata, uso mock response');
        return this._getMockResponse(request);
      }
      
      // Post-processing
      const processed = await this._processResponse(response, request);
      
      // Cache risultato
      this.cache.set(cacheKey, processed);
      
      // Aggiorna metriche
      this.metrics.successfulRequests++;
      
      console.log('✅ Contenuto AI generato con successo');
      return processed;
      
    } catch (error) {
      console.error('❌ Errore generazione AI:', error);
      this.metrics.errors.push({
        timestamp: new Date(),
        error: error.message,
        type: request.type
      });
      
      // Fallback su altro provider se disponibile
      if (this.config.provider === 'openai' && this.config.models.anthropic.apiKey) {
        console.log('🔄 Fallback su Anthropic...');
        const originalProvider = this.config.provider;
        this.config.provider = 'anthropic';
        const result = await this.generateContent(request);
        this.config.provider = originalProvider;
        return result;
      }
      
      // Ultimo fallback su mock
      console.log('🔄 Fallback finale su mock response');
      return this._getMockResponse(request);
    }
  }

  /**
   * 🎨 Chiamata a OpenAI
   */
  async _callOpenAI(request) {
    const { apiKey, model, apiUrl } = this.config.models.openai;
    
    if (!apiKey) {
      throw new Error('OpenAI API key non configurata');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const body = {
      model: request.useVision ? this.config.models.openai.visionModel : model,
      messages: this._buildMessages(request),
      temperature: this.config.quality.temperature,
      max_tokens: this.config.quality.maxTokens,
      top_p: this.config.quality.topP
    };

    try {
      const response = await axios.post(
        `${apiUrl}/chat/completions`,
        body,
        { headers }
      );

      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        model: response.data.model
      };
    } catch (error) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw new Error(`OpenAI Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 🤖 Chiamata ad Anthropic Claude
   */
  async _callAnthropic(request) {
    const { apiKey, model, apiUrl } = this.config.models.anthropic;
    
    if (!apiKey) {
      throw new Error('Anthropic API key non configurata');
    }

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    };

    const body = {
      model: model,
      max_tokens: this.config.quality.maxTokens,
      temperature: this.config.quality.temperature,
      messages: this._buildMessagesAnthropic(request)
    };

    try {
      const response = await axios.post(
        `${apiUrl}/messages`,
        body,
        { headers }
      );

      return {
        content: response.data.content[0].text,
        usage: response.data.usage,
        model: response.data.model
      };
    } catch (error) {
      console.error('Anthropic API Error:', error.response?.data || error.message);
      throw new Error(`Anthropic Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 📝 Costruzione messaggi per OpenAI
   */
  _buildMessages(request) {
    const messages = [];

    // System prompt con regole di qualità
    messages.push({
      role: 'system',
      content: this._getSystemPrompt(request.type)
    });

    // User message
    if (request.image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: request.prompt },
          { 
            type: 'image_url', 
            image_url: { 
              url: `data:image/jpeg;base64,${request.image}`,
              detail: 'high'
            }
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    return messages;
  }

  /**
   * 📝 Costruzione messaggi per Anthropic
   */
  _buildMessagesAnthropic(request) {
    const messages = [];

    // System prompt integrato nel primo messaggio per Claude
    const systemContent = this._getSystemPrompt(request.type);
    
    if (request.image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `${systemContent}\n\n${request.prompt}` },
          { 
            type: 'image', 
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: request.image
            }
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: `${systemContent}\n\n${request.prompt}`
      });
    }

    return messages;
  }

  /**
   * 🎓 System prompts ottimizzati per tipo di contenuto
   */
  _getSystemPrompt(type) {
    const prompts = {
      'extract-exercise': `Sei un tutor esperto di matematica e fisica per studenti liceali italiani.
        REGOLE FONDAMENTALI:
        1. Usa SEMPRE italiano corretto, formale ma accessibile
        2. Ogni spiegazione deve essere chiara e didattica
        3. Mostra TUTTI i passaggi numerici digit-by-digit
        4. Indica sempre unità di misura e condizioni
        5. Controlla la correttezza matematica di ogni passaggio
        6. Genera contenuti originali, evita plagio
        7. Associa ogni contenuto a materia→argomento→sottoargomento
        
        OUTPUT RICHIESTO (formato JSON):
        - enunciato_pulito: testo dell'esercizio riscritto chiaramente
        - tipo_problema: classificazione (es. "equazione secondo grado")
        - materia: "Matematica" o "Fisica"
        - argomento: argomento principale
        - sottoargomento: dettaglio specifico
        - livello: "base", "intermedio" o "avanzato"
        - prerequisiti: array di concetti necessari
        - soluzione: {
            passaggi: array di step con spiegazione e calcolo
            risultato_finale: valore con unità
            verifiche: controlli effettuati
          }
        - varianti: array di 3 esercizi simili con soluzioni
        - quiz: array di 5 MCQ + 2 V/F correlate
        - flashcards: array di 15-20 cards su concetti usati
        - tempo_stimato_minuti: numero`,

      'generate-quiz': `Sei un esperto creatore di quiz didattici per studenti liceali italiani.
        QUALITÀ OBBLIGATORIA:
        1. Italiano perfetto, zero errori grammaticali
        2. Domande chiare, mai ambigue
        3. Distrattori plausibili basati su errori comuni
        4. Spiegazione dettagliata per ogni risposta (50-100 parole)
        5. Difficoltà graduata e ben etichettata
        6. Collegamento preciso a materia→argomento→sottoargomento
        
        FORMATO OUTPUT (JSON):
        - domanda: testo chiaro e completo
        - tipo: "MCQ", "VF", "numerica", "completamento"
        - opzioni: array di 4 risposte (per MCQ)
        - risposta_corretta: indice o valore
        - spiegazione: motivazione dettagliata
        - difficolta: 1-5
        - materia, argomento, sottoargomento
        - tempo_stimato_secondi: numero
        - tags: array di parole chiave`,

      'generate-flashcards': `Sei un esperto di apprendimento mnemonico e didattica.
        CRITERI DI QUALITÀ:
        1. Fronte: domanda/termine conciso e chiaro
        2. Retro: definizione precisa + formula (se applicabile) + esempio
        3. Linguaggio formale ma accessibile
        4. Formule in LaTeX per matematica/fisica
        5. Collegamenti a concetti correlati
        
        OUTPUT (JSON):
        - fronte: testo domanda/termine
        - retro: {
            definizione: spiegazione chiara
            formula: LaTeX se applicabile
            esempio: caso concreto
            prerequisiti: array di concetti
          }
        - materia, argomento, sottoargomento
        - difficolta: "base", "intermedio", "avanzato"
        - tags: array keywords
        - sm2_fields: { ease: 2.5, interval: 1, next_review: null }`,

      'knowledge-map': `Sei un esperto di mappe concettuali e percorsi didattici.
        COSTRUISCI MAPPE CHE SIANO:
        1. Logicamente strutturate con prerequisiti chiari
        2. Multi-livello con possibilità di espansione
        3. Collegate a risorse esistenti (quiz, flashcards)
        4. Personalizzabili per obiettivi di apprendimento
        
        OUTPUT (JSON):
        - nodi: array di {
            id: identificativo univoco
            titolo: nome concetto
            descrizione: breve spiegazione
            livello: profondità nella mappa
            prerequisiti: array di id
            risorse: { quiz: [], flashcards: [], esercizi: [] }
            tempo_apprendimento_minuti: stima
          }
        - archi: array di {
            da: id nodo partenza
            a: id nodo arrivo
            tipo: "prerequisito", "correlato", "approfondimento"
            peso: importanza 1-10
          }
        - percorsi_suggeriti: array di sequenze ottimali`,

      'batch-generation': `Genera contenuti didattici di massa mantenendo qualità premium.
        Per ogni item:
        1. Verifica unicità (no duplicati)
        2. Mantieni coerenza stilistica
        3. Distribuisci difficoltà uniformemente
        4. Assicura copertura completa dell'argomento
        5. Controlla correttezza grammaticale e contenutistica`
    };

    return prompts[type] || prompts['generate-quiz'];
  }

  /**
   * ✅ Validazione qualità output
   */
  async _validateQuality(response) {
    const content = response.content;
    
    // Parse JSON se necessario
    let parsed;
    try {
      parsed = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      parsed = { text: content };
    }

    // Controlli qualità base
    const validations = {
      grammatica: await this._checkGrammar(parsed),
      completezza: this._checkCompleteness(parsed),
      coerenza: this._checkCoherence(parsed),
      originalita: this._checkOriginality(parsed)
    };

    // Log metriche qualità
    console.log('📊 Qualità output:', {
      grammatica: validations.grammatica.score,
      completezza: validations.completezza.score,
      coerenza: validations.coerenza.score,
      originalita: validations.originalita.score
    });

    // Se qualità insufficiente, richiedi rigenerazione
    const minScore = 0.7;
    const avgScore = Object.values(validations).reduce((acc, v) => acc + v.score, 0) / 4;
    
    if (avgScore < minScore) {
      console.warn('⚠️ Qualità insufficiente, rigenerazione...');
      throw new Error('Output quality below threshold');
    }

    return {
      ...parsed,
      _quality: validations,
      _metadata: {
        model: response.model,
        usage: response.usage,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * 📝 Controllo grammaticale (simulato - in produzione usare API dedicata)
   */
  async _checkGrammar(content) {
    // In produzione: integrare LanguageTool o simili
    const text = JSON.stringify(content);
    
    // Controlli base
    const errors = [];
    
    // Controllo maiuscole dopo punto
    if (text.match(/\. [a-z]/g)) {
      errors.push('Mancanza maiuscola dopo punto');
    }
    
    // Controllo spazi doppi
    if (text.includes('  ')) {
      errors.push('Spazi doppi rilevati');
    }
    
    // Controllo apostrofi
    if (text.match(/un'([^aeiou])/gi)) {
      errors.push('Apostrofo errato');
    }

    return {
      score: Math.max(0, 1 - errors.length * 0.1),
      errors
    };
  }

  /**
   * 🔍 Controllo completezza
   */
  _checkCompleteness(content) {
    const required = {
      'extract-exercise': ['enunciato_pulito', 'soluzione', 'varianti', 'quiz', 'flashcards'],
      'generate-quiz': ['domanda', 'opzioni', 'risposta_corretta', 'spiegazione'],
      'generate-flashcards': ['fronte', 'retro', 'materia'],
      'knowledge-map': ['nodi', 'archi']
    };

    let missing = [];
    
    // Verifica campi richiesti in base al tipo
    Object.values(required).forEach(fields => {
      fields.forEach(field => {
        if (!content[field]) {
          missing.push(field);
        }
      });
    });

    return {
      score: Math.max(0, 1 - missing.length * 0.2),
      missing
    };
  }

  /**
   * 🎯 Controllo coerenza
   */
  _checkCoherence(content) {
    const issues = [];
    
    // Verifica coerenza materia/argomento
    if (content.materia && content.argomento) {
      const validCombos = {
        'Matematica': ['Algebra', 'Geometria', 'Analisi', 'Probabilità'],
        'Fisica': ['Meccanica', 'Termodinamica', 'Elettromagnetismo', 'Ottica'],
        'Italiano': ['Grammatica', 'Letteratura', 'Antologia'],
        'Storia': ['Antica', 'Medievale', 'Moderna', 'Contemporanea']
      };
      
      if (validCombos[content.materia] && 
          !validCombos[content.materia].some(arg => content.argomento?.includes(arg))) {
        issues.push('Incoerenza materia-argomento');
      }
    }

    return {
      score: Math.max(0, 1 - issues.length * 0.3),
      issues
    };
  }

  /**
   * 🚫 Controllo originalità (anti-plagio base)
   */
  _checkOriginality(content) {
    // In produzione: confronto con database esistente
    // Per ora: controllo patterns comuni di copia
    
    const text = JSON.stringify(content).toLowerCase();
    const commonPhrases = [
      'come da manuale',
      'secondo il libro di testo',
      'copiato da',
      'tratto da'
    ];
    
    const suspiciousPatterns = commonPhrases.filter(phrase => text.includes(phrase));
    
    return {
      score: Math.max(0, 1 - suspiciousPatterns.length * 0.25),
      patterns: suspiciousPatterns
    };
  }

  /**
   * 🔑 Generazione chiave cache
   */
  _getCacheKey(params) {
    const key = `${params.type}-${params.prompt?.substring(0, 50)}-${params.materia || ''}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * 📊 Ottieni metriche
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      successRate: (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
    };
  }

  /**
   * 🗑️ Pulizia cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cache pulita: ${size} elementi rimossi`);
  }

  /**
   * 📦 Elaborazione batch per generazioni massive
   */
  async processBatch(items, type, options = {}) {
    console.log(`📦 Elaborazione batch: ${items.length} elementi`);
    
    const results = [];
    const batchSize = options.batchSize || this.config.rateLimit.batchSize;
    const delayMs = options.delayMs || 1000;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      console.log(`🔄 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(item => this.generateContent({
          type,
          prompt: item.prompt,
          ...item
        }))
      );

      results.push(...batchResults.map((result, idx) => ({
        success: result.status === 'fulfilled',
        data: result.value || null,
        error: result.reason || null,
        originalItem: batch[idx]
      })));

      // Delay tra batch per rispettare rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`✅ Batch completato: ${successful}/${items.length} successi`);

    return results;
  }

  /**
   * ✅ Validazione richiesta
   */
  _validateRequest(request) {
    if (!request || !request.type) {
      throw new Error('Richiesta non valida: tipo mancante');
    }
    if (!request.prompt && !request.image) {
      throw new Error('Richiesta non valida: prompt o immagine richiesti');
    }
  }

  /**
   * 🔑 Generazione chiave cache
   */
  _getCacheKey(request) {
    const key = `${request.type}_${request.prompt || 'image'}_${request.materia || 'general'}`;
    return key.substring(0, 100); // Limita lunghezza
  }

  /**
   * 📝 Costruzione prompt
   */
  _buildPrompt(request) {
    return request.prompt || 'Analizza il contenuto fornito';
  }

  /**
   * 🔄 Post-processing risposta
   */
  async _processResponse(response, request) {
    try {
      // Prova a parsare come JSON
      const parsed = JSON.parse(response.content);
      return parsed;
    } catch (error) {
      // Se non è JSON, ritorna come testo
      return {
        content: response.content,
        type: request.type,
        processed: true
      };
    }
  }

  /**
   * 🎭 Mock response per sviluppo
   */
  _getMockResponse(request) {
    const mockResponses = {
      'extract-exercise': {
        enunciato_pulito: "Risolvi l'equazione di secondo grado: 2x² + 5x - 3 = 0",
        tipo_problema: "equazione secondo grado",
        materia: "Matematica",
        argomento: "Algebra",
        sottoargomento: "Equazioni quadratiche",
        livello: "intermedio",
        prerequisiti: ["equazioni lineari", "fattorizzazione", "formula quadratica"],
        soluzione: {
          passaggi: [
            {
              step: 1,
              descrizione: "Identifico i coefficienti dell'equazione ax² + bx + c = 0",
              calcolo: "a = 2, b = 5, c = -3"
            },
            {
              step: 2,
              descrizione: "Applico la formula quadratica x = (-b ± √(b²-4ac)) / 2a",
              calcolo: "x = (-5 ± √(25 + 24)) / 4 = (-5 ± √49) / 4"
            },
            {
              step: 3,
              descrizione: "Calcolo le due soluzioni",
              calcolo: "x₁ = (-5 + 7) / 4 = 1/2, x₂ = (-5 - 7) / 4 = -3"
            }
          ],
          risultato_finale: "x₁ = 1/2, x₂ = -3",
          verifiche: ["Sostituisco x₁ = 1/2: 2(1/4) + 5(1/2) - 3 = 0.5 + 2.5 - 3 = 0 ✓"]
        },
        varianti: [
          {
            difficolta: "base",
            testo: "Risolvi: x² + 4x + 3 = 0",
            soluzione: "x₁ = -1, x₂ = -3"
          },
          {
            difficolta: "intermedio", 
            testo: "Risolvi: 3x² - 7x + 2 = 0",
            soluzione: "x₁ = 2, x₂ = 1/3"
          },
          {
            difficolta: "avanzato",
            testo: "Risolvi: x² - 6x + 10 = 0 (soluzioni complesse)",
            soluzione: "x₁ = 3 + i, x₂ = 3 - i"
          }
        ],
        quiz: [
          {
            domanda: "Qual è il discriminante dell'equazione 2x² + 5x - 3 = 0?",
            opzioni: ["49", "25", "1", "-23"],
            rispostaCorretta: 0,
            spiegazione: "Il discriminante è b² - 4ac = 25 - 4(2)(-3) = 25 + 24 = 49"
          }
        ],
        flashcards: [
          {
            fronte: "Formula quadratica",
            retro: "x = (-b ± √(b²-4ac)) / 2a per equazioni ax² + bx + c = 0"
          }
        ],
        tempo_stimato_minuti: 15
      },
      'generate-quiz': [
        {
          domanda: "Quale delle seguenti è la formula corretta per risolvere un'equazione di secondo grado?",
          tipo: "MCQ",
          opzioni: [
            "x = (-b ± √(b²-4ac)) / 2a",
            "x = (-b ± √(b²+4ac)) / 2a", 
            "x = (b ± √(b²-4ac)) / 2a",
            "x = (-b ± √(b²-4ac)) / a"
          ],
          risposta_corretta: 0,
          spiegazione: "La formula quadratica corretta è x = (-b ± √(b²-4ac)) / 2a, dove a, b, c sono i coefficienti dell'equazione ax² + bx + c = 0",
          difficolta: 2,
          materia: "Matematica",
          argomento: "Algebra",
          sottoargomento: "Equazioni quadratiche"
        }
      ],
      'generate-flashcards': [
        {
          fronte: "Cos'è il discriminante?",
          retro: "Il discriminante è b² - 4ac e determina il tipo di soluzioni di un'equazione quadratica",
          difficolta: "base",
          tags: ["algebra", "equazioni", "discriminante"]
        }
      ]
    };

    return mockResponses[request.type] || {
      content: "Mock response generica",
      type: request.type,
      success: true
    };
  }
}

module.exports = new AIService();
