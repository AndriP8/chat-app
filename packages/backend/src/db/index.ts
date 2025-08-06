import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema.js";

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Check if we're using Neon (production) or local PostgreSQL (development)
const isNeonDatabase = DATABASE_URL.includes("neon.tech");

let db: ReturnType<typeof drizzle> | ReturnType<typeof drizzleNode>;

if (isNeonDatabase) {
  // Use Neon serverless driver for production
  const sql = neon(DATABASE_URL);
  db = drizzle(sql, { schema });
} else {
  // Use node-postgres for local development
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  db = drizzleNode(pool, { schema });
}

export { db };
export * from "./schema.js";
