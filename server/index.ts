import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSocketIO } from "./socket/index.js";

// ── Startup environment validation ────────────────────────────────────────────
// Fail fast with a clear message rather than letting auth silently break later.
const REQUIRED_ENV: Record<string, string> = {
  REPL_ID: "Replit OIDC client ID — required for the login flow",
  DATABASE_URL: "PostgreSQL connection string — required for sessions and data",
};

let startupOk = true;
for (const [key, description] of Object.entries(REQUIRED_ENV)) {
  if (!process.env[key]) {
    logger.error({ envVar: key }, `Missing required environment variable: ${key} (${description})`);
    startupOk = false;
  }
}

if (!process.env.SESSION_SECRET) {
  logger.warn(
    "SESSION_SECRET is not set. Set it to a long random string to protect session cookies.",
  );
}

if (!startupOk) {
  logger.fatal("Server cannot start safely — one or more required environment variables are missing. Set them and restart.");
  process.exit(1);
}

// ── Verify database connectivity ──────────────────────────────────────────────
// A bad DATABASE_URL would otherwise surface as a cryptic error on the first
// authenticated request rather than at startup.
import { db } from "../shared/db.js";
import { sql } from "drizzle-orm";

try {
  await db.execute(sql`SELECT 1`);
  logger.info("Database connection verified");
} catch (err) {
  logger.fatal({ err }, "Database connection failed — check DATABASE_URL and restart.");
  process.exit(1);
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "8080");

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "Server listening");
});
