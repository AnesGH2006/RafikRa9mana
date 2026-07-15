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
  const [schoolRows, allStudents, avgGrades, allAbsences] = await Promise.all([
    db.select().from(schoolInfoTable).where(eq(schoolInfoTable.userId, userId)),
    db.select().from(studentsTable).where(eq(studentsTable.userId, userId)),
    db.select().from(gradesTable).where(
      and(eq(gradesTable.userId, userId), eq(gradesTable.subject, "__avg__"))
    ),
    db.select().from(absencesTable).where(eq(absencesTable.userId, userId)),
  ]);

  if (allStudents.length === 0) {
    return "## بيانات المؤسسة\nلا توجد بيانات تلاميذ مضافة بعد.";
  }

  const school = schoolRows[0];

  // Build per-student trimester averages map (subject = "__avg__")
  const triAvgMap = new Map<string, Map<number, number>>();
  for (const g of avgGrades) {
    if (!triAvgMap.has(g.studentId)) triAvgMap.set(g.studentId, new Map());
    triAvgMap.get(g.studentId)!.set(g.trimestre, parseFloat(String(g.score)));
  }

  // Build per-student total absence hours
  const absenceMap = new Map<string, number>();
  for (const a of allAbsences) {
    absenceMap.set(a.studentId, (absenceMap.get(a.studentId) ?? 0) + a.justifiedHours + a.unjustifiedHours);
  }

  // Enrich students with computed annual average
  const enriched = allStudents.map(s => {
    const tri = triAvgMap.get(s.id);
    let annualAvg: number | null = null;
    if (tri) {
      const vals = [tri.get(1), tri.get(2), tri.get(3)].filter((v): v is number => v != null);
      if (vals.length > 0) annualAvg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    }
    return { ...s, annualAvg, totalAbsences: absenceMap.get(s.id) ?? 0 };
  });

  // ── Overall stats ──────────────────────────────────────────────────────────
  const total = enriched.length;
  const boys  = enriched.filter(s => s.sexe === "M").length;
  const girls = enriched.filter(s => s.sexe === "F").length;
  const admis   = enriched.filter(s => s.resultat === "admis").length;
  const nonAdmis = enriched.filter(s => s.resultat === "non_admis").length;
  const mustarrak = enriched.filter(s => s.resultat === "mustarrak").length;
  const redoublant = enriched.filter(s => s.statut === "redoublant").length;

  // ── Per-level ──────────────────────────────────────────────────────────────
  const LEVELS = ["1AM", "2AM", "3AM", "4AM"] as const;
  const byLevel = LEVELS.map(niv => {
    const g = enriched.filter(s => s.niveau === niv);
    if (g.length === 0) return null;
    const p = g.filter(s => s.resultat === "admis").length;
    const avgs = g.map(s => s.annualAvg).filter((v): v is number => v != null);
    const avg = avgs.length ? (Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10) : null;
    return `  • ${niv}: ${g.length} تلميذ | ناجح ${p}/${g.length} (${Math.round(p / g.length * 100)}%)${avg != null ? ` | متوسط ${avg}/20` : ""}`;
  }).filter(Boolean);

  // ── Per-class ──────────────────────────────────────────────────────────────
  const classeMap = new Map<string, typeof enriched>();
  for (const s of enriched) {
    const key = `${s.niveau} - ${s.classe}`;
    if (!classeMap.has(key)) classeMap.set(key, []);
    classeMap.get(key)!.push(s);
  }
  const classeStats = [...classeMap.entries()]
    .map(([label, group]) => {
      const p = group.filter(s => s.resultat === "admis").length;
      const rate = Math.round(p / group.length * 100);
      const avgs = group.map(s => s.annualAvg).filter((v): v is number => v != null);
      const avg = avgs.length ? (Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10) : null;
      return { label, total: group.length, passed: p, rate, avg };
    })
    .sort((a, b) => b.rate - a.rate);
  const classLines = classeStats
    .map(c => `  • ${c.label}: ${c.passed}/${c.total} ناجح (${c.rate}%)${c.avg != null ? ` | متوسط ${c.avg}/20` : ""}`)
    .join("\n");

  // ── Most absent students (top 8) ───────────────────────────────────────────
  const mostAbsent = [...enriched]
    .filter(s => s.totalAbsences > 0)
    .sort((a, b) => b.totalAbsences - a.totalAbsences)
    .slice(0, 8);

  // ── Failing students closest to passing (annual avg ≥ 8, top 10) ──────────
  const closestToPass = enriched
    .filter(s => s.resultat === "non_admis" && s.annualAvg != null && s.annualAvg >= 7)
    .sort((a, b) => b.annualAvg! - a.annualAvg!)
    .slice(0, 10);

  // ── Assemble context string ────────────────────────────────────────────────
  let ctx = `## بيانات المؤسسة (حقيقية — لا تخترعها)\n`;

  if (school) {
    ctx += `**المؤسسة:** ${school.nom || "غير محدد"}`;
    if (school.commune) ctx += ` — ${school.commune}`;
    if (school.wilaya)  ctx += `، ${school.wilaya}`;
    ctx += `\n**السنة الدراسية:** ${school.annee || "غير محدد"}\n`;
    if (school.directeur) ctx += `**المدير:** ${school.directeur}\n`;
  }

  ctx += `
### إحصاءات عامة
الإجمالي: ${total} تلميذ (ذكور ${boys}، إناث ${girls})
الناجحون: ${admis} (${Math.round(admis / total * 100)}%) | الراسبون: ${nonAdmis} (${Math.round(nonAdmis / total * 100)}%)${mustarrak ? ` | المنتقلون: ${mustarrak}` : ""}
المعيدون: ${redoublant} (${Math.round(redoublant / total * 100)}%)

### حسب المستوى
${byLevel.join("\n") || "  (لا بيانات)"}

### حسب القسم (مرتبة من الأعلى نسبة نجاح)
${classLines || "  (لا بيانات)"}
`;

  if (mostAbsent.length > 0) {
    ctx += `\n### أكثر التلاميذ غياباً\n`;
    ctx += mostAbsent
      .map(s => `  • ${s.nomPrenom} (${s.niveau} - ${s.classe}): ${s.totalAbsences} ساعة`)
      .join("\n") + "\n";
  }

  if (closestToPass.length > 0) {
    ctx += `\n### الراسبون الأقرب للنجاح\n`;
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
