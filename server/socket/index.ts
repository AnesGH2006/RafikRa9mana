import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { agentHandler } from "./agentHandler.js";
import { db, agentTokensTable } from "../../shared/db.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

let io: SocketIOServer;

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function initSocketIO(httpServer: HttpServer): void {
  io = new SocketIOServer(httpServer, {
    // Allow any origin — the desktop agent connects from file:// (null origin).
    // Auth is enforced by Bearer token in the socket middleware below, not by origin.
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/agent-socket",
  });

  // Auth middleware — validate agent token on every connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing token"));

    try {
      const [agentToken] = await db
        .select()
        .from(agentTokensTable)
        .where(eq(agentTokensTable.token, token));

      if (!agentToken) return next(new Error("Invalid token"));
      if (agentToken.expiresAt && agentToken.expiresAt < new Date()) {
        return next(new Error("Token expired"));
      }

      (socket as any).agentToken = agentToken;
      next();
    } catch (err) {
      logger.error(err, "Socket auth error");
      next(new Error("Auth error"));
    }
  });

  io.on("connection", (socket) => {
    const agentToken = (socket as any).agentToken;
    logger.info({ agentTokenId: agentToken.id, device: agentToken.deviceName }, "Agent connected");
    agentHandler(io, socket);
  });

  logger.info("Socket.IO initialized at /agent-socket");
}
