-- INIZIALIZZAZIONE DATABASE SUPABASE PER LUMEN STUDIO (CORRETTO)

-- Tabella Materie
CREATE TABLE IF NOT EXISTS "Subject" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Tabella Argomenti
CREATE TABLE IF NOT EXISTS "Topic" (
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
CREATE TABLE IF NOT EXISTS "Subtopic" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE
);

-- Tabella Quiz
CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT PRIMARY KEY,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctAnswer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE
);

-- Tabella Flashcard
CREATE TABLE IF NOT EXISTS "Flashcard" (
    "id" TEXT PRIMARY KEY,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE CASCADE
);

-- Tabella Utenti
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Tabella Badge
CREATE TABLE IF NOT EXISTS "Badge" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Progress
CREATE TABLE IF NOT EXISTS "Progress" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Tabella Simulazioni
CREATE TABLE IF NOT EXISTS "Simulation" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Tabella relazione User-Badge (many-to-many)
CREATE TABLE IF NOT EXISTS "_BadgeToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    FOREIGN KEY ("A") REFERENCES "Badge"("id") ON DELETE CASCADE,
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "_BadgeToUser_AB_unique" ON "_BadgeToUser"("A", "B");
CREATE INDEX IF NOT EXISTS "_BadgeToUser_B_index" ON "_BadgeToUser"("B");

-- Indici per performance (con nomi colonne corretti)
CREATE INDEX IF NOT EXISTS "Topic_subjectId_idx" ON "Topic"("subjectId");
CREATE INDEX IF NOT EXISTS "Subtopic_topicId_idx" ON "Subtopic"("topicId");
CREATE INDEX IF NOT EXISTS "Quiz_topicId_idx" ON "Quiz"("topicId");
CREATE INDEX IF NOT EXISTS "Flashcard_subtopicId_idx" ON "Flashcard"("subtopicId");
CREATE INDEX IF NOT EXISTS "Progress_userId_idx" ON "Progress"("userId");
