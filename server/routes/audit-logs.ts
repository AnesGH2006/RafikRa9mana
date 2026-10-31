/**
 * GET /api/audit-logs
 * Returns the audit log for the authenticated head-admin.
 * Only accessible to head-admins (not members).
 */
import { Router, type Request, type Response } from "express";
import { eq, desc, and, gte } from "drizzle-orm";
import { db, auditLogsTable } from "../../shared/db.js";

const router = Router();

router.get("/audit-logs", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  // Members cannot access audit logs — head-admin only
  if (req.memberContext) { res.status(403).json({ error: "Forbidden" }); return; }

  const userId = req.user!.id;
  const limit  = Math.min(parseInt(String(req.query.limit  ?? "200"), 10), 500);
  const since  = req.query.since ? new Date(String(req.query.since)) : null;

  const conds = [eq(auditLogsTable.userId, userId)];
  if (since && !isNaN(since.getTime())) {
    conds.push(gte(auditLogsTable.createdAt, since));
  }

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(and(...conds))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit);

  res.json(rows);
});

export default router;
