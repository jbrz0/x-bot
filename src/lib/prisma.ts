import { PrismaClient } from '@prisma/client';

// This module exports a singleton PrismaClient instance.
// It reads the DATABASE_URL environment variable automatically, 
// as defined in the schema.prisma (`datasource db { url = env("DATABASE_URL") }`).
// Ensure .env is loaded before this module is imported.

const prisma = new PrismaClient();

export default prisma; 