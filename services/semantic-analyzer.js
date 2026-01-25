// ANALIZZATORE SEMANTICO
// Estrazione intelligente di concetti, relazioni e strutture dal testo

class SemanticAnalyzer {
  constructor() {
    this.stopwords = new Set([
      'il', 'la', 'lo', 'i', 'gli', 'le', 'un', 'una', 'uno',
      'di', 'da', 'a', 'su', 'con', 'per', 'tra', 'fra',
      'e', 'o', 'ma', 'che', 'è', 'sono', 'era', 'erano',
      'questo', 'quello', 'questi', 'quelli', 'quando', 'dove',
      'come', 'perché', 'quindi', 'infatti', 'inoltre', 'anche'
    ]);
    
    this.conceptIndicators = [
      'definisce', 'significa', 'rappresenta', 'indica', 'descrive',
      'consiste', 'comprende', 'include', 'contiene', 'costituisce'
    ];
    
    this.relationIndicators = {
      CAUSES: ['causa', 'provoca', 'determina', 'genera', 'produce'],
      IMPLIES: ['implica', 'comporta', 'richiede', 'necessita'],
      EXAMPLE: ['esempio', 'ad esempio', 'per esempio', 'come'],
      PREREQUISITE: ['richiede', 'presuppone', 'necessita', 'prima di'],
      APPLIES: ['applica', 'utilizza', 'serve', 'usato per']
    };
  }

  analyze(text, options = {}) {
    const {
      subject = null,
      level = 'intermedio',
      extractFormulas = true,
      extractExamples = true,
      maxConcepts = 20
    } = options;
    
    const analysis = {
      entities: [],
      relations: [],
      definitions: [],
      theorems: [],
      formulas: [],
      examples: [],
      problems: [],
      hierarchy: null,
      metadata: {
        textLength: text.length,
        sentenceCount: 0,
        conceptDensity: 0,
        complexity: this.calculateComplexity(text)
      }
    };
    
    // Preprocessing
    const cleanedText = this.preprocessText(text);
    const sentences = this.segmentSentences(cleanedText);
    analysis.metadata.sentenceCount = sentences.length;
    
    // Analisi per frase
    sentences.forEach((sentence, index) => {
      const sentenceAnalysis = this.analyzeSentence(sentence, index);
      
      // Estrai entità
      analysis.entities.push(...sentenceAnalysis.entities);
      
      // Estrai relazioni
      analysis.relations.push(...sentenceAnalysis.relations);
      
      // Categorizza contenuto
      if (sentenceAnalysis.isDefinition) {
        analysis.definitions.push(sentenceAnalysis.definition);
      }
      if (sentenceAnalysis.isTheorem) {
        analysis.theorems.push(sentenceAnalysis.theorem);
      }
      if (extractFormulas && sentenceAnalysis.hasFormula) {
        analysis.formulas.push(sentenceAnalysis.formula);
      }
      if (extractExamples && sentenceAnalysis.isExample) {
        analysis.examples.push(sentenceAnalysis.example);
      }
      if (sentenceAnalysis.isProblem) {
        analysis.problems.push(sentenceAnalysis.problem);
      }
    });
    
    // Post-processing
    analysis.entities = this.consolidateEntities(analysis.entities);
    analysis.entities = this.rankEntities(analysis.entities, maxConcepts);
    analysis.relations = this.validateRelations(analysis.relations, analysis.entities);
    analysis.hierarchy = this.buildConceptHierarchy(analysis.entities, analysis.relations);
    analysis.metadata.conceptDensity = analysis.entities.length / sentences.length;
    
    return analysis;
  }
  
  preprocessText(text) {
    // Normalizza spazi e caratteri
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Preserva formule matematiche
    cleaned = this.protectFormulas(cleaned);
    
    // Marca liste e punti
    cleaned = this.markLists(cleaned);
    
    return cleaned;
  }
  
  segmentSentences(text) {
    // Segmentazione intelligente che preserva contesto
    const sentences = [];
    const rawSentences = text.split(/(?<=[.!?])\s+/);
    
    rawSentences.forEach(sentence => {
      if (sentence.length > 20) { // Filtra frasi troppo corte
        sentences.push({
          text: sentence,
          position: sentences.length,
          type: this.classifySentenceType(sentence)
        });
      }
    });
    
    return sentences;
  }
  
