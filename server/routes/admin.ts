import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "../../shared/db.js";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function isAdmin(req: Request): boolean {
  return req.isAuthenticated() && req.user?.role === "admin";
}

// GET /api/admin/users — list all users (admin only)
router.get("/admin/users", async (req: Request, res: Response): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    profileImageUrl: u.profileImageUrl,
    role: u.role,
    subscriptionStatus: u.subscriptionStatus,
    subscriptionExpiresAt: u.subscriptionExpiresAt,
    createdAt: u.createdAt,
  })));
});

// PATCH /api/admin/users/:id — update subscription/role (admin only)
router.patch("/admin/users/:id", async (req: Request, res: Response): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { id } = req.params;
  const { subscriptionStatus, role, subscriptionExpiresAt } = req.body as {
    subscriptionStatus?: "pending" | "active" | "suspended";
    role?: "user" | "admin";
    subscriptionExpiresAt?: string | null;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;
  if (role) updates.role = role;
  if (subscriptionExpiresAt !== undefined)
    updates.subscriptionExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ success: true, user: { id: updated.id, email: updated.email, subscriptionStatus: updated.subscriptionStatus, role: updated.role } });
});

// POST /api/admin/activate — activate user by email using secret token (for manual payment approval)
router.post("/admin/activate", async (req: Request, res: Response): Promise<void> => {
  const { email, token, months } = req.body as { email?: string; token?: string; months?: number };
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || token !== adminSecret) { res.status(403).json({ error: "Invalid token" }); return; }
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  const expiresAt = months
    ? new Date(Date.now() + (months || 1) * 30 * 24 * 60 * 60 * 1000)
    : null;

  const [updated] = await db.update(usersTable)
    .set({ subscriptionStatus: "active", subscriptionExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(usersTable.email, email))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ success: true, email: updated.email, subscriptionStatus: updated.subscriptionStatus, subscriptionExpiresAt: updated.subscriptionExpiresAt });
});

export default router;
