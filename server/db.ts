import pg from "pg"; // server line
import { drizzle } from "drizzle-orm/node-postgres"; // server line
import "dotenv/config"; //server line
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
dotenv.config();

// Configure WebSocket for Neon serverless
const { Pool } = pg; // server line

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