  analyzeSentence(sentence, index) {
    const result = {
      entities: [],
      relations: [],
      isDefinition: false,
      isTheorem: false,
      isExample: false,
      isProblem: false,
      hasFormula: false
    };
    
    // Estrai entità (NER semplificato)
    result.entities = this.extractEntities(sentence.text);
    
    // Estrai relazioni
    result.relations = this.extractRelations(sentence.text, result.entities);
    
    // Classifica tipo di frase
    if (this.isDefinition(sentence.text)) {
      result.isDefinition = true;
      result.definition = this.extractDefinition(sentence.text);
    }
    
    if (this.isTheorem(sentence.text)) {
      result.isTheorem = true;
      result.theorem = this.extractTheorem(sentence.text);
    }
    
    if (this.isExample(sentence.text)) {
      result.isExample = true;
      result.example = this.extractExample(sentence.text);
    }
    
    if (this.hasFormula(sentence.text)) {
      result.hasFormula = true;
      result.formula = this.extractFormula(sentence.text);
    }
    
    if (this.isProblem(sentence.text)) {
      result.isProblem = true;
      result.problem = this.extractProblem(sentence.text);
    }
    
    return result;
  }
  
  extractEntities(text) {
    const entities = [];
    const words = text.split(/\s+/);
    const taggedWords = this.tagWords(words);
    
    // Estrai n-grammi significativi
    const ngrams = this.extractNGrams(words, 3);
    
    ngrams.forEach(ngram => {
      if (this.isSignificantNGram(ngram)) {
        const entity = {
          text: ngram.join(' '),
          type: this.classifyEntityType(ngram.join(' ')),
          frequency: 1,
          importance: this.calculateImportance(ngram.join(' '), text),
          position: text.indexOf(ngram.join(' ')),
          context: this.extractContext(text, ngram.join(' '))
        };
        entities.push(entity);
      }
    });
    
    // Estrai singole parole importanti
    taggedWords.forEach(word => {
      if (word.tag === 'NOUN' && !this.stopwords.has(word.text.toLowerCase())) {
        const entity = {
          text: word.text,
          type: 'concetto',
          frequency: 1,
          importance: this.calculateImportance(word.text, text),
          position: text.indexOf(word.text),
          context: this.extractContext(text, word.text)
        };
        entities.push(entity);
      }
    });
    
    return entities;
  }
  
  extractRelations(text, entities) {
    const relations = [];
    
    // Pattern matching per relazioni
    for (const [relationType, indicators] of Object.entries(this.relationIndicators)) {
      indicators.forEach(indicator => {
        const pattern = new RegExp(`([\\w\\s]+)\\s+${indicator}\\s+([\\w\\s]+)`, 'gi');
        let match;
        
        while ((match = pattern.exec(text)) !== null) {
          const from = this.findEntity(match[1], entities);
          const to = this.findEntity(match[2], entities);
          
          if (from && to) {
            relations.push({
              from: from.text,
              to: to.text,
              type: relationType,
              indicator,
              confidence: 0.8,
              context: match[0]
            });
          }
        }
      });
    }
    
    // Relazioni implicite basate su prossimità
    entities.forEach((e1, i) => {
      entities.slice(i + 1).forEach(e2 => {
        const distance = Math.abs(e1.position - e2.position);
        if (distance < 50) { // Entità vicine
          relations.push({
            from: e1.text,
            to: e2.text,
            type: 'RELATED',
            indicator: 'proximity',
            confidence: 0.5,
            context: text.substring(
              Math.min(e1.position, e2.position),
              Math.max(e1.position + e1.text.length, e2.position + e2.text.length)
            )
          });
        }
      });
    });
    
    return relations;
  }
  
  isDefinition(text) {
    return this.conceptIndicators.some(indicator => 
      text.toLowerCase().includes(indicator)
    );
  }
  
