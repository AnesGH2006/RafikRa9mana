import crypto from "crypto";
import { Router, type IRouter } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, dailyAbsenceReportsTable, studentDailyAttendanceTable, studentsTable } from "../../shared/db.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

router.get("/absences/daily-students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const date = req.query.date;
  if (date !== undefined && !isIsoDate(date)) { res.status(400).json({ error: "Invalid date" }); return; }

  const conditions = [eq(studentDailyAttendanceTable.userId, userId)];
  if (typeof date === "string") conditions.push(eq(studentDailyAttendanceTable.attendanceDate, date));
  const rows = await db.select({
    id: studentDailyAttendanceTable.id,
    studentId: studentDailyAttendanceTable.studentId,
    studentName: studentsTable.nomPrenom,
    niveau: studentsTable.niveau,
    classe: studentsTable.classe,
    attendanceDate: studentDailyAttendanceTable.attendanceDate,
    status: studentDailyAttendanceTable.status,
    isAbsent: studentDailyAttendanceTable.isAbsent,
  })
    .from(studentDailyAttendanceTable)
    .innerJoin(studentsTable, eq(studentDailyAttendanceTable.studentId, studentsTable.id))
    .where(and(...conditions))
    .orderBy(desc(studentDailyAttendanceTable.attendanceDate), studentsTable.niveau, studentsTable.classe, studentsTable.nomPrenom)
    .limit(1000);
  res.json(rows);
});

router.post("/absences/daily-students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { attendanceDate, entries } = req.body ?? {};
  if (!isIsoDate(attendanceDate) || !Array.isArray(entries) || entries.length === 0 || entries.length > 1000) {
    res.status(400).json({ error: "Invalid attendance report" });
    return;
  }

  const normalized = new Map<string, { status: string; isAbsent: boolean }>();
  for (const entry of entries) {
    if (!entry || typeof entry.studentId !== "string" ||
        typeof entry.status !== "string" || entry.status.trim().length === 0 || entry.status.length > 100 ||
        typeof entry.isAbsent !== "boolean") {
      res.status(400).json({ error: "Each row needs a student, status, and reviewed attendance value" });
      return;
    }
    normalized.set(entry.studentId, { status: entry.status.trim(), isAbsent: entry.isAbsent });
  }

  const userId = req.user!.id;
  const studentIds = [...normalized.keys()];
  const ownedStudents = await db.select({ id: studentsTable.id }).from(studentsTable)
    .where(and(eq(studentsTable.userId, userId), inArray(studentsTable.id, studentIds)));
  if (ownedStudents.length !== studentIds.length) {
    res.status(400).json({ error: "One or more students do not belong to this account" });
    return;
  }

  const rows = studentIds.map(studentId => ({
    id: crypto.randomBytes(16).toString("hex"),
    userId,
    studentId,
    attendanceDate,
    ...normalized.get(studentId)!,
  }));
  const saved = await db.insert(studentDailyAttendanceTable).values(rows).onConflictDoUpdate({
    target: [studentDailyAttendanceTable.userId, studentDailyAttendanceTable.studentId, studentDailyAttendanceTable.attendanceDate],
    set: {
      status: studentDailyAttendanceTable.status,
      isAbsent: studentDailyAttendanceTable.isAbsent,
    },
  }).returning({ id: studentDailyAttendanceTable.id, studentId: studentDailyAttendanceTable.studentId });
  res.json({ success: true, saved: saved.length });
});

router.delete("/absences/daily-students/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [deleted] = await db.delete(studentDailyAttendanceTable).where(and(
    eq(studentDailyAttendanceTable.id, req.params.id!),
    eq(studentDailyAttendanceTable.userId, req.user!.id),
  )).returning({ id: studentDailyAttendanceTable.id });
  if (!deleted) { res.status(404).json({ error: "Attendance record not found" }); return; }
  res.json({ success: true });
});

// ── Parse the Algerian Ministry daily absence form ────────────────────────────
function parseDailyAbsenceForm(buffer: Buffer, originalName: string) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error("الملف لا يحتوي على ورقة بيانات");

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find the header rows — look for a row containing "التلاميذ"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.some(c => String(c).includes("التلاميذ"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("لم يتم التعرف على تنسيق الملف — تأكد من رفع ملف متابعة الغياب الرسمي");

  // Sub-header row is headerIdx+1, data row is headerIdx+2
  const dataRow = rows[headerIdx + 2] ?? [];

  const toNum = (v: any) => {
    const n = parseFloat(String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(",", "."));
    return isNaN(n) ? 0 : Math.round(n);
  };

  // Layout: [students_total, students_absent, students_pct, teachers_total, teachers_absent, teachers_pct,
  //          admin_total, admin_absent, admin_pct, workers_total, workers_absent, workers_pct, cafeteria]
  const studentsTotal  = toNum(dataRow[0]);
  const studentsAbsent = toNum(dataRow[1]);
  const teachersTotal  = toNum(dataRow[3]);
  const teachersAbsent = toNum(dataRow[4]);
  const adminTotal     = toNum(dataRow[6]);
  const adminAbsent    = toNum(dataRow[7]);
  const workersTotal   = toNum(dataRow[9]);
  const workersAbsent  = toNum(dataRow[10]);
  const cafeteriaRaw   = String(dataRow[12] ?? "").trim().toLowerCase();
  const cafeteriaSuspended = cafeteriaRaw === "نعم" || cafeteriaRaw === "yes" || cafeteriaRaw === "oui" ? true
    : cafeteriaRaw === "لا" || cafeteriaRaw === "no" || cafeteriaRaw === "non" ? false
    : null;

  // Try to extract date from row 6 "ليوم: ..."
  let reportDate = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    for (const cell of row) {
      const s = String(cell);
      if (s.includes("ليوم")) {
        // Extract date after colon
        const after = s.replace("ليوم", "").replace(":", "").trim();
        if (after && !after.startsWith(".")) {
          reportDate = after.slice(0, 20);
        }
        break;
      }
    }
  }

  return { studentsTotal, studentsAbsent, teachersTotal, teachersAbsent, adminTotal, adminAbsent, workersTotal, workersAbsent, cafeteriaSuspended, reportDate };
}

// ── POST /api/absences/daily-upload ──────────────────────────────────────────
router.post("/absences/daily-upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "لم يتم إرفاق ملف" }); return; }

  const userId = req.user!.id;

  try {
    const parsed = parseDailyAbsenceForm(req.file.buffer, req.file.originalname);

    const id = crypto.randomBytes(16).toString("hex");
    await db.insert(dailyAbsenceReportsTable).values({
      id,
      userId,
      fileName: req.file.originalname,
      ...parsed,
    });

    res.json({ success: true, id, ...parsed });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "خطأ في تحليل الملف" });
  }
});

// ── GET /api/absences/daily ───────────────────────────────────────────────────
router.get("/absences/daily", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(dailyAbsenceReportsTable)
    .where(eq(dailyAbsenceReportsTable.userId, userId))
    .orderBy(desc(dailyAbsenceReportsTable.reportDate));
  res.json(rows);
});

// ── DELETE /api/absences/daily/:id ────────────────────────────────────────────
router.delete("/absences/daily/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  await db.delete(dailyAbsenceReportsTable).where(
    and(eq(dailyAbsenceReportsTable.id, req.params.id!), eq(dailyAbsenceReportsTable.userId, userId))
  );
  res.json({ success: true });
});

export default router;
