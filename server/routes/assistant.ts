import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { db, studentsTable, gradesTable, absencesTable, schoolInfoTable } from "../../shared/db.js";
import { AssistantChatBody, AssistantChatResponse } from "../../shared/schemas.js";

const router: IRouter = Router();

// ── Static role/rules prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت "المساعد الذكي" داخل تطبيق إدارة متوسطة (مدرسة).
لديك إمكانية الاطلاع على البيانات الحقيقية للمؤسسة (التلاميذ، النتائج، الغيابات) المُرفقة أدناه في كتلة "بيانات المؤسسة".

**دورك:**
- تحليل مشاكل التلاميذ (تراجع في النتائج، غياب متكرر، إعادة السنة، صعوبات في مادة، مشاكل سلوكية، توجيه...).
- الإجابة عن الأسئلة الإحصائية حول المؤسسة (عدد الناجحين، أفضل قسم، أكثر التلاميذ غياباً...) استناداً إلى البيانات المُقدَّمة.
- تقديم حلول تربوية وإدارية عملية وواضحة.
- مساعدة المستخدم في فهم واستخدام ميزات الموقع.

**قواعد صارمة:**
- أجب فقط عن الأسئلة المتعلقة بالمؤسسة، التلاميذ، ومشاكلهم وحلولها التربوية، أو الموقع نفسه وميزاته.
- إذا كان السؤال خارج هذا النطاق تماماً (سياسة، رياضة، طبخ، برمجة عامة...) فاعتذر بأدب ووضّح أن دورك مقتصر على شؤون المؤسسة والتلاميذ.
- كن مختصراً وعملياً. قدّم خطوات أو قوائم مرتبة عند الإمكان.
- أجب بنفس اللغة التي كتب بها المستخدم.
- عند الإشارة إلى أسماء تلاميذ من البيانات، ذكر اسمه وقسمه ومعدله.`;

// ── Live school context builder ───────────────────────────────────────────────
async function buildSchoolContext(userId: string): Promise<string> {
  const [schoolRows, allStudents, allGrades, allAbsences] = await Promise.all([
    db.select().from(schoolInfoTable).where(eq(schoolInfoTable.userId, userId)),
    db.select().from(studentsTable).where(eq(studentsTable.userId, userId)),
    db.select().from(gradesTable).where(eq(gradesTable.userId, userId)),
    db.select().from(absencesTable).where(eq(absencesTable.userId, userId)),
  ]);

  if (allStudents.length === 0) {
    return "## بيانات المؤسسة\nلا توجد بيانات تلاميذ مضافة بعد.";
  }

  const school = schoolRows[0];

  // Split grades: trimester averages vs subject grades
  const avgGrades = allGrades.filter(g => g.subject === "__avg__");
  const subjectGrades = allGrades.filter(g => g.subject !== "__avg__");

  // Build per-student trimester averages map
  const triAvgMap = new Map<string, Map<number, number>>();
  for (const g of avgGrades) {
    if (!triAvgMap.has(g.studentId)) triAvgMap.set(g.studentId, new Map());
    triAvgMap.get(g.studentId)!.set(g.trimestre, parseFloat(String(g.score)));
  }

  // Build per-student per-subject per-trimester map
  // subjectMap[studentId][subject][trimestre] = score
  const subjectMap = new Map<string, Map<string, Map<number, number>>>();
  for (const g of subjectGrades) {
    if (!subjectMap.has(g.studentId)) subjectMap.set(g.studentId, new Map());
    const sm = subjectMap.get(g.studentId)!;
    if (!sm.has(g.subject)) sm.set(g.subject, new Map());
    sm.get(g.subject)!.set(g.trimestre, parseFloat(String(g.score)));
  }

  // Build per-student absences (total + per trimester justified/unjustified)
  const absenceMap = new Map<string, { total: number; justified: number; unjustified: number }>();
  for (const a of allAbsences) {
    const cur = absenceMap.get(a.studentId) ?? { total: 0, justified: 0, unjustified: 0 };
    cur.total     += a.justifiedHours + a.unjustifiedHours;
    cur.justified += a.justifiedHours;
    cur.unjustified += a.unjustifiedHours;
    absenceMap.set(a.studentId, cur);
  }

  // Enrich students with computed annual average and trimester breakdown
  const enriched = allStudents.map(s => {
    const tri = triAvgMap.get(s.id);
    const t1 = tri?.get(1) ?? null;
    const t2 = tri?.get(2) ?? null;
    const t3 = tri?.get(3) ?? null;
    const vals = [t1, t2, t3].filter((v): v is number => v != null);
    const annualAvg = vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100
      : null;
    const abs = absenceMap.get(s.id) ?? { total: 0, justified: 0, unjustified: 0 };
    return { ...s, t1, t2, t3, annualAvg, absences: abs, subjects: subjectMap.get(s.id) ?? new Map() };
  });

  // ── Overall stats ──────────────────────────────────────────────────────────
  const total = enriched.length;
  const boys  = enriched.filter(s => s.sexe === "M").length;
  const girls = enriched.filter(s => s.sexe === "F").length;
  const admis      = enriched.filter(s => s.resultat === "admis").length;
  const nonAdmis   = enriched.filter(s => s.resultat === "non_admis").length;
  const mustarrak  = enriched.filter(s => s.resultat === "mustarrak").length;
  const redoublant = enriched.filter(s => s.statut === "redoublant").length;

  // ── Per-level ──────────────────────────────────────────────────────────────
  const LEVELS = ["1AM", "2AM", "3AM", "4AM"] as const;
  const byLevel = LEVELS.map(niv => {
    const g = enriched.filter(s => s.niveau === niv);
    if (g.length === 0) return null;
    const p = g.filter(s => s.resultat === "admis").length;
    const avgs = g.map(s => s.annualAvg).filter((v): v is number => v != null);
    const avg = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10 : null;
    const boys_  = g.filter(s => s.sexe === "M").length;
    const girls_ = g.filter(s => s.sexe === "F").length;
    const redobNiv = g.filter(s => s.statut === "redoublant").length;
    return `  • ${niv}: ${g.length} تلميذ (ذ ${boys_} | إ ${girls_})${redobNiv ? ` | معيدون: ${redobNiv}` : ""} | ناجح ${p}/${g.length} (${Math.round(p / g.length * 100)}%)${avg != null ? ` | متوسط ${avg}/20` : ""}`;
  }).filter(Boolean);

  // ── Per-class ──────────────────────────────────────────────────────────────
  const classeMap = new Map<string, typeof enriched>();
  for (const s of enriched) {
    const key = `${s.niveau} - ${s.classe}`;
    if (!classeMap.has(key)) classeMap.set(key, []);
    classeMap.get(key)!.push(s);
  }
  const sortedClasses = [...classeMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // ── Assemble context string ────────────────────────────────────────────────
  let ctx = `## بيانات المؤسسة (حقيقية — لا تخترعها)\n`;

  if (school) {
    ctx += `**المؤسسة:** ${school.nom || "غير محدد"}`;
    if (school.commune) ctx += ` — ${school.commune}`;
    if (school.wilaya)  ctx += `، ${school.wilaya}`;
    ctx += `\n**السنة الدراسية:** ${school.annee || "غير محدد"}\n`;
    if (school.directeur) ctx += `**المدير:** ${school.directeur}\n`;
    if (school.phone)     ctx += `**الهاتف:** ${school.phone}\n`;
  }

  ctx += `
### إحصاءات عامة
الإجمالي: ${total} تلميذ (ذكور ${boys}، إناث ${girls})
الناجحون: ${admis} (${Math.round(admis / total * 100)}%) | الراسبون: ${nonAdmis} (${Math.round(nonAdmis / total * 100)}%)${mustarrak ? ` | المنتقلون: ${mustarrak}` : ""}
المعيدون: ${redoublant} (${Math.round(redoublant / total * 100)}%)

### حسب المستوى
${byLevel.join("\n") || "  (لا بيانات)"}
`;

  // ── Full per-class detail with student roster ──────────────────────────────
  ctx += `\n### تفصيل كل قسم\n`;

  for (const [classLabel, students] of sortedClasses) {
    const p = students.filter(s => s.resultat === "admis").length;
    const nr = students.filter(s => s.resultat === "non_admis").length;
    const mu = students.filter(s => s.resultat === "mustarrak").length;
    const rate = Math.round(p / students.length * 100);
    const avgs = students.map(s => s.annualAvg).filter((v): v is number => v != null);
    const classAvg = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 100) / 100 : null;
    const boysC  = students.filter(s => s.sexe === "M").length;
    const girlsC = students.filter(s => s.sexe === "F").length;
    const redobC = students.filter(s => s.statut === "redoublant").length;

    ctx += `\n#### قسم ${classLabel}\n`;
    ctx += `العدد: ${students.length} (ذ ${boysC} | إ ${girlsC})${redobC ? ` | معيدون: ${redobC}` : ""}\n`;
    ctx += `النتائج: ناجح ${p} (${rate}%) | راسب ${nr}${mu ? ` | منتقل ${mu}` : ""}${classAvg != null ? ` | متوسط القسم: ${classAvg}/20` : ""}\n`;

    // Per-subject averages for this class
    const subjectTotals = new Map<string, { sum: number; count: number }>();
    for (const s of students) {
      for (const [subj, triMap] of s.subjects.entries()) {
        const scores = [...triMap.values()];
        if (scores.length === 0) continue;
        const subjAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const cur = subjectTotals.get(subj) ?? { sum: 0, count: 0 };
        cur.sum += subjAvg;
        cur.count += 1;
        subjectTotals.set(subj, cur);
      }
    }
    if (subjectTotals.size > 0) {
      const subjLine = [...subjectTotals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subj, { sum, count }]) => `${subj}: ${Math.round(sum / count * 10) / 10}`)
        .join(" | ");
      ctx += `متوسطات المواد: ${subjLine}\n`;
    }

    // Student roster sorted by annual avg desc
    ctx += `قائمة التلاميذ:\n`;
    const sorted = [...students].sort((a, b) => (b.annualAvg ?? -1) - (a.annualAvg ?? -1));
    for (const s of sorted) {
      const triStr = [
        s.t1 != null ? `ف1: ${s.t1}` : null,
        s.t2 != null ? `ف2: ${s.t2}` : null,
        s.t3 != null ? `ف3: ${s.t3}` : null,
      ].filter(Boolean).join(" | ");
      const avgStr = s.annualAvg != null ? ` | معدل سنوي: ${s.annualAvg}/20` : "";
      const resLabel =
        s.resultat === "admis"     ? "ناجح" :
        s.resultat === "non_admis" ? "راسب" :
        s.resultat === "mustarrak" ? "منتقل" : "غير محدد";
      const absStr = s.absences.total > 0
        ? ` | غياب: ${s.absences.total}س (مبرر ${s.absences.justified}س، غير مبرر ${s.absences.unjustified}س)`
        : "";
      const statutStr = s.statut === "redoublant" ? " | معيد" : "";
      const sexeStr = s.sexe === "M" ? "ذ" : "إ";
      ctx += `  - ${s.nomPrenom} [${sexeStr}${statutStr}] — ${triStr}${avgStr} — ${resLabel}${absStr}\n`;
    }
  }

  // ── Most absent students (top 10) ─────────────────────────────────────────
  const mostAbsent = [...enriched]
    .filter(s => s.absences.total > 0)
    .sort((a, b) => b.absences.total - a.absences.total)
    .slice(0, 10);

  if (mostAbsent.length > 0) {
    ctx += `\n### أكثر التلاميذ غياباً\n`;
    ctx += mostAbsent
      .map(s => `  • ${s.nomPrenom} (${s.niveau} - ${s.classe}): ${s.absences.total}س إجمالي (مبرر ${s.absences.justified}س، غير مبرر ${s.absences.unjustified}س)`)
      .join("\n") + "\n";
  }

  // ── Failing students closest to passing ────────────────────────────────────
  const closestToPass = enriched
    .filter(s => s.resultat === "non_admis" && s.annualAvg != null && s.annualAvg >= 7)
    .sort((a, b) => b.annualAvg! - a.annualAvg!)
    .slice(0, 15);

  if (closestToPass.length > 0) {
    ctx += `\n### الراسبون الأقرب للنجاح (معدل ≥ 7)\n`;
    ctx += closestToPass
      .map(s => `  • ${s.nomPrenom} (${s.niveau} - ${s.classe}): معدل ${s.annualAvg}/20 — ناقص ${Math.round((10 - s.annualAvg!) * 10) / 10} نقطة`)
      .join("\n") + "\n";
  }

  return ctx;
}

// ── POST /api/assistant/chat ──────────────────────────────────────────────────
router.post("/assistant/chat", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "طلب غير صالح" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "المساعد الذكي غير مُهيّأ بعد" });
    return;
  }

  try {
    // Fetch live school context and inject alongside system prompt
    const schoolContext = await buildSchoolContext(req.user!.id);

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: schoolContext },
        ...parsed.data.messages.map(m => ({ role: m.role, content: m.content })),
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      || "تعذّر الحصول على رد، حاول مجدداً.";
    res.json(AssistantChatResponse.parse({ reply }));
  } catch (err) {
    console.error("Assistant chat error:", err);
    res.status(502).json({ error: "تعذّر الاتصال بالمساعد الذكي، حاول مجدداً بعد قليل" });
  }
});

export default router;
