import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations must use a direct (unpooled) connection. Neon and its Vercel integration name it DATABASE_URL_UNPOOLED;
  // DIRECT_URL still works for other hosts.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "" },
});