  extractDefinition(text) {
    const patterns = [
      /([A-Z][\w\s]+)\s+(?:è|sono|significa|definisce)\s+(.+)/i,
      /(?:Si definisce|Chiamiamo)\s+([^\s]+)\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          term: match[1].trim(),
          definition: match[2].trim(),
          fullText: text,
          type: 'explicit'
        };
      }
    }
    
    return {
      term: 'Concetto',
      definition: text,
      fullText: text,
      type: 'implicit'
    };
  }
  
  isTheorem(text) {
    return /(?:teorema|lemma|corollario|proposizione|principio|legge)/i.test(text);
  }
  
  extractTheorem(text) {
    const match = text.match(/(?:teorema|lemma|principio|legge)\s+(?:di\s+)?([^:]+):?\s*(.+)/i);
    
    return {
      name: match ? match[1].trim() : 'Teorema',
      statement: match ? match[2].trim() : text,
      type: this.detectTheoremType(text),
      proof: null
    };
  }
  
  isExample(text) {
    return /(?:esempio|ad esempio|per esempio|consideriamo|supponiamo)/i.test(text);
  }
  
  extractExample(text) {
    const match = text.match(/(?:esempio|ad esempio|per esempio)[:\s]+(.+)/i);
    
    return {
      title: 'Esempio',
      text: match ? match[1].trim() : text,
      type: 'illustrative',
      relatedConcept: null
    };
  }
  
  hasFormula(text) {
    return /[=\+\-\*\/\^∫∑∏√≈≠≤≥<>]/.test(text) || /\d+/.test(text);
  }
  
  extractFormula(text) {
    const formulaPattern = /([a-zA-Z_]\w*)\s*=\s*(.+)/;
    const match = text.match(formulaPattern);
    
    if (match) {
      return {
        name: match[1],
        expression: match[2],
        variables: this.extractVariables(match[2]),
        type: 'equation',
        latex: this.convertToLatex(match[0])
      };
    }
    
    return {
      name: 'Formula',
      expression: text,
      variables: this.extractVariables(text),
      type: 'expression',
      latex: this.convertToLatex(text)
    };
  }
  
  isProblem(text) {
    return /(?:problema|esercizio|calcola|trova|determina|dimostra|risolvi)/i.test(text);
  }
  
  extractProblem(text) {
    return {
      statement: text,
      type: this.detectProblemType(text),
      data: this.extractProblemData(text),
      solution: null,
      hints: []
    };
  }
  
  consolidateEntities(entities) {
    const consolidated = new Map();
    
    entities.forEach(entity => {
      const key = entity.text.toLowerCase();
      if (consolidated.has(key)) {
        const existing = consolidated.get(key);
        existing.frequency += 1;
        existing.importance = Math.max(existing.importance, entity.importance);
        existing.contexts = existing.contexts || [];
        existing.contexts.push(entity.context);
      } else {
        consolidated.set(key, {
          ...entity,
          contexts: [entity.context]
        });
      }
    });
    
    return Array.from(consolidated.values());
  }
  
  rankEntities(entities, maxCount) {
    // Calcola score composto
    const scored = entities.map(entity => ({
      ...entity,
      score: entity.importance * Math.log(entity.frequency + 1) * 
             (entity.type === 'concetto' ? 1.5 : 1)
    }));
    
    // Ordina e prendi i top N
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, maxCount);
  }
  
  validateRelations(relations, entities) {
    const entityTexts = new Set(entities.map(e => e.text.toLowerCase()));
    
    return relations.filter(relation => {
      const fromValid = entityTexts.has(relation.from.toLowerCase());
      const toValid = entityTexts.has(relation.to.toLowerCase());
      return fromValid && toValid && relation.from !== relation.to;
    });
  }
  
  buildConceptHierarchy(entities, relations) {
    const hierarchy = {
      root: null,
      levels: [],
      connections: []
    };
    
    // Identifica concetto centrale (più connesso)
    const connectionCount = new Map();
    relations.forEach(rel => {
      connectionCount.set(rel.from, (connectionCount.get(rel.from) || 0) + 1);
      connectionCount.set(rel.to, (connectionCount.get(rel.to) || 0) + 1);
    });
    
    let maxConnections = 0;
    let centralConcept = null;
    
    entities.forEach(entity => {
      const connections = connectionCount.get(entity.text) || 0;
      if (connections > maxConnections) {
        maxConnections = connections;
        centralConcept = entity;
      }
    });
    
    hierarchy.root = centralConcept;
    
    // Costruisci livelli basati sulla distanza dal centro
    const visited = new Set();
    let currentLevel = [centralConcept];
    let level = 0;
    
    while (currentLevel.length > 0 && level < 5) {
      hierarchy.levels.push([...currentLevel]);
      currentLevel.forEach(c => visited.add(c.text));
      
      const nextLevel = [];
      currentLevel.forEach(concept => {
        relations.forEach(rel => {
          if (rel.from === concept.text && !visited.has(rel.to)) {
            const entity = entities.find(e => e.text === rel.to);
            if (entity) nextLevel.push(entity);
          }
          if (rel.to === concept.text && !visited.has(rel.from)) {
            const entity = entities.find(e => e.text === rel.from);
            if (entity) nextLevel.push(entity);
          }
        });
      });
      
      currentLevel = [...new Set(nextLevel)];
      level++;
    }
    
    hierarchy.connections = relations;
    
    return hierarchy;
  }
  
  // Helper functions
  calculateComplexity(text) {
    const sentenceCount = text.split(/[.!?]/).length;
    const avgWordLength = text.split(/\s+/).reduce((acc, word) => 
      acc + word.length, 0) / text.split(/\s+/).length;
    const technicalTerms = this.countTechnicalTerms(text);
    
    return {
      level: avgWordLength > 7 && technicalTerms > 5 ? 'avanzato' : 
             avgWordLength > 5 ? 'intermedio' : 'base',
      score: (avgWordLength * 0.3 + technicalTerms * 0.7) / 10
    };
  }
  
  protectFormulas(text) {
    // Marca le formule per preservarle durante il processing
    return text.replace(/([a-zA-Z_]\w*\s*=\s*[^.!?]+)/g, '<FORMULA>$1</FORMULA>');
  }
  
  markLists(text) {
    return text.replace(/^\s*[-•*]\s+(.+)$/gm, '<LIST_ITEM>$1</LIST_ITEM>');
  }
  
  classifySentenceType(sentence) {
    if (this.isDefinition(sentence)) return 'definition';
    if (this.isTheorem(sentence)) return 'theorem';
    if (this.isExample(sentence)) return 'example';
    if (this.isProblem(sentence)) return 'problem';
    if (this.hasFormula(sentence)) return 'formula';
    return 'general';
  }
  
  tagWords(words) {
    // POS tagging semplificato
    return words.map(word => {
      const lower = word.toLowerCase();
      if (this.stopwords.has(lower)) return { text: word, tag: 'STOP' };
      if (/^[A-Z]/.test(word)) return { text: word, tag: 'NOUN' };
      if (/\d/.test(word)) return { text: word, tag: 'NUM' };
      if (/ing$|zione$|mento$|anza$|enza$/.test(lower)) return { text: word, tag: 'NOUN' };
      return { text: word, tag: 'OTHER' };
    });
  }
  
  extractNGrams(words, n) {
    const ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n));
    }
    return ngrams;
  }
  
  isSignificantNGram(ngram) {
    const text = ngram.join(' ').toLowerCase();
    return !ngram.every(word => this.stopwords.has(word.toLowerCase())) &&
           ngram.some(word => /^[A-Z]/.test(word) || word.length > 5);
  }
  
  classifyEntityType(text) {
    if (/teorema|lemma|principio|legge/i.test(text)) return 'teorema';
    if (/formula|equazione/i.test(text)) return 'formula';
    if (/esempio/i.test(text)) return 'esempio';
    if (/definizione/i.test(text)) return 'definizione';
    return 'concetto';
  }
  
  calculateImportance(term, text) {
    const frequency = (text.match(new RegExp(term, 'gi')) || []).length;
    const position = text.indexOf(term) / text.length;
    const isCapitalized = /^[A-Z]/.test(term);
    const length = term.length;
    
    return (
      frequency * 0.3 +
      (1 - position) * 0.2 +
      (isCapitalized ? 0.2 : 0) +
      Math.min(length / 20, 1) * 0.3
    );
  }
  
  extractContext(text, term) {
    const index = text.indexOf(term);
    const contextRadius = 50;
    const start = Math.max(0, index - contextRadius);
    const end = Math.min(text.length, index + term.length + contextRadius);
    return text.substring(start, end);
  }
  
  findEntity(text, entities) {
    const cleaned = text.trim().toLowerCase();
    return entities.find(e => e.text.toLowerCase() === cleaned);
  }
  
  detectTheoremType(text) {
    if (/teorema/i.test(text)) return 'theorem';
    if (/lemma/i.test(text)) return 'lemma';
    if (/corollario/i.test(text)) return 'corollary';
    if (/principio|legge/i.test(text)) return 'principle';
    return 'statement';
  }
  
  extractVariables(expression) {
    const variables = new Set();
    const matches = expression.match(/[a-zA-Z_]\w*/g);
    if (matches) {
      matches.forEach(v => {
        if (!['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt'].includes(v)) {
          variables.add(v);
        }
      });
    }
    return Array.from(variables);
  }
  
  convertToLatex(expression) {
    // Conversione base a LaTeX
    let latex = expression
      .replace(/\*/g, ' \\cdot ')
      .replace(/\^(\w+)/g, '^{$1}')
      .replace(/_(\w+)/g, '_{$1}')
      .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
      .replace(/\//g, '\\frac{}{}');
    
    return latex;
  }
  
  detectProblemType(text) {
    if (/calcola|determina|trova/i.test(text)) return 'calculation';
    if (/dimostra|prova/i.test(text)) return 'proof';
    if (/risolvi/i.test(text)) return 'solve';
    return 'general';
  }
  
  extractProblemData(text) {
    const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
    const units = text.match(/\b(m|km|kg|s|h|€|\$|°C|°F)\b/g) || [];
    
    return {
      numbers: numbers.map(n => parseFloat(n)),
      units,
      hasNumbers: numbers.length > 0
    };
  }
  
  countTechnicalTerms(text) {
    const technicalPatterns = [
      /teorem|lemm|corollar|proposizion|principi|legg/i,
      /formul|equazion|funzion|derivat|integral/i,
      /algoritm|complessit|struttur|sistem/i
    ];
    
    let count = 0;
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });
    
    return count;
  }
}

module.exports = SemanticAnalyzer;
