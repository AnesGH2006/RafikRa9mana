import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, schoolInfoTable } from "../../shared/db.js";
import { UpsertSchoolInfoBody, SchoolInfoSchema } from "../../shared/schemas.js";

const router: IRouter = Router();

router.get("/school", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [info] = await db.select().from(schoolInfoTable).where(eq(schoolInfoTable.userId, req.user!.id));
  if (!info) { res.json(null); return; }
  res.json(SchoolInfoSchema.parse(info));
});

router.put("/school", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = UpsertSchoolInfoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data", details: parsed.error.issues }); return; }

  const userId = req.user!.id;
  const { nom, wilaya, commune, annee } = parsed.data;
  const [existing] = await db.select().from(schoolInfoTable).where(eq(schoolInfoTable.userId, userId));

  if (existing) {
    const [updated] = await db.update(schoolInfoTable)
      .set({ nom, wilaya, commune, annee, updatedAt: new Date() })
      .where(eq(schoolInfoTable.userId, userId))
      .returning();
    res.json(SchoolInfoSchema.parse(updated));
  } else {
    const [created] = await db.insert(schoolInfoTable)
      .values({ id: crypto.randomBytes(16).toString("hex"), userId, nom, wilaya, commune, annee })
      .returning();
    res.json(SchoolInfoSchema.parse(created));
  }
});

export default router;
