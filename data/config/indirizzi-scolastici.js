/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONFIGURAZIONE INDIRIZZI SCOLASTICI E MATERIE
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const INDIRIZZI_SCOLASTICI = {
  scientifico: {
    nome: 'Liceo Scientifico',
    emoji: '🧪',
    descrizione: 'Il liceo più completo e versatile',
    materie: [
      'italiano',
      'latino', 
      'storia',
      'filosofia',
      'matematica',
      'fisica',
      'scienze',
      'inglese',
      'arte',
      'religione'
    ]
  },
  
  classico: {
    nome: 'Liceo Classico',
    emoji: '📚',
    descrizione: 'Cultura umanistica e lingue antiche',
    materie: [
      'italiano',
      'latino',
      'greco',
      'storia',
      'filosofia',
      'matematica',
      'fisica',
      'scienze',
      'inglese',
      'arte',
      'religione'
    ]
  },
  
  linguistico: {
    nome: 'Liceo Linguistico',
    emoji: '🌍',
    descrizione: 'Lingue straniere e culture internazionali',
    materie: [
      'italiano',
      'storia',
      'filosofia',
      'matematica',
      'scienze',
      'inglese',
      'francese',
      'spagnolo',
      'tedesco',
      'arte',
      'religione'
    ]
  },
  
  scienze_umane: {
    nome: 'Liceo Scienze Umane',
    emoji: '🧠',
    descrizione: 'Psicologia, pedagogia e scienze sociali',
    materie: [
      'italiano',
      'storia',
      'filosofia',
      'matematica',
      'scienze',
      'inglese',
      'psicologia',
      'pedagogia',
      'sociologia',
      'antropologia',
      'religione'
    ]
  },
  
  scienze_umane_economico: {
    nome: 'Liceo Scienze Umane (Economico-Sociale)',
    emoji: '💼',
    descrizione: 'Scienze umane con diritto ed economia',
    materie: [
      'italiano',
      'storia',
      'filosofia',
      'matematica',
      'scienze',
      'inglese',
      'psicologia',
      'sociologia',
      'diritto',
      'economia',
      'religione'
    ]
  },
  
  artistico: {
    nome: 'Liceo Artistico',
    emoji: '🎨',
    descrizione: 'Arte, design e creatività',
    materie: [
      'italiano',
      'storia',
      'filosofia',
      'matematica',
      'fisica',
      'inglese',
      'arte',
      'storia_arte',
      'religione'
    ]
  },
  
  itis: {
    nome: 'ITIS (Istituto Tecnico Industriale)',
    emoji: '⚙️',
    descrizione: 'Tecnologia, informatica e industria',
    materie: [
      'italiano',
      'storia',
      'matematica',
      'inglese',
      'fisica',
      'chimica',
      'informatica',
      'sistemi',
      'elettronica',
      'meccanica',
      'religione'
    ]
  },
  
  itet: {
    nome: 'ITET (Istituto Tecnico Economico)',
    emoji: '📊',
    descrizione: 'Economia, commercio e amministrazione',
    materie: [
      'italiano',
      'storia',
      'matematica',
      'inglese',
      'economia',
      'diritto',
      'informatica',
      'francese',
      'religione'
    ]
  }
};

// Lista semplice degli indirizzi per il frontend
const LISTA_INDIRIZZI = Object.entries(INDIRIZZI_SCOLASTICI).map(([key, value]) => ({
  id: key,
  nome: value.nome,
  emoji: value.emoji,
  descrizione: value.descrizione
}));

// Funzione per ottenere le materie di un indirizzo
function getMaterieIndirizzo(indirizzo) {
  const config = INDIRIZZI_SCOLASTICI[indirizzo];
  if (!config) {
    // Default: liceo scientifico
    return INDIRIZZI_SCOLASTICI.scientifico.materie;
  }
  return config.materie;
}

// Funzione per verificare se una materia appartiene a un indirizzo
function materiaAppartieneIndirizzo(materia, indirizzo) {
  const materie = getMaterieIndirizzo(indirizzo);
  return materie.includes(materia.toLowerCase());
}

// Tutte le materie disponibili (unione di tutte)
const TUTTE_LE_MATERIE = [...new Set(
  Object.values(INDIRIZZI_SCOLASTICI).flatMap(i => i.materie)
)].sort();

module.exports = {
  INDIRIZZI_SCOLASTICI,
  LISTA_INDIRIZZI,
  getMaterieIndirizzo,
  materiaAppartieneIndirizzo,
  TUTTE_LE_MATERIE
};
