import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Standard PostgreSQL configuration for local development
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // SSL is disabled for local development
  ssl: false
});

export const db = drizzle({ client: pool, schema });