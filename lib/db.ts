import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Currently unused at runtime — the seed scripts and `/api/recommend`
 * use raw `pg` directly to avoid the Windows-ARM Prisma binary issue
 * we hit during local dev. On Vercel (Linux x64) the Prisma binary
 * works fine, so we keep this file ready for the day we want typed
 * Prisma queries from server code.
 *
 * In Next.js dev, hot reload would otherwise spawn a new client per HMR
 * and exhaust DB connections. We attach to globalThis to reuse one
 * client across reloads in development.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
