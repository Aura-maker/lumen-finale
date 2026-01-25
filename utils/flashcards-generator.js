/**
 * GENERATORE FLASHCARDS DA QUIZ ESISTENTI
 * Crea flashcards dai quiz già caricati nel DB
 */

async function generateFlashcardsFromQuizzes(prisma) {
  console.log('\n🃏 === GENERAZIONE FLASHCARDS DA QUIZ ===\n');
  
  try {
    // 1. Prendi tutti i quiz
    const allQuizzes = await prisma.quiz.findMany({
      include: {
        topic: {
          include: {
            subject: true,
            subtopics: true
          }
        }
      }
    });
    
    console.log(`📊 Trovati ${allQuizzes.length} quiz da convertire`);
    
    let created = 0;
    let skipped = 0;
    
    // 2. Per ogni quiz, crea una flashcard
    for (const quiz of allQuizzes) {
      try {
        // Crea sottoargomento se non esiste
        let subtopic = quiz.topic.subtopics[0];
        
        if (!subtopic) {
          subtopic = await prisma.subtopic.create({
            data: {
              title: 'Generale',
              summary: `Contenuti generali di ${quiz.topic.title}`,
              content: '',
              topicId: quiz.topicId
            }
          });
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
            subtopicId: subtopic.id
          }
        });
        
        created++;
        
        if (created % 500 === 0) {
          console.log(`  ✅ ${created} flashcards create...`);
        }
        
      } catch (err) {
        skipped++;
        if (skipped <= 5) {
          console.error(`  ⚠️ Skip: ${err.message}`);
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
