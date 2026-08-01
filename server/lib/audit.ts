/**
 * Audit logging helper.
 * Call `logAudit(...)` from any route to record a critical action in the audit_logs table.
 * Fire-and-forget — errors are silently swallowed so they never break the main request flow.
 */
import type { Request } from "express";
import { db, auditLogsTable } from "../../shared/db.js";

export interface AuditPayload {
  /** Head-admin account whose data was affected */
  userId: string;
  /** Who actually triggered the action (defaults to userId) */
  actorId?: string;
  actorName?: string;
  /** Short machine-readable key: "grade_edit", "student_import", "absence_log", etc. */
  action: string;
  /** Arabic description shown in the UI */
  description: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

export function logAudit(payload: AuditPayload): void {
  const ip = payload.req
    ? (
        (payload.req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        payload.req.socket?.remoteAddress ||
        null
      )
    : null;

  db.insert(auditLogsTable)
    .values({
      userId:      payload.userId,
      actorId:     payload.actorId ?? payload.userId,
      actorName:   payload.actorName ?? null,
      action:      payload.action,
      description: payload.description,
      entity:      payload.entity ?? null,
      entityId:    payload.entityId ?? null,
      details:     payload.details ?? null,
      ipAddress:   ip ?? null,
    })
    .catch(() => { /* silent — audit must never break the request */ });
}
