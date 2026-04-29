import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In Next.js dev, hot reload would otherwise spawn a new client per HMR
 * and exhaust DB connections. We attach to globalThis to reuse one client
 * across reloads in development. In production, a fresh module = fresh
 * client, which is what we want.
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
