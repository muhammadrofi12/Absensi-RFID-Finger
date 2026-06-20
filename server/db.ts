import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

export let db: any = null;

if (process.env.DATABASE_URL) {
  // Create postgres connection (via Supavisor pooler)
  const client = postgres(process.env.DATABASE_URL, {
    ssl: "require",   // Supabase requires SSL
    max: 10,          // connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,   // Required for Supavisor connection pooler
  });

  // Create Drizzle ORM instance
  db = drizzle(client, { schema });
}
