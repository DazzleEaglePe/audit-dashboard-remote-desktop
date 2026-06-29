import "./load-env";

import { seedDatabase } from "./src/lib/db";
import { startBackgroundWorkers } from "./src/lib/workers";

async function main() {
  console.log("=== STARTING DEDICATED BACKGROUND WORKER ===");
  
  // Fail fast in production if critical secrets are missing or insecure
  if (process.env.NODE_ENV === 'production') {
    if (
      !process.env.NEXTAUTH_SECRET || 
      process.env.NEXTAUTH_SECRET === 'fallback-secret-change-me' ||
      process.env.NEXTAUTH_SECRET === 'dev-secret-change-in-production-abc123' ||
      process.env.NEXTAUTH_SECRET === 'generate-a-random-secret-here'
    ) {
      throw new Error('CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is missing or insecure in production environment!');
    }
    if (
      !process.env.ENCRYPTION_KEY || 
      process.env.ENCRYPTION_KEY === 'generate-a-random-encryption-key-here'
    ) {
      throw new Error('CRITICAL SECURITY ERROR: ENCRYPTION_KEY is missing or insecure in production environment!');
    }
  }

  // Seed database on startup to guarantee DB tables/schema are seeded
  await seedDatabase();
  // Start background loops
  await startBackgroundWorkers();
}

main().catch((err) => {
  console.error("Fatal error starting background worker:", err);
  process.exit(1);
});
