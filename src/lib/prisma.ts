/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, and a fresh PrismaClient per
 * reload exhausts the connection pool within a few minutes of editing. Caching
 * it on globalThis is the documented workaround; in production the module is
 * evaluated once so the guard is a no-op.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/* With SAMPLE_DATA_ONLY set (lib/env.ts), never the configured database: an
   address under the reserved `.invalid` domain, which cannot resolve, so any
   query that slipped past `hasDatabase()` errors instead of writing to
   production. */
const sampleOnly = process.env.SAMPLE_DATA_ONLY?.trim() === '1';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(sampleOnly ? { datasourceUrl: 'postgresql://sample-data-only.invalid:5432/none' } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
