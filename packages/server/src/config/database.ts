import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Prisma 7 requires datasourceUrl via constructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL } as any);
