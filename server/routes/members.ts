/**
 * School Members (RBAC)
 *
 * HEAD-ADMIN routes — all require an authenticated head-admin session.
 *
 * GET    /api/members           — list all teachers & parents for this school
 * POST   /api/members           — create a teacher or parent record
 * PATCH  /api/members/:id       — update name, email, assignedClasses, linkedStudentId
 * DELETE /api/members/:id       — remove a member
 */
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, schoolMembersTable, studentsTable, gradesTable, absencesTable } from "../../shared/db.js";

const router = Router();

/** Only a head-admin (subscribed, non-member user) may manage members. */
function isHeadAdmin(req: Request): boolean {
  return req.isAuthenticated() && !req.memberContext;
}

// ── GET /api/members ─────────────────────────────────────────────────────────
router.get("/members", async (req: Request, res: Response): Promise<void> => {
  if (!isHeadAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const userId = req.user!.id;

  const rows = await db
    .select()
    .from(schoolMembersTable)
    .where(eq(schoolMembersTable.schoolUserId, userId))
    .orderBy(schoolMembersTable.createdAt);

  res.json(rows);
});

// ── POST /api/members ─────────────────────────────────────────────────────────
router.post("/members", async (req: Request, res: Response): Promise<void> => {
  if (!isHeadAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const schoolUserId = req.user!.id;

  const { role, name, email, phone, assignedClasses, linkedStudentId } = req.body as {
    role: "teacher" | "parent";
    name: string;
    email?: string;
    phone?: string;
    assignedClasses?: string[];
    linkedStudentId?: string | null;
  };

  if (!role || !["teacher", "parent"].includes(role)) {
    res.status(400).json({ error: "role must be 'teacher' or 'parent'" });
    return;
  }
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (role === "parent" && linkedStudentId) {
    // Verify student belongs to this school
    const [student] = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(and(eq(studentsTable.id, linkedStudentId), eq(studentsTable.userId, schoolUserId)))
      .limit(1);
    if (!student) {
      res.status(400).json({ error: "التلميذ غير موجود" });
      return;
    }
  }

  const [created] = await db
    .insert(schoolMembersTable)
    .values({
      schoolUserId,
      role,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      assignedClasses: assignedClasses ?? [],
      linkedStudentId: role === "parent" ? (linkedStudentId ?? null) : null,
    })
    .returning();

  res.status(201).json(created);
});

// ── PATCH /api/members/:id ────────────────────────────────────────────────────
router.patch("/members/:id", async (req: Request, res: Response): Promise<void> => {
  if (!isHeadAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const schoolUserId = req.user!.id;
  const { id } = req.params as { id: string };

  const { name, email, phone, assignedClasses, linkedStudentId } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    assignedClasses?: string[];
    linkedStudentId?: string | null;
  };

  const updates: Partial<typeof schoolMembersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email?.trim() || null;
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (assignedClasses !== undefined) updates.assignedClasses = assignedClasses;
  if (linkedStudentId !== undefined) updates.linkedStudentId = linkedStudentId;

  const [updated] = await db
    .update(schoolMembersTable)
    .set(updates)
    .where(and(eq(schoolMembersTable.id, id), eq(schoolMembersTable.schoolUserId, schoolUserId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Member not found" }); return; }
  res.json(updated);
});

// ── DELETE /api/members/:id ───────────────────────────────────────────────────
router.delete("/members/:id", async (req: Request, res: Response): Promise<void> => {
  if (!isHeadAdmin(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const schoolUserId = req.user!.id;
  const { id } = req.params as { id: string };

  const [deleted] = await db
    .delete(schoolMembersTable)
    .where(and(eq(schoolMembersTable.id, id), eq(schoolMembersTable.schoolUserId, schoolUserId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ success: true });
});

// ── GET /api/my-member-context ────────────────────────────────────────────────
router.get("/my-member-context", (req: Request, res: Response): void => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ memberContext: req.memberContext ?? null });
});

// ── GET /api/my-child ─────────────────────────────────────────────────────────
// Parent: returns their linked student profile + grades + absences for the given year.
router.get("/my-child", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.memberContext?.role !== "parent") { res.status(403).json({ error: "Parents only" }); return; }

  const { linkedStudentId, schoolUserId } = req.memberContext;
  if (!linkedStudentId) { res.json({ student: null }); return; }

  const annee = String(req.query.annee ?? "2025-2026");

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(and(eq(studentsTable.id, linkedStudentId), eq(studentsTable.userId, schoolUserId)))
    .limit(1);

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  // Grades for the current year
  const grades = await db
    .select()
    .from(gradesTable)
    .where(and(eq(gradesTable.studentId, linkedStudentId), eq(gradesTable.annee, annee)));

  // Absences for the current year
  const absences = await db
    .select()
    .from(absencesTable)
    .where(and(eq(absencesTable.studentId, linkedStudentId), eq(absencesTable.annee, annee)));

  res.json({
    student,
    grades: grades.map(g => ({ ...g, score: parseFloat(String(g.score)) })),
    absences,
  });
});

// ── GET /api/teacher/students ─────────────────────────────────────────────────
// Teacher: list students in their assigned classes.
router.get("/teacher/students", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.memberContext?.role !== "teacher") { res.status(403).json({ error: "Teachers only" }); return; }

  const { assignedClasses, schoolUserId } = req.memberContext;
  const annee = String(req.query.annee ?? "2025-2026");

  if (!assignedClasses.length) { res.json([]); return; }

  const { inArray } = await import("drizzle-orm");
  const students = await db
    .select()
    .from(studentsTable)
    .where(
      and(
        eq(studentsTable.userId, schoolUserId),
        eq(studentsTable.annee, annee),
        inArray(studentsTable.classe, assignedClasses),
      ),
    )
    .orderBy(studentsTable.classe, studentsTable.nomPrenom);

  res.json(students);
});

// ── POST /api/teacher/grades ──────────────────────────────────────────────────
// Teacher: submit grades for a student in an assigned class.
router.post("/teacher/grades", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.memberContext?.role !== "teacher") { res.status(403).json({ error: "Teachers only" }); return; }

  const { assignedClasses, schoolUserId } = req.memberContext;
  const { studentId, annee, trimestre, grades: gradeMap } = req.body as {
    studentId: string;
    annee: string;
    trimestre: number;
    grades: Record<string, number>;
  };

  if (!studentId || !annee || !trimestre || !gradeMap) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Verify student belongs to this school AND is in an assigned class
  const [student] = await db
    .select({ id: studentsTable.id, classe: studentsTable.classe })
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.userId, schoolUserId)))
    .limit(1);

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  if (!assignedClasses.includes(student.classe)) {
    res.status(403).json({ error: "ليس لديك صلاحية إدخال درجات هذا القسم" });
    return;
  }

  const crypto = await import("crypto");
  const upserts = Object.entries(gradeMap).map(([subject, score]) => ({
    id: crypto.randomUUID(),
    userId: schoolUserId,
    studentId,
    annee,
    trimestre,
    subject,
    score: String(Math.min(Math.max(Number(score), 0), 20)),
  }));

  if (upserts.length > 0) {
    const { gradesTable: gt } = await import("../../shared/db.js");
    const { sql: drizzleSql } = await import("drizzle-orm");
    for (const row of upserts) {
      await db.insert(gradesTable)
        .values(row as any)
        .onConflictDoUpdate({
          target: [gradesTable.studentId, gradesTable.annee, gradesTable.trimestre, gradesTable.subject],
          set: { score: drizzleSql`excluded.score` },
        }).catch(() => {
          // If no unique constraint, just insert
          return db.insert(gradesTable).values(row as any).onConflictDoNothing();
        });
    }
  }

  res.json({ success: true, count: upserts.length });
});

export default router;
