import path from 'node:path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// 从 monorepo 根目录加载 .env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://tuosan:tuosan_dev@localhost:5432/tuosan',
  },
  migrate: {
    async resolveAdapter() {
      return undefined;
    },
  },
});
