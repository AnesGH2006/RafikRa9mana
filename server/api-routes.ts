import { Router, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, studentsTable, absencesTable, gradesTable } from "../../shared/db.js";

const router = Router();

router.get("/attendance-data", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }

    const data = await db
      .select({
        id: absencesTable.id,
        studentId: absencesTable.studentId,
        studentName: studentsTable.nomPrenom,
        classe: studentsTable.classe,
        annee: absencesTable.annee,
        trimestre: absencesTable.trimestre,
        justifiedHours: absencesTable.justifiedHours,
        unjustifiedHours: absencesTable.unjustifiedHours,
        totalAbsences: absencesTable.unjustifiedHours,
      })
      .from(absencesTable)
      .leftJoin(studentsTable, eq(absencesTable.studentId, studentsTable.id))
      .where(
        and(
          eq(absencesTable.userId, req.user.id),
          eq(absencesTable.annee, "2025-2026")
        )
      )
      .orderBy(absencesTable.createdAt);

    res.json(data);
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ error: "فشل تحميل بيانات الغيابات" });
  }
});

router.get("/grades-data", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }

    const data = await db
      .select({
        id: gradesTable.id,
        studentId: gradesTable.studentId,
        studentName: studentsTable.nomPrenom,
        classe: studentsTable.classe,
        subject: gradesTable.subject,
        score: gradesTable.score,
        annee: gradesTable.annee,
        trimestre: gradesTable.trimestre,
      })
      .from(gradesTable)
      .leftJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id))
      .where(
        and(
          eq(gradesTable.userId, req.user.id),
          eq(gradesTable.annee, "2025-2026")
        )
      )
      .orderBy(gradesTable.createdAt);

    res.json(data);
  } catch (error) {
    console.error("Error fetching grades data:", error);
    res.status(500).json({ error: "فشل تحميل بيانات الدرجات" });
  }
});

router.post("/sync-attendance", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }

    const { synced, failed } = req.body;
    res.json({ success: true, message: `تمت مزامنة ${synced} سجل` });
  } catch (error) {
    res.status(500).json({ error: "فشل تسجيل المزامنة" });
  }
});

router.post("/sync-grades", async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }

    const { synced, failed } = req.body;
    res.json({ success: true, message: `تمت مزامنة ${synced} درجة` });
  } catch (error) {
    res.status(500).json({ error: "فشل تسجيل المزامنة" });
  }
});

export default router;