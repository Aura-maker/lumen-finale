import 'dotenv/config';

export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres.uqvdiqmioqnvywmkchma:Levinoliver18_@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
};
