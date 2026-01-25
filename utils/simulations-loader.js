const fs = require('fs');
const path = require('path');

const SIMULATIONS_DIR = path.join(__dirname, '..', 'files', 'src', 'data', 'simulazioni-esame');
const TRACCE_FILE = path.join(SIMULATIONS_DIR, 'tracce-varianti.json');

async function loadAllSimulations(prisma) {
  try {
    let totalLoaded = 0;
    
    // Carica tracce tipologia B e C (italiano)
    if (fs.existsSync(TRACCE_FILE)) {
      const tracce = JSON.parse(fs.readFileSync(TRACCE_FILE, 'utf8'));
      console.log('📄 Caricamento tracce esame tipologia B e C...');
      
      const allTracce = [
        ...(tracce.tipologia_B || []),
        ...(tracce.tipologia_B2 || []),
        ...(tracce.tipologia_B3 || []),
        ...(tracce.tipologia_C || []),
        ...(tracce.tipologia_C2 || [])
      ];
      
      for (const traccia of allTracce) {
        try {
          const isB = traccia.ambito || traccia.comprensione_analisi;
          await prisma.simulation.create({
            data: {
              title: isB ? `Tipologia B - ${traccia.ambito || 'Argomentativo'}` : `Tipologia C - ${traccia.argomento || 'Espositivo'}`,
              description: isB ? 
                `${traccia.testoCitato?.autore || 'Autore'} - ${traccia.testoCitato?.trattoDa || 'Opera'}` :
                `${traccia.autore_citazione || 'Riflessione'}: ${(traccia.citazione || '').substring(0, 100)}`,
              subject: 'italiano',
              difficulty: 'hard',
              questions: JSON.stringify(traccia)
            }
          });
          totalLoaded++;
        } catch (err) {
          // Skip duplicati
        }
      }
    }

    // Carica simulazioni JSON per materie
    const subjects = ['greco', 'italiano', 'latino', 'matematica'];
    
    for (const subject of subjects) {
      const subjectDir = path.join(SIMULATIONS_DIR, subject);
      
      if (fs.existsSync(subjectDir)) {
        const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.json'));
        console.log(`📚 Caricamento ${files.length} simulazioni ${subject}...`);
        
        let loaded = 0;
        for (const file of files) {
          try {
            const filePath = path.join(subjectDir, file);
            const simData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            await prisma.simulation.create({
              data: {
                title: simData.titolo || `Simulazione ${subject} - ${file.replace('.json', '')}`,
                description: simData.descrizione || `Prova d'esame ${subject}`,
                subject: subject,
                difficulty: simData.difficolta || 'medium',
                questions: JSON.stringify(simData)
              }
            });
            loaded++;
            totalLoaded++;
          } catch (err) {
            // Skip errori/duplicati
          }
        }
        console.log(`  ✓ Caricate ${loaded} simulazioni ${subject}`);
      }
    }

    console.log(`✅ Totale ${totalLoaded} simulazioni caricate`);
  } catch (error) {
    console.error('❌ Errore caricamento simulazioni:', error);
  }
}

module.exports = { loadAllSimulations };
