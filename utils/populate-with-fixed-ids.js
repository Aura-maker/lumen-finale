/**
 * POPOLAMENTO CON ID FISSI - Garantisce matching con batch-loader
 */

async function populateWithFixedIds(prisma) {
  console.log('\n🔥 === POPOLAMENTO CON ID FISSI ===\n');
  
  // 1. PULIZIA COMPLETA
  console.log('🗑️ Pulizia DB...');
  await prisma.progress.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.flashcard.deleteMany({});
  await prisma.subtopic.deleteMany({});
  await prisma.topic.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.simulation.deleteMany({});
  console.log('✅ DB pulito\n');
  
  // 2. MATERIE CON ID FISSI
  console.log('📚 Inserimento materie...');
  
  // TUTTE le 25 materie presenti nel JSON quiz
  const subjects = [
    { id: 'subj_italiano', name: 'Italiano', icon: '📚', color: '#E74C3C', description: 'Letteratura italiana' },
    { id: 'subj_storia', name: 'Storia', icon: '🏛️', color: '#4A148C', description: 'Storia antica e moderna' },
    { id: 'subj_filosofia', name: 'Filosofia', icon: '💭', color: '#1A237E', description: 'Filosofia occidentale' },
    { id: 'subj_arte', name: 'Arte', icon: '🎨', color: '#E65100', description: 'Storia dell\'arte' },
    { id: 'subj_scienze', name: 'Scienze', icon: '🔬', color: '#1B5E20', description: 'Biologia' },
    { id: 'subj_latino', name: 'Latino', icon: '📘', color: '#6A1B9A', description: 'Lingua latina' },
    { id: 'subj_inglese', name: 'Inglese', icon: '🇬🇧', color: '#C62828', description: 'Lingua inglese' },
    { id: 'subj_psicologia', name: 'Psicologia', icon: '🧠', color: '#311B92', description: 'Psicologia' },
    { id: 'subj_sociologia', name: 'Sociologia', icon: '👥', color: '#424242', description: 'Sociologia' },
    { id: 'subj_religione', name: 'Religione', icon: '✝️', color: '#BF360C', description: 'Religione' },
    { id: 'subj_pedagogia', name: 'Pedagogia', icon: '👨‍🏫', color: '#6A4C93', description: 'Pedagogia' },
    { id: 'subj_informatica', name: 'Informatica', icon: '💻', color: '#00897B', description: 'Informatica' },
    { id: 'subj_matematica', name: 'Matematica', icon: '🔢', color: '#0D47A1', description: 'Matematica' },
    { id: 'subj_fisica', name: 'Fisica', icon: '⚛️', color: '#01579B', description: 'Fisica' },
    { id: 'subj_tedesco', name: 'Tedesco', icon: '🇩🇪', color: '#000000', description: 'Lingua tedesca' },
    { id: 'subj_spagnolo', name: 'Spagnolo', icon: '🇪🇸', color: '#C60B1E', description: 'Lingua spagnola' },
    { id: 'subj_francese', name: 'Francese', icon: '🇫🇷', color: '#0055A4', description: 'Lingua francese' },
    { id: 'subj_sistemi', name: 'Sistemi', icon: '⚙️', color: '#5E35B1', description: 'Sistemi e reti' },
    { id: 'subj_antropologia', name: 'Antropologia', icon: '🌍', color: '#4E342E', description: 'Antropologia' },
    { id: 'subj_chimica', name: 'Chimica', icon: '🧪', color: '#E67E22', description: 'Chimica' },
    { id: 'subj_greco', name: 'Greco', icon: '🏺', color: '#004D40', description: 'Lingua greca antica' },
    { id: 'subj_diritto', name: 'Diritto', icon: '⚖️', color: '#6A1B9A', description: 'Diritto' },
    { id: 'subj_economia', name: 'Economia', icon: '💰', color: '#F57C00', description: 'Economia' },
    { id: 'subj_elettronica', name: 'Elettronica', icon: '🔌', color: '#1565C0', description: 'Elettronica' },
    { id: 'subj_meccanica', name: 'Meccanica', icon: '🔧', color: '#37474F', description: 'Meccanica' }
  ];
  
  for (const subj of subjects) {
    await prisma.subject.create({ data: subj });
    console.log(`  ✅ ${subj.name}`);
  }
  
  console.log(`\n✅ ${subjects.length} materie inserite\n`);
  
  // 3. TOPICS CON ID FISSI
  console.log('📋 Inserimento topics...');
  
  // Topics per TUTTE le 25 materie
  const topics = [
    { id: 'topic_italiano_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_italiano' },
    { id: 'topic_storia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_storia' },
    { id: 'topic_filosofia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_filosofia' },
    { id: 'topic_arte_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_arte' },
    { id: 'topic_scienze_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_scienze' },
    { id: 'topic_latino_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_latino' },
    { id: 'topic_inglese_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_inglese' },
    { id: 'topic_psicologia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_psicologia' },
    { id: 'topic_sociologia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_sociologia' },
    { id: 'topic_religione_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_religione' },
    { id: 'topic_pedagogia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_pedagogia' },
    { id: 'topic_informatica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_informatica' },
    { id: 'topic_matematica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_matematica' },
    { id: 'topic_fisica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_fisica' },
    { id: 'topic_tedesco_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_tedesco' },
    { id: 'topic_spagnolo_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_spagnolo' },
    { id: 'topic_francese_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_francese' },
    { id: 'topic_sistemi_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_sistemi' },
    { id: 'topic_antropologia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_antropologia' },
    { id: 'topic_chimica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_chimica' },
    { id: 'topic_greco_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_greco' },
    { id: 'topic_diritto_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_diritto' },
    { id: 'topic_economia_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_economia' },
    { id: 'topic_elettronica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_elettronica' },
    { id: 'topic_meccanica_gen', title: 'Generale', description: 'Contenuti generali', year: '5', subjectId: 'subj_meccanica' }
  ];
  
  for (const topic of topics) {
    await prisma.topic.create({ data: topic });
    console.log(`  ✅ ${topic.title} per ${topic.subjectId}`);
  }
  
  console.log(`\n✅ ${topics.length} topics inseriti\n`);
  
  // 4. VERIFICA
  const counts = {
    subjects: await prisma.subject.count(),
    topics: await prisma.topic.count()
  };
  
  console.log('📊 RISULTATO:');
  console.log(`  Materie: ${counts.subjects}`);
  console.log(`  Topics: ${counts.topics}\n`);
  
  return counts;
}

module.exports = { populateWithFixedIds };
