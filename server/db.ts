import { Pool, neonConfig } from "@neondatabase/serverless"; //comment this line in deployment
import { drizzle } from "drizzle-orm/neon-serverless"; //comment this line in deployment
import ws from "ws";
import * as schema from "@shared/schema";
//import { Pool } from 'pg'; //uncomment this line in deployment
//import { drizzle } from 'drizzle-orm/node-postgres'; //uncomment this line in deployment
import dotenv from "dotenv"; //uncomment this line
dotenv.config(); //uncomment this line
// neonConfig.webSocketConstructor = ws; //comment this line in deployment

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
