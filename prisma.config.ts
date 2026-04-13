import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load .env.local (Next.js convention) for Prisma CLI commands
config({ path: ".env.local" });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
