import { PrismaClient } from "@prisma/client";

// Singleton pattern: prevents exhausting MySQL connections during
// Next.js hot-reload in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
