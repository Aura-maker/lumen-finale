/**
 * 📤 MY CONTENTS EXPORT SERVICE
 * Gestione export in vari formati
 */

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class MyContentsExport {
  constructor() {
    this.supportedFormats = ['json', 'pdf', 'csv', 'anki', 'opml', 'markdown', 'html'];
  }

  /**
   * 📤 Export Principale
   */
  async exportContents(contents, format, options = {}) {
    console.log(`📤 Export in formato ${format}`);
    
    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Formato non supportato: ${format}`);
    }
    
    switch (format.toLowerCase()) {
      case 'json':
        return this.exportJSON(contents, options);
      case 'pdf':
        return await this.exportPDF(contents, options);
      case 'csv':
        return this.exportCSV(contents, options);
      case 'anki':
        return this.exportAnki(contents, options);
      case 'opml':
        return this.exportOPML(contents, options);
      case 'markdown':
        return this.exportMarkdown(contents, options);
      case 'html':
        return this.exportHTML(contents, options);
      default:
        throw new Error(`Formato non implementato: ${format}`);
    }
  }

  /**
   * 📁 Export JSON
   */
  exportJSON(contents, options = {}) {
    const data = {
      metadata: {
        exported: new Date().toISOString(),
        version: '2.0',
        totalItems: (contents.quiz?.length || 0) + 
                   (contents.flashcards?.length || 0) + 
                   (contents.mappe?.length || 0)
      },
      contents
    };
    
    if (options.pretty) {
      return JSON.stringify(data, null, 2);
    }
    
    return JSON.stringify(data);
  }

  /**
   * 📄 Export PDF
   */
  async exportPDF(contents, options = {}) {
    // In produzione: implementazione completa con PDFKit
    return {
      message: 'PDF export disponibile nella versione completa',
      totalItems: (contents.quiz?.length || 0) + 
                  (contents.flashcards?.length || 0) + 
                  (contents.mappe?.length || 0)
    };
  }

  /**
   * 📊 Export CSV
   */
  exportCSV(contents, options = {}) {
    const csv = [];
    const separator = options.separator || ',';
    
    // Header
    csv.push(['Tipo', 'Titolo/Domanda', 'Materia', 'Argomento', 'Difficoltà', 'Tags', 'Data Creazione'].join(separator));
    
    // Quiz
    if (contents.quiz) {
      contents.quiz.forEach(q => {
        const titolo = this._escapeCSV(q.domanda || q.affermazione || 'Quiz');
        const materia = this._escapeCSV(q.metadata?.materia || '');
        const argomento = this._escapeCSV(q.metadata?.argomento || '');
        const difficolta = q.metadata?.difficolta || '';
        const tags = this._escapeCSV((q.tags || []).join(';'));
        const data = new Date(q.createdAt || Date.now()).toLocaleDateString('it-IT');
        
        csv.push(['Quiz', titolo, materia, argomento, difficolta, tags, data].join(separator));
      });
    }
    
    // Flashcards
    if (contents.flashcards) {
      contents.flashcards.forEach(f => {
        const fronte = this._escapeCSV(f.fronte);
        const materia = this._escapeCSV(f.metadata?.materia || '');
        const argomento = this._escapeCSV(f.metadata?.argomento || '');
        const difficolta = f.metadata?.difficolta || f.difficolta || '';
        const tags = this._escapeCSV((f.tags || []).join(';'));
        const data = new Date(f.createdAt || Date.now()).toLocaleDateString('it-IT');
        
        csv.push(['Flashcard', fronte, materia, argomento, difficolta, tags, data].join(separator));
      });
    }
    
    // Mappe
    if (contents.mappe) {
      contents.mappe.forEach(m => {
        const nome = this._escapeCSV(m.nome);
        const materia = this._escapeCSV(m.metadata?.materia || '');
        const argomento = this._escapeCSV(m.metadata?.argomento || '');
        const tags = this._escapeCSV((m.tags || []).join(';'));
        const data = new Date(m.createdAt || Date.now()).toLocaleDateString('it-IT');
        
        csv.push(['Mappa', nome, materia, argomento, '-', tags, data].join(separator));
      });
    }
    
    return csv.join('\n');
  }

  /**
   * 🎴 Export Anki
   */
  exportAnki(contents, options = {}) {
    const ankiCards = [];
    
    // Converti flashcards
    if (contents.flashcards) {
      contents.flashcards.forEach(f => {
        const card = {
          deckName: `ImparaFacile::${f.metadata?.materia || 'Generale'}::${f.metadata?.argomento || 'Varie'}`,
          modelName: 'Basic (and reversed card)',
          fields: {
            Front: f.fronte,
            Back: this._formatAnkiBack(f.retro)
          },
          tags: f.tags || [],
          options: {
            allowDuplicate: false,
            duplicateScope: 'deck'
          }
        };
        
        // Aggiungi scheduling info se presente
        if (f.sm2) {
          card.scheduling = {
            ease: f.sm2.ease,
            interval: f.sm2.interval,
            due: f.sm2.nextReview
          };
        }
        
        ankiCards.push(card);
      });
    }
    
    // Converti quiz in flashcards
    if (contents.quiz && options.includeQuiz) {
      contents.quiz.forEach(q => {
        let front, back;
        
        if (q.tipo === 'MCQ' || q.opzioni) {
          front = q.domanda;
          back = `Risposta corretta: ${q.opzioni ? q.opzioni[q.rispostaCorretta] : 'N/A'}\n\n`;
          if (q.spiegazione) back += `Spiegazione: ${q.spiegazione}`;
        } else if (q.tipo === 'VF' || q.affermazione) {
          front = q.affermazione;
          back = `${q.rispostaCorretta ? 'VERO' : 'FALSO'}\n\n`;
          if (q.spiegazione) back += `Spiegazione: ${q.spiegazione}`;
        }
        
        if (front && back) {
          ankiCards.push({
            deckName: `ImparaFacile::Quiz::${q.metadata?.materia || 'Generale'}`,
            modelName: 'Basic',
            fields: {
              Front: front,
              Back: back
            },
            tags: [...(q.tags || []), 'quiz']
          });
        }
      });
    }
    
    // Format per Anki Connect o export file
    if (options.format === 'connect') {
      return ankiCards;
    } else {
      // Formato testo per importazione manuale
      return this._formatAnkiText(ankiCards);
    }
  }

  /**
   * 🗺️ Export OPML
   */
  exportOPML(contents, options = {}) {
    const opml = [];
    
    opml.push('<?xml version="1.0" encoding="UTF-8"?>');
    opml.push('<opml version="2.0">');
    opml.push('<head>');
    opml.push('  <title>ImparaFacile - Esportazione Contenuti</title>');
    opml.push(`  <dateCreated>${new Date().toISOString()}</dateCreated>`);
    opml.push('</head>');
    opml.push('<body>');
    
    // Struttura per materia
    const byMateria = this._groupByMateria(contents);
    
    for (const [materia, items] of Object.entries(byMateria)) {
      opml.push(`  <outline text="${this._escapeXML(materia)}">`);
      
      // Quiz
      if (items.quiz && items.quiz.length > 0) {
        opml.push(`    <outline text="Quiz (${items.quiz.length})">`);
        items.quiz.forEach(q => {
          const text = this._escapeXML(q.domanda || q.affermazione || 'Quiz');
          opml.push(`      <outline text="${text}" />`);
        });
        opml.push('    </outline>');
      }
      
      // Flashcards
      if (items.flashcards && items.flashcards.length > 0) {
        opml.push(`    <outline text="Flashcards (${items.flashcards.length})">`);
        items.flashcards.forEach(f => {
          const text = this._escapeXML(f.fronte);
          opml.push(`      <outline text="${text}" />`);
        });
        opml.push('    </outline>');
      }
      
      // Mappe
      if (items.mappe && items.mappe.length > 0) {
        opml.push(`    <outline text="Mappe (${items.mappe.length})">`);
        items.mappe.forEach(m => {
          opml.push(`      <outline text="${this._escapeXML(m.nome)}">`);
          if (m.nodi) {
            m.nodi.slice(0, 10).forEach(nodo => {
              opml.push(`        <outline text="${this._escapeXML(nodo.titolo || nodo.nome)}" />`);
            });
          }
          opml.push('      </outline>');
        });
        opml.push('    </outline>');
      }
      
      opml.push('  </outline>');
    }
    
    opml.push('</body>');
    opml.push('</opml>');
    
    return opml.join('\n');
  }

  /**
   * 📝 Export Markdown
   */
  exportMarkdown(contents, options = {}) {
    const md = [];
    
    // Header
    md.push('# ImparaFacile - I Miei Contenuti');
    md.push('');
    md.push(`*Esportato il ${new Date().toLocaleDateString('it-IT')}*`);
    md.push('');
    
    // Indice
    md.push('## Indice');
    md.push('');
    if (contents.quiz?.length > 0) md.push(`- [Quiz](#quiz) (${contents.quiz.length})`);
    if (contents.flashcards?.length > 0) md.push(`- [Flashcards](#flashcards) (${contents.flashcards.length})`);
    if (contents.mappe?.length > 0) md.push(`- [Mappe Concettuali](#mappe-concettuali) (${contents.mappe.length})`);
    md.push('');
    
    // Quiz
    if (contents.quiz && contents.quiz.length > 0) {
      md.push('## Quiz');
      md.push('');
      
      contents.quiz.slice(0, options.maxItems || 50).forEach((q, index) => {
        md.push(`### ${index + 1}. ${q.domanda || q.affermazione || 'Quiz'}`);
        md.push('');
        
        if (q.opzioni) {
          q.opzioni.forEach((opt, i) => {
            const marker = i === q.rispostaCorretta ? '✅' : '❌';
            md.push(`- ${marker} ${opt}`);
          });
          md.push('');
        }
        
        if (q.spiegazione) {
          md.push('**Spiegazione:**');
          md.push(q.spiegazione);
          md.push('');
        }
        
        md.push(`*Difficoltà: ${q.metadata?.difficolta || 'N/A'} | Materia: ${q.metadata?.materia || 'N/A'}*`);
        md.push('');
        md.push('---');
        md.push('');
      });
    }
    
    // Flashcards
    if (contents.flashcards && contents.flashcards.length > 0) {
      md.push('## Flashcards');
      md.push('');
      
      contents.flashcards.slice(0, options.maxItems || 50).forEach((f, index) => {
        md.push(`### Flashcard ${index + 1}`);
        md.push('');
        md.push('**Fronte:**');
        md.push(f.fronte);
        md.push('');
        md.push('**Retro:**');
        
        if (typeof f.retro === 'string') {
          md.push(f.retro);
        } else {
          md.push(f.retro.testo || '');
          if (f.retro.formula) {
            md.push('');
            md.push(`*Formula:* \`${f.retro.formula}\``);
          }
          if (f.retro.esempio) {
            md.push('');
            md.push(`*Esempio:* ${f.retro.esempio}`);
          }
        }
        
        md.push('');
        md.push(`*Tags: ${(f.tags || []).join(', ')}*`);
        md.push('');
        md.push('---');
        md.push('');
      });
    }
    
    // Mappe
    if (contents.mappe && contents.mappe.length > 0) {
      md.push('## Mappe Concettuali');
      md.push('');
      
      contents.mappe.forEach((m, index) => {
        md.push(`### ${index + 1}. ${m.nome}`);
        md.push('');
        
        if (m.descrizione) {
          md.push(m.descrizione);
          md.push('');
        }
        
        if (m.nodi && m.nodi.length > 0) {
          md.push('**Struttura:**');
          md.push('');
          m.nodi.slice(0, 10).forEach(nodo => {
            md.push(`- ${nodo.titolo || nodo.nome}`);
          });
          md.push('');
        }
        
        md.push('---');
        md.push('');
      });
    }
    
    return md.join('\n');
  }

  /**
   * 🌐 Export HTML
   */
  exportHTML(contents, options = {}) {
    const html = [];
    
    html.push('<!DOCTYPE html>');
    html.push('<html lang="it">');
    html.push('<head>');
    html.push('<meta charset="UTF-8">');
    html.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    html.push('<title>ImparaFacile - I Miei Contenuti</title>');
    html.push('<style>');
    html.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }');
    html.push('.container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }');
    html.push('h1 { color: #2c3e50; text-align: center; }');
    html.push('h2 { color: #3498db; }');
    html.push('.stats { display: flex; gap: 20px; margin: 20px 0; }');
    html.push('.stat-card { flex: 1; background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }');
    html.push('.quiz-item { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }');
    html.push('.flashcard { margin: 10px 0; padding: 15px; background: #fff3cd; border-radius: 8px; }');
    html.push('.correct { color: #28a745; font-weight: bold; }');
    html.push('</style>');
    html.push('</head>');
    html.push('<body>');
    html.push('<div class="container">');
    
    // Header
    html.push('<h1>ImparaFacile - I Miei Contenuti</h1>');
    html.push(`<p style="text-align: center; color: #6c757d;">Esportato il ${new Date().toLocaleDateString('it-IT')}</p>`);
    
    // Stats
    html.push('<div class="stats">');
    html.push(`<div class="stat-card"><strong>Quiz</strong><br>${contents.quiz?.length || 0}</div>`);
    html.push(`<div class="stat-card"><strong>Flashcards</strong><br>${contents.flashcards?.length || 0}</div>`);
    html.push(`<div class="stat-card"><strong>Mappe</strong><br>${contents.mappe?.length || 0}</div>`);
    html.push('</div>');
    
    // Quiz section
    if (contents.quiz?.length > 0) {
      html.push('<h2>Quiz</h2>');
      contents.quiz.slice(0, 20).forEach((q, i) => {
        html.push(`<div class="quiz-item">`);
        html.push(`<h3>${i + 1}. ${this._escapeHTML(q.domanda || q.affermazione || '')}</h3>`);
        if (q.opzioni) {
          html.push('<ul>');
          q.opzioni.forEach((opt, idx) => {
            const isCorrect = idx === q.rispostaCorretta;
            html.push(`<li class="${isCorrect ? 'correct' : ''}">${this._escapeHTML(opt)}</li>`);
          });
          html.push('</ul>');
        }
        html.push('</div>');
      });
    }
    
    // Flashcards section
    if (contents.flashcards?.length > 0) {
      html.push('<h2>Flashcards</h2>');
      contents.flashcards.slice(0, 20).forEach(f => {
        html.push('<div class="flashcard">');
        html.push(`<strong>Fronte:</strong> ${this._escapeHTML(f.fronte)}<br>`);
        html.push(`<strong>Retro:</strong> ${this._formatHTMLBack(f.retro)}`);
        html.push('</div>');
      });
    }
    
    html.push('</div>');
    html.push('</body>');
    html.push('</html>');
    
    return html.join('\n');
  }

  // Helper methods
  _escapeCSV(text) {
    if (!text) return '';
    text = text.toString();
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  _escapeXML(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _escapeHTML(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _formatAnkiBack(retro) {
    if (typeof retro === 'string') return retro;
    
    let back = retro.testo || '';
    if (retro.formula) back += `\n\nFormula: ${retro.formula}`;
    if (retro.esempio) back += `\n\nEsempio: ${retro.esempio}`;
    if (retro.mnemotecnica) back += `\n\nMnemotecnica: ${retro.mnemotecnica}`;
    
    return back;
  }

  _formatAnkiText(cards) {
    return cards.map(card => {
      const front = card.fields.Front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const back = card.fields.Back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const tags = card.tags.join(' ');
      return `${front}\t${back}\t${tags}`;
    }).join('\n');
  }

  _formatHTMLBack(retro) {
    if (typeof retro === 'string') {
      return this._escapeHTML(retro);
    }
    
    let html = this._escapeHTML(retro.testo || '');
    if (retro.formula) {
      html += `<br><em>Formula:</em> <code>${this._escapeHTML(retro.formula)}</code>`;
    }
    if (retro.esempio) {
      html += `<br><em>Esempio:</em> ${this._escapeHTML(retro.esempio)}`;
    }
    
    return html;
  }

  _groupByMateria(contents) {
    const grouped = {};
    
    ['quiz', 'flashcards', 'mappe'].forEach(type => {
      if (contents[type]) {
        contents[type].forEach(item => {
          const materia = item.metadata?.materia || 'Generale';
          if (!grouped[materia]) {
            grouped[materia] = { quiz: [], flashcards: [], mappe: [] };
          }
          grouped[materia][type].push(item);
        });
      }
    });
    
    return grouped;
  }
}

module.exports = MyContentsExport;
