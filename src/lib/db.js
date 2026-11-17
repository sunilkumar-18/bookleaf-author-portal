import { PrismaClient } from "@prisma/client";

// Re-use one PrismaClient across hot reloads in dev (Next.js re-evaluates
// modules on every change, which would otherwise exhaust DB connections).
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
