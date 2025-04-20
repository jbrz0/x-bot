import { PrismaClient } from '@prisma/client';

// Ensure environment variables are loaded by the time this module is imported
// (e.g., by importing dotenv early in the application entry point like bot.ts)

// Determine the correct database URL based on simulate mode flag or env var
const isSimulate = process.env.SIMULATE_MODE === 'true' || process.argv.includes('--simulate');
const dbUrl = isSimulate 
  ? process.env.SIMULATE_DATABASE_URL 
  : process.env.DATABASE_URL;

// Instantiate Prisma Client singleton.
// It will read the DATABASE_URL directly from the environment, 
// as defined in the schema (`url = env("DATABASE_URL")`).
// Ensure the correct URL (SQLite for local/simulate, Postgres for prod) 
// is set in .env *before* running the application.
const prisma = new PrismaClient();

export default prisma; 