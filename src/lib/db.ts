import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  // Pooled URL (Neon's -pooler endpoint) for app traffic; migrations use the direct URL (prisma.config.ts).
  // pg 9 will downgrade "require" to libpq semantics (no cert check); pin today's full verification explicitly.
  const connectionString = process.env.DATABASE_URL?.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
  const pool = new Pool({ connectionString });
  // On Vercel Fluid compute, keeps the function alive just long enough to close idle connections. No-op elsewhere.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Reused across hot reloads in dev so we don't exhaust connections.
export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
