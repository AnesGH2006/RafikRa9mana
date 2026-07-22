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

// ── Per-user agent socket registry ───────────────────────────────────────────
// Keyed by userId → the currently connected agent Socket.
const agentSockets = new Map<string, Socket>();

// ── Pending one-shot response callbacks ──────────────────────────────────────
// taskResult: userId → { action, resolve, reject, timer }
type ResultWaiter = {
  action: string;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const taskResultWaiters = new Map<string, ResultWaiter>();

// screenFrame: userId → { resolve, reject, timer }
type FrameWaiter = {
  resolve: (base64: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const screenFrameWaiters = new Map<string, FrameWaiter>();

/**
 * Send a desktop automation command to the connected agent for a user.
 *
 * Protocol (mirrors the existing Electron/renderer agent):
 *   Server  → Agent : `agent:command`  { action, payload }
 *   Agent   → Server: `agent:taskResult` { action, status, details, taskId }
 *
 * For `screenCapture` the agent additionally emits `agent:screenFrame` with
 * the raw base64 frame — so callers should use waitForScreenFrame() instead.
 *
 * Returns the details from agent:taskResult, or throws on timeout / no agent.
 */
export async function sendDesktopCommand(
  userId: string,
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 30_000,
): Promise<unknown> {
  const socket = agentSockets.get(userId);
  if (!socket?.connected) {
    throw new Error("لا يوجد وكيل سطح مكتب متصل لهذا المستخدم");
  }

  // Reject any stale waiter for this user (commands must be sequential)
  const stale = taskResultWaiters.get(userId);
  if (stale) {
    clearTimeout(stale.timer);
    taskResultWaiters.delete(userId);
    stale.reject(new Error("أُلغي الأمر السابق — تم إرسال أمر جديد"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      taskResultWaiters.delete(userId);
      reject(new Error(`انتهت مهلة الانتظار — لم يرد وكيل سطح المكتب خلال ${Math.round(timeoutMs / 1000)} ثانية`));
    }, timeoutMs);

    taskResultWaiters.set(userId, { action, resolve, reject, timer });

    socket.emit("agent:command", { action, payload });
    logger.info({ userId, action, payload }, "Desktop command sent → agent:command");
  });
}

/**
 * Wait for the next agent:screenFrame from the connected agent.
 * Pair this with sendDesktopCommand(userId, 'screenCapture') for screenshots.
 */
export async function waitForScreenFrame(
  userId: string,
  timeoutMs = 30_000,
): Promise<string> {
  // Cancel any previous waiter
  const stale = screenFrameWaiters.get(userId);
  if (stale) {
    clearTimeout(stale.timer);
    screenFrameWaiters.delete(userId);
    stale.reject(new Error("إلغاء انتظار لقطة شاشة سابقة"));
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      screenFrameWaiters.delete(userId);
      reject(new Error("انتهت مهلة انتظار لقطة الشاشة"));
    }, timeoutMs);

    screenFrameWaiters.set(userId, { resolve, reject, timer });
  });
}

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

  // Register socket for this user
  agentSockets.set(userId, socket);

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

  // ── Screen frame: from agent after screenCapture or streaming ────────────────
  socket.on("agent:screenFrame", (frame: unknown) => {
    // 1. Resolve a waiting screenshot promise (used by desktop_control_tool)
    const waiter = screenFrameWaiters.get(userId);
    if (waiter) {
      clearTimeout(waiter.timer);
      screenFrameWaiters.delete(userId);
      const base64 = typeof frame === "string" ? frame : JSON.stringify(frame);
      waiter.resolve(base64);
    }

    // 2. Broadcast to web-control room (live stream / dashboard)
    io.to(`control:${userId}`).emit("agent:screenFrame", frame);
  });

  // ── Shell result forwarded to web clients ─────────────────────────────────────
  socket.on("agent:shellResult", (result: unknown) => {
    io.to(`control:${userId}`).emit("agent:shellResult", result);
  });

  // ── Task result from agent (response to agent:command) ──────────────────────
  socket.on("agent:taskResult", async (payload: {
    action: string;
    status: "success" | "failed";
    details?: object;
    taskId?: string;
  }) => {
    // 1. Resolve a pending command waiter
    const waiter = taskResultWaiters.get(userId);
    if (waiter) {
      // Accept if the action matches OR if we accept any result (loose match)
      if (!waiter.action || waiter.action === payload.action) {
        clearTimeout(waiter.timer);
        taskResultWaiters.delete(userId);
        if (payload.status === "success") {
          waiter.resolve(payload.details ?? { ok: true, action: payload.action });
        } else {
          waiter.reject(new Error(`فشل تنفيذ "${payload.action}" على الجهاز المحلي`));
        }
      }
    }

    // 2. Persist known administrative actions
    if (ALLOWED_ACTIONS.has(payload.action as AgentAction)) {
      await logAction(agentTokenId, userId, payload.action as AgentAction, payload.status, payload.details).catch(() => {});
    }
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
    // Deregister only if still this socket
    if (agentSockets.get(userId) === socket) {
      agentSockets.delete(userId);
    }

    // Reject any pending waiters for this user
    const taskWaiter = taskResultWaiters.get(userId);
    if (taskWaiter) {
      clearTimeout(taskWaiter.timer);
      taskResultWaiters.delete(userId);
      taskWaiter.reject(new Error("انقطع اتصال وكيل سطح المكتب"));
    }
    const frameWaiter = screenFrameWaiters.get(userId);
    if (frameWaiter) {
      clearTimeout(frameWaiter.timer);
      screenFrameWaiters.delete(userId);
      frameWaiter.reject(new Error("انقطع اتصال وكيل سطح المكتب"));
    }

    logger.info({ agentTokenId }, "Agent disconnected");
    logAction(agentTokenId, userId, "disconnect", "success").catch(() => {});
  });
}
