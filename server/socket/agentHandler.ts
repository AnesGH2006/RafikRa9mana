import type { Server as SocketIOServer, Socket } from "socket.io";
import { db, agentTokensTable, agentLogsTable } from "../../shared/db.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { randomUUID } from "crypto";

type AgentAction =
  | "upload_excel" | "print_report" | "open_folder" | "open_file"
  | "open_app" | "backup_reports" | "sync_data" | "monitor_folder"
  | "connect" | "disconnect";

const ALLOWED_ACTIONS = new Set<AgentAction>([
  "upload_excel", "print_report", "open_folder", "open_file",
  "open_app", "backup_reports", "sync_data", "monitor_folder",
]);

// Commands that the agent can execute — sent from web UI → server → agent socket.
// These are forwarded as-is; the agent renderer dispatches them via handleCommand().
const FORWARDABLE_COMMANDS = new Set([
  "openFolder", "openFile", "openApp", "backupReports",
  "monitorFolder", "syncData", "printReport",
  "openUrl",
  "screenCapture", "startStream", "stopStream",
  "mouseClick", "mouseDoubleClick", "mouseScroll", "mouseMove",
  "typeText", "pressKey",
  "shellExec",
]);

async function logAction(
  agentTokenId: string,
  userId: string,
  action: AgentAction,
  status: "success" | "failed",
  details?: object,
): Promise<void> {
  await db.insert(agentLogsTable).values({
    id: randomUUID(),
    agentTokenId,
    userId,
    action,
    status,
    details: details ?? null,
  });
}

export function agentHandler(io: SocketIOServer, socket: Socket): void {
  const agentToken = (socket as any).agentToken;
  const { id: agentTokenId, userId } = agentToken;

  // Mark as seen
  db.update(agentTokensTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(agentTokensTable.id, agentTokenId))
    .catch((e) => logger.error(e, "lastSeenAt update failed"));

  logAction(agentTokenId, userId, "connect", "success").catch(() => {});

  // ── Heartbeat ───────────────────────────────────────────────────────────────
  socket.on("agent:ping", (cb) => {
    db.update(agentTokensTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(agentTokensTable.id, agentTokenId))
      .catch(() => {});
    if (typeof cb === "function") cb({ ok: true, ts: Date.now() });
  });

  // ── Screen frame forwarded from agent to any listening web clients ───────────
  socket.on("agent:screenFrame", (frame: unknown) => {
    // Broadcast to web-control room so the dashboard can receive live frames
    io.to(`control:${userId}`).emit("agent:screenFrame", frame);
  });

  // ── Shell result forwarded to web clients ─────────────────────────────────────
  socket.on("agent:shellResult", (result: unknown) => {
    io.to(`control:${userId}`).emit("agent:shellResult", result);
  });

  // ── Task result from agent ──────────────────────────────────────────────────
  socket.on("agent:taskResult", async (payload: {
    action: AgentAction;
    status: "success" | "failed";
    details?: object;
    taskId?: string;
  }) => {
    if (!ALLOWED_ACTIONS.has(payload.action)) {
      logger.warn({ action: payload.action }, "Unknown action in taskResult — ignored");
      return;
    }
    await logAction(agentTokenId, userId, payload.action, payload.status, payload.details).catch(() => {});
  });

  // ── Server → agent commands ─────────────────────────────────────────────────
  socket.on("server:syncData", (payload: { year?: string }, cb) => {
    socket.emit("agent:command", { action: "syncData", payload });
    if (typeof cb === "function") cb({ queued: true });
  });

  socket.on("server:openFolder", (payload: { path: string }, cb) => {
    socket.emit("agent:command", { action: "openFolder", payload });
    if (typeof cb === "function") cb({ queued: true });
  });

  socket.on("server:backupReports", (
    payload: { sourceFolder: string; destFolder: string },
    cb,
  ) => {
    socket.emit("agent:command", { action: "backupReports", payload });
    if (typeof cb === "function") cb({ queued: true });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    logger.info({ agentTokenId }, "Agent disconnected");
    logAction(agentTokenId, userId, "disconnect", "success").catch(() => {});
  });
}
