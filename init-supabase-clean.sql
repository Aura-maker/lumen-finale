-- PULISCIAMO TUTTO E RICREIAMO DA CAPO - LUMEN STUDIO

-- Elimina tabelle se esistono
DROP TABLE IF EXISTS "_BadgeToUser" CASCADE;
DROP TABLE IF EXISTS "Progress" CASCADE;
DROP TABLE IF EXISTS "Simulation" CASCADE;
DROP TABLE IF EXISTS "Flashcard" CASCADE;
DROP TABLE IF EXISTS "Quiz" CASCADE;
DROP TABLE IF EXISTS "Subtopic" CASCADE;
DROP TABLE IF EXISTS "Topic" CASCADE;
DROP TABLE IF EXISTS "Badge" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Subject" CASCADE;

-- Tabella Materie
CREATE TABLE "Subject" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Tabella Argomenti
CREATE TABLE "Topic" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE
);

-- Tabella Sottoargomenti
CREATE TABLE "Subtopic" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE
);

-- Tabella Quiz
CREATE TABLE "Quiz" (
    "id" TEXT PRIMARY KEY,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE
);

-- Tabella Flashcard
CREATE TABLE "Flashcard" (
    "id" TEXT PRIMARY KEY,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE CASCADE
);

-- Tabella Utenti
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Badge
CREATE TABLE "Badge" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Progress
CREATE TABLE "Progress" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabella Simulazioni
CREATE TABLE "Simulation" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella relazione User-Badge (many-to-many)
CREATE TABLE "_BadgeToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    FOREIGN KEY ("A") REFERENCES "Badge"("id") ON DELETE CASCADE,
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "_BadgeToUser_AB_unique" ON "_BadgeToUser"("A", "B");
CREATE INDEX "_BadgeToUser_B_index" ON "_BadgeToUser"("B");

-- Indici per performance
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");
CREATE INDEX "Subtopic_topicId_idx" ON "Subtopic"("topicId");
CREATE INDEX "Quiz_topicId_idx" ON "Quiz"("topicId");
CREATE INDEX "Flashcard_subtopicId_idx" ON "Flashcard"("subtopicId");
CREATE INDEX "Progress_userId_idx" ON "Progress"("userId");
