import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Query logging is development-only.
 *
 * `log: ['query']` was previously unconditional, which meant production
 * logged every SQL statement. Two problems: the chunk INSERTs each carry a
 * 1024-float vector literal, so a single page re-index produced megabytes of
 * log output per request; and query logs routinely capture user content, which
 * is a data-protection problem.
 *
 * Warnings and errors stay on everywhere — those are the ones you want at 3am.
 */
const logLevels: Array<'query' | 'info' | 'warn' | 'error'> =
  process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'];

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: logLevels,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;