require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  clearContentTables,
  loadAllContent
} = require('../utils/content-manager');

async function seedContent() {
  let prisma;
  try {
    console.log('🌱 Avvio seed contenuti Supabase...');
    console.log('🔍 Node version:', process.version);
    console.log('🔍 DATABASE_URL presente:', !!process.env.DATABASE_URL);
    console.log('🔍 DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'NON IMPOSTATA');
    
    // Try to create Prisma client with error handling
    try {
      prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
      });
      console.log('✅ Prisma client creato');
    } catch (prismaError) {
      console.error('❌ Errore creazione Prisma client:', prismaError.message);
      throw prismaError;
    }

    await clearContentTables(prisma);
    console.log('🆕 Tabelle pronte, carico nuovi contenuti...');
    await loadAllContent(prisma);
    console.log('✅ Contenuti caricati con successo!');
  } catch (error) {
    console.error('❌ Errore seed contenuti:', error);
    console.error('Stack trace:', error.stack);
    process.exitCode = 1;
  } finally {
    if (prisma) {
      await prisma.$disconnect();
      console.log('🔌 Prisma disconnesso');
    }
  }
}

seedContent();
