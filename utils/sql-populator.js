/**
 * POPOLAMENTO SQL DIRETTO - ULTIMA RISORSA
 * Bypassa completamente i loader problematici
 */

const MATERIE_BASE = [
  { id: 'subj_italiano', name: 'Italiano', icon: '📚', color: '#D32F2F', desc: 'Letteratura, grammatica e analisi del testo' },
  { id: 'subj_storia', name: 'Storia', icon: '🏛️', color: '#795548', desc: 'Storia antica, moderna e contemporanea' },
  { id: 'subj_filosofia', name: 'Filosofia', icon: '🧠', color: '#512DA8', desc: 'Pensiero filosofico e correnti' },
  { id: 'subj_matematica', name: 'Matematica', icon: '🔢', color: '#1976D2', desc: 'Algebra, geometria, analisi' },
  { id: 'subj_fisica', name: 'Fisica', icon: '⚡', color: '#0288D1', desc: 'Meccanica, termodinamica, elettromagnetismo' },
  { id: 'subj_scienze', name: 'Scienze', icon: '🔬', color: '#388E3C', desc: 'Biologia, chimica, scienze della terra' },
  { id: 'subj_latino', name: 'Latino', icon: '🏺', color: '#F57C00', desc: 'Grammatica e letteratura latina' },
  { id: 'subj_greco', name: 'Greco', icon: '🏛️', color: '#00796B', desc: 'Grammatica e letteratura greca' },
  { id: 'subj_inglese', name: 'Inglese', icon: '🇬🇧', color: '#303F9F', desc: 'Lingua e letteratura inglese' },
  { id: 'subj_arte', name: 'Arte', icon: '🎨', color: '#C2185B', desc: 'Storia dell arte e analisi opere' },
  { id: 'subj_francese', name: 'Francese', icon: '🇫🇷', color: '#5E35B1', desc: 'Lingua e letteratura francese' },
  { id: 'subj_spagnolo', name: 'Spagnolo', icon: '🇪🇸', color: '#E64A19', desc: 'Lingua e letteratura spagnola' },
  { id: 'subj_tedesco', name: 'Tedesco', icon: '🇩🇪', color: '#455A64', desc: 'Lingua e letteratura tedesca' },
  { id: 'subj_religione', name: 'Religione', icon: '✝️', color: '#6D4C41', desc: 'Religione cattolica e culture' },
  { id: 'subj_pedagogia', name: 'Pedagogia', icon: '👨‍🏫', color: '#7B1FA2', desc: 'Scienze dell educazione' },
  { id: 'subj_psicologia', name: 'Psicologia', icon: '🧩', color: '#AD1457', desc: 'Psicologia generale e sociale' }
];

async function popolaConSQL(prisma) {
  console.log('\n🔥 === POPOLAMENTO SQL DIRETTO ===\n');
  
  try {
    // 1. PULIZIA TOTALE
    console.log('🗑️ Pulizia database...');
    await prisma.$executeRaw`DELETE FROM "Progress"`;
    await prisma.$executeRaw`DELETE FROM "Quiz"`;
    await prisma.$executeRaw`DELETE FROM "Flashcard"`;
    await prisma.$executeRaw`DELETE FROM "Subtopic"`;
    await prisma.$executeRaw`DELETE FROM "Topic"`;
    await prisma.$executeRaw`DELETE FROM "Subject"`;
    await prisma.$executeRaw`DELETE FROM "Simulation"`;
    console.log('✅ Database pulito\n');
    
    // 2. INSERIMENTO MATERIE + TOPICS
    console.log('📚 Inserimento materie con topics...');
    let inserted = 0;
    
    for (const mat of MATERIE_BASE) {
      try {
        // Insert Subject
        await prisma.$executeRaw`
          INSERT INTO "Subject" (id, name, icon, color, description, "createdAt", "updatedAt")
          VALUES (${mat.id}, ${mat.name}, ${mat.icon}, ${mat.color}, ${mat.desc}, NOW(), NOW())
        `;
        
        // Insert Topic Generale
        const topicId = `topic_${mat.id.replace('subj_', '')}_gen`;
        await prisma.$executeRaw`
          INSERT INTO "Topic" (id, title, description, year, "subjectId", "createdAt", "updatedAt")
          VALUES (${topicId}, 'Generale', ${`Contenuti generali di ${mat.name}`}, '5', ${mat.id}, NOW(), NOW())
        `;
        
        console.log(`  ✅ ${mat.name}`);
        inserted++;
      } catch (err) {
        console.error(`  ❌ ${mat.name}: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Inserite ${inserted}/${MATERIE_BASE.length} materie\n`);
    
    // 3. VERIFICA
    const counts = {
      subjects: await prisma.subject.count(),
      topics: await prisma.topic.count()
    };
    
    console.log(`📊 Verifica: ${counts.subjects} materie, ${counts.topics} topics\n`);
    
    return counts;
    
  } catch (error) {
    console.error('❌ ERRORE SQL:', error);
    throw error;
  }
}

module.exports = { popolaConSQL };
