/**
 * GENERATORE FLASHCARDS DA QUIZ ESISTENTI
 * Crea flashcards dai quiz già caricati nel DB
 */

async function generateFlashcardsFromQuizzes(prisma) {
  console.log('\n🃏 === GENERAZIONE FLASHCARDS DA QUIZ ===\n');
  
  try {
    // 0. CANCELLA TUTTE LE FLASHCARDS ESISTENTI
    const deleted = await prisma.flashcard.deleteMany({});
    console.log(`🗑️ Cancellate ${deleted.count} flashcards esistenti`);
    
    // 1. Prendi tutti i quiz
    const allQuizzes = await prisma.quiz.findMany({
      include: {
        topic: {
          include: {
            subject: true
          }
        }
      }
    });
    
    console.log(`📊 Trovati ${allQuizzes.length} quiz da convertire\n`);
    
    let created = 0;
    let skipped = 0;
    
    // Cache per subtopics per topic
    const subtopicCache = new Map();
    
    // 2. Per ogni quiz, crea UNA flashcard
    for (const quiz of allQuizzes) {
      try {
        // Ottieni o crea subtopic per questo topic
        let subtopicId = subtopicCache.get(quiz.topicId);
        
        if (!subtopicId) {
          // Cerca subtopic esistente
          let subtopic = await prisma.subtopic.findFirst({
            where: { topicId: quiz.topicId }
          });
          
          // Se non esiste, crealo
          if (!subtopic) {
            subtopic = await prisma.subtopic.create({
              data: {
                title: 'Generale',
                summary: `Contenuti di ${quiz.topic.title}`,
                content: '',
                topicId: quiz.topicId
              }
            });
          }
          
          subtopicId = subtopic.id;
          subtopicCache.set(quiz.topicId, subtopicId);
        }
        
        // Estrai domanda e risposta corretta
        const options = JSON.parse(quiz.options || '[]');
        const correctAnswer = options[quiz.correctAnswer] || '';
        
        // Crea flashcard: domanda sul fronte, risposta+spiegazione sul retro
        const front = quiz.question;
        const back = `**Risposta:** ${correctAnswer}\n\n**Spiegazione:** ${quiz.explanation || 'Nessuna spiegazione disponibile.'}`;
        
        await prisma.flashcard.create({
          data: {
            front,
            back,
            subtopicId
          }
        });
        
        created++;
        
        if (created % 1000 === 0) {
          console.log(`  ✅ ${created} flashcards create...`);
        }
        
      } catch (err) {
        skipped++;
        if (skipped <= 10) {
          console.error(`  ⚠️ Skip quiz ${quiz.id}: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Flashcards generate: ${created}`);
    console.log(`⚠️ Skip: ${skipped}\n`);
    
    return { created, skipped, total: allQuizzes.length };
    
  } catch (error) {
    console.error('❌ Errore generazione flashcards:', error);
    throw error;
  }
}

async function generateSimulationsFromQuizzes(prisma) {
  console.log('\n📝 === GENERAZIONE SIMULAZIONI DA QUIZ ===\n');
  
  try {
    // Prendi tutte le materie
    const subjects = await prisma.subject.findMany({
      include: {
        topics: {
          include: {
            quizzes: true
          }
        }
      }
    });
    
    let created = 0;
    
    // Per ogni materia con almeno 40 quiz, crea una simulazione
    for (const subject of subjects) {
      const allQuizzes = subject.topics.flatMap(t => t.quizzes);
      
      if (allQuizzes.length >= 40) {
        // Crea simulazione con 40 quiz random
        const shuffled = allQuizzes.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 40);
        
        const questions = selected.map(q => ({
          id: q.id,
          domanda: q.question,
          opzioni: JSON.parse(q.options || '[]'),
          rispostaCorretta: q.correctAnswer,
          spiegazione: q.explanation,
          difficolta: q.difficulty
        }));
        
        await prisma.simulation.create({
          data: {
            title: `Simulazione Esame - ${subject.name}`,
            description: `Simulazione completa con 40 domande di ${subject.name}`,
            subject: subject.name,
            difficulty: 'MEDIUM',
            questions: JSON.stringify(questions)
          }
        });
        
        created++;
        console.log(`  ✅ Simulazione creata per ${subject.name}`);
      } else {
        console.log(`  ⚠️ ${subject.name}: solo ${allQuizzes.length} quiz (min 40 richiesti)`);
      }
    }
    
    console.log(`\n✅ Simulazioni create: ${created}\n`);
    
    return { created };
    
  } catch (error) {
    console.error('❌ Errore generazione simulazioni:', error);
    throw error;
  }
}

module.exports = {
  generateFlashcardsFromQuizzes,
  generateSimulationsFromQuizzes
};
