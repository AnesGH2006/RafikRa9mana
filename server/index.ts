import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSocketIO } from "./socket/index.js";
import { isDatabaseConfigured } from "../shared/db.js";
import { startNotificationWorker } from "./services/notificationQueue.js";

// ── Startup environment validation ────────────────────────────────────────────
// Log warnings for optional or environment-specific variables; only hard-exit
// for truly required values that cannot be recovered from.
const HARD_REQUIRED: Record<string, string> = {
  DATABASE_URL: "PostgreSQL connection string — required for sessions and data",
};

let startupOk = true;
for (const [key, description] of Object.entries(HARD_REQUIRED)) {
  if (!process.env[key]) {
    logger.error({ envVar: key }, `Missing required environment variable: ${key} (${description})`);
    startupOk = false;
  }
}

if (!process.env.GOOGLE_CLIENT_ID && !process.env.OIDC_CLIENT_ID) {
  logger.warn(
    { envVar: "GOOGLE_CLIENT_ID" },
    "Missing Google OAuth client ID (set GOOGLE_CLIENT_ID). Login will be unavailable.",
  );
}

if (!startupOk) {
  logger.fatal("Server cannot start safely — one or more required environment variables are missing. Set them and restart.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  logger.warn(
    "SESSION_SECRET is not set. Set it to a long random string to protect session cookies.",
  );
}

// ── Verify database connectivity (non-fatal) ──────────────────────────────────
// We attempt a quick connectivity probe and log the result, but we do NOT
// exit on failure.  In autoscale/Cloud Run the managed database may not be
// reachable under the development hostname; the deploy must still promote so
// the runtime can inject the correct production DATABASE_URL on subsequent
// deploys.  Individual routes return 503 when the pool is unavailable.
import { db } from "../shared/db.js";
import { sql } from "drizzle-orm";

async function probeDb(attempt = 1): Promise<void> {
  if (!isDatabaseConfigured) {
    logger.warn("DATABASE_URL is not configured — skipping database health probe. Database-dependent routes will fail until it is set.");
    return;
  }

  const MAX_ATTEMPTS = 5;
  const DELAY_MS = 3000;
  try {
    await db.execute(sql`SELECT 1`);
    logger.info("Database connection verified");
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      logger.warn({ err, attempt }, `Database probe failed — retrying in ${DELAY_MS / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await new Promise(r => setTimeout(r, DELAY_MS));
      return probeDb(attempt + 1);
    }
    // After all retries, log the error but keep the server running.
    // The production environment will inject the correct DATABASE_URL;
    // the server must stay up so the deployment promote step can succeed.
    logger.error(
      { err },
      "Database connection failed after retries — server will continue running. " +
      "Check DATABASE_URL and ensure the database is reachable. " +
      "DB-dependent routes will return errors until connectivity is restored.",
    );
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "8080");

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "Server listening");
  startNotificationWorker();
  // Probe DB in the background after the port is open so the health check
  // can succeed even while we are still waiting for the database.
  probeDb().catch(() => {/* already logged inside probeDb */});
});
