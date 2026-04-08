import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';

const adapter = new PrismaPg(env.DATABASE_URL);
export const prisma = new PrismaClient({ adapter });
