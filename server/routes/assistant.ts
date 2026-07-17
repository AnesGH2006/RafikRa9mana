import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { db, studentsTable, gradesTable, absencesTable, schoolInfoTable } from "../../shared/db.js";
import { AssistantChatBody, AssistantChatResponse } from "../../shared/schemas.js";

const router: IRouter = Router();

// ── Static role/rules prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `أنت "المساعد الذكي" داخل تطبيق إدارة متوسطة جزائرية.
لديك صلاحية الاطلاع الكاملة على جميع بيانات المؤسسة الحقيقية المُرفقة أدناه:
التلاميذ — النتائج الفصلية — المعدلات السنوية — درجات كل مادة — الغيابات — الإحصاءات الشاملة.

**دورك:**
- تحليل نتائج التلاميذ تحليلاً دقيقاً (تراجع، رسوب، مواد ضعيفة، غياب مفرط، إعادة السنة).
- الإجابة عن أي سؤال إحصائي حول المؤسسة (عدد الناجحين، أفضل/أسوأ قسم، أكثر الغائبين، المعيدون المحتملون بالسن، نسب النجاح حسب الجنس...).
- مقارنة الأقسام والمستويات وتحليل الفوارق.
- تحديد التلاميذ في خطر (معدل متدنٍّ + غياب + معيد محتمل).
- تقديم توصيات تربوية وإدارية عملية ومحددة.
- الإجابة عن أسئلة تتعلق بميزات الموقع وكيفية استخدامه.

**قواعد:**
- استند حصراً إلى البيانات المُقدَّمة، لا تخترع أرقاماً.
- أجب بنفس لغة المستخدم (عربية / فرنسية / إنجليزية).
- كن مختصراً وعملياً؛ قدّم قوائم وجداول نصية عند الإمكان.
- عند ذكر تلميذ: اسمه + قسمه + معدله + ملاحظة إن وُجدت.`;

// ── Age helpers ───────────────────────────────────────────────────────────────
const MAX_NORMAL_AGE: Record<string, number> = {
  "1AM": 11, "2AM": 12, "3AM": 13, "4AM": 15,
};

function calcAge(dateNaissance: string | null, annee: string): number | null {
  if (!dateNaissance) return null;
  const birth = new Date(dateNaissance);
  if (isNaN(birth.getTime())) return null;
  const startYear = parseInt(annee.split("-")[0]);
  if (isNaN(startYear)) return null;
  const sep1 = new Date(startYear, 8, 1); // 1 September
  return Math.floor((sep1.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function isAgeRepeater(dateNaissance: string | null, niveau: string, annee: string): boolean {
  const age = calcAge(dateNaissance, annee);
  if (age === null) return false;
  return age > (MAX_NORMAL_AGE[niveau] ?? 99);
}

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
  const schoolAnnee: string = school?.annee || "";

  // ── Grade maps ────────────────────────────────────────────────────────────
  const avgGrades     = allGrades.filter(g => g.subject === "__avg__");
  const subjectGrades = allGrades.filter(g => g.subject !== "__avg__");

  // triAvgMap[studentId][trimestre] = avg
  const triAvgMap = new Map<string, Map<number, number>>();
  for (const g of avgGrades) {
    if (!triAvgMap.has(g.studentId)) triAvgMap.set(g.studentId, new Map());
    triAvgMap.get(g.studentId)!.set(g.trimestre, parseFloat(String(g.score)));
  }

  // subjectMap[studentId][subject][trimestre] = score
  const subjectMap = new Map<string, Map<string, Map<number, number>>>();
  for (const g of subjectGrades) {
    if (!subjectMap.has(g.studentId)) subjectMap.set(g.studentId, new Map());
    const sm = subjectMap.get(g.studentId)!;
    if (!sm.has(g.subject)) sm.set(g.subject, new Map());
    sm.get(g.subject)!.set(g.trimestre, parseFloat(String(g.score)));
  }

  // absenceMap[studentId] = totals
  const absenceMap = new Map<string, { total: number; justified: number; unjustified: number }>();
  for (const a of allAbsences) {
    const cur = absenceMap.get(a.studentId) ?? { total: 0, justified: 0, unjustified: 0 };
    cur.total       += a.justifiedHours + a.unjustifiedHours;
    cur.justified   += a.justifiedHours;
    cur.unjustified += a.unjustifiedHours;
    absenceMap.set(a.studentId, cur);
  }

  // ── Enrich students ───────────────────────────────────────────────────────
  const enriched = allStudents.map(s => {
    const tri       = triAvgMap.get(s.id);
    const t1        = tri?.get(1) ?? null;
    const t2        = tri?.get(2) ?? null;
    const t3        = tri?.get(3) ?? null;
    const vals      = [t1, t2, t3].filter((v): v is number => v != null);
    const annualAvg = vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100
      : null;
    const abs       = absenceMap.get(s.id) ?? { total: 0, justified: 0, unjustified: 0 };
    const subjects  = subjectMap.get(s.id) ?? new Map<string, Map<number, number>>();
    const age       = calcAge(s.dateNaissance, schoolAnnee);
    const ageRepeat = isAgeRepeater(s.dateNaissance, s.niveau, schoolAnnee);

    // Per-subject annual average for this student
    const subjectAvgs = new Map<string, number>();
    for (const [subj, triMap] of subjects.entries()) {
      const scores = [...triMap.values()];
      if (scores.length > 0) {
        subjectAvgs.set(subj, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100);
      }
    }

    return { ...s, t1, t2, t3, annualAvg, absences: abs, subjects, subjectAvgs, age, ageRepeat };
  });

  // ── Overall stats ──────────────────────────────────────────────────────────
  const total      = enriched.length;
  const boys       = enriched.filter(s => s.sexe === "M").length;
  const girls      = enriched.filter(s => s.sexe === "F").length;
  const admis      = enriched.filter(s => s.resultat === "admis").length;
  const nonAdmis   = enriched.filter(s => s.resultat === "non_admis").length;
  const mustarrak  = enriched.filter(s => s.resultat === "mustarrak").length;
  const redoublant = enriched.filter(s => s.statut === "redoublant").length;
  const ageRepeaters = enriched.filter(s => s.ageRepeat && s.statut !== "redoublant").length;

  // Boys/girls pass rates
  const boysPassed  = enriched.filter(s => s.sexe === "M" && s.resultat === "admis").length;
  const girlsPassed = enriched.filter(s => s.sexe === "F" && s.resultat === "admis").length;

  // ── Per-level stats ───────────────────────────────────────────────────────
  const LEVELS = ["1AM", "2AM", "3AM", "4AM"] as const;
  const byLevel = LEVELS.map(niv => {
    const g = enriched.filter(s => s.niveau === niv);
    if (g.length === 0) return null;
    const p      = g.filter(s => s.resultat === "admis").length;
    const nr     = g.filter(s => s.resultat === "non_admis").length;
    const avgs   = g.map(s => s.annualAvg).filter((v): v is number => v != null);
    const avg    = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10 : null;
    const boys_  = g.filter(s => s.sexe === "M").length;
    const girls_ = g.filter(s => s.sexe === "F").length;
    const bpassed = g.filter(s => s.sexe === "M" && s.resultat === "admis").length;
    const gpassed = g.filter(s => s.sexe === "F" && s.resultat === "admis").length;
    const redob   = g.filter(s => s.statut === "redoublant").length;
    const ageRed  = g.filter(s => s.ageRepeat && s.statut !== "redoublant").length;
    const topS    = [...g].filter(s => s.annualAvg != null).sort((a, b) => b.annualAvg! - a.annualAvg!)[0];
    const botS    = [...g].filter(s => s.annualAvg != null).sort((a, b) => a.annualAvg! - b.annualAvg!)[0];

    let line = `  • ${niv}: ${g.length} تلميذ (ذ ${boys_}/${bpassed}ناجح | إ ${girls_}/${gpassed}ناجحة)`;
    line += ` | ناجح ${p}/${g.length} (${Math.round(p / g.length * 100)}%) | راسب ${nr}`;
    if (avg != null) line += ` | متوسط المستوى: ${avg}/20`;
    if (redob) line += ` | معيدون مؤكدون: ${redob}`;
    if (ageRed) line += ` | محتملون بالسن: ${ageRed}`;
    if (topS) line += `\n    أعلى معدل: ${topS.nomPrenom} (${topS.annualAvg}/20)`;
    if (botS && botS.id !== topS?.id) line += ` | أدنى معدل: ${botS.nomPrenom} (${botS.annualAvg}/20)`;
    return line;
  }).filter(Boolean);

  // ── School-level subject analysis ─────────────────────────────────────────
  const schoolSubjectTotals = new Map<string, { sum: number; count: number; below10: number }>();
  for (const s of enriched) {
    for (const [subj, avg] of s.subjectAvgs.entries()) {
      const cur = schoolSubjectTotals.get(subj) ?? { sum: 0, count: 0, below10: 0 };
      cur.sum += avg;
      cur.count += 1;
      if (avg < 10) cur.below10 += 1;
      schoolSubjectTotals.set(subj, cur);
    }
  }
  const schoolSubjectLines = [...schoolSubjectTotals.entries()]
    .sort(([, a], [, b]) => (a.sum / a.count) - (b.sum / b.count))
    .map(([subj, { sum, count, below10 }]) =>
      `  • ${subj}: متوسط ${Math.round(sum / count * 10) / 10}/20 | راسبون في المادة: ${below10}/${count}`
    );

  // ── Per-class ─────────────────────────────────────────────────────────────
  const classeMap = new Map<string, typeof enriched>();
  for (const s of enriched) {
    const key = `${s.niveau} - ${s.classe}`;
    if (!classeMap.has(key)) classeMap.set(key, []);
    classeMap.get(key)!.push(s);
  }
  const sortedClasses = [...classeMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // ── Assemble context ──────────────────────────────────────────────────────
  let ctx = `## بيانات المؤسسة الكاملة (حقيقية — لا تخترع أرقاماً)\n`;

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
الإجمالي: ${total} تلميذ — ذكور: ${boys} (ناجح ${boysPassed}) | إناث: ${girls} (ناجحة ${girlsPassed})
الناجحون: ${admis} (${total > 0 ? Math.round(admis / total * 100) : 0}%) | الراسبون: ${nonAdmis} (${total > 0 ? Math.round(nonAdmis / total * 100) : 0}%)${mustarrak ? ` | المنتقلون بقرار: ${mustarrak}` : ""}
المعيدون المؤكدون: ${redoublant} | المعيدون المحتملون بالسن: ${ageRepeaters}
نسبة نجاح الذكور: ${boys > 0 ? Math.round(boysPassed / boys * 100) : 0}% | نسبة نجاح الإناث: ${girls > 0 ? Math.round(girlsPassed / girls * 100) : 0}%

### حسب المستوى
${byLevel.join("\n") || "  (لا بيانات)"}
`;

  if (schoolSubjectLines.length > 0) {
    ctx += `\n### متوسطات المواد على مستوى المؤسسة (مرتبة من الأضعف)\n${schoolSubjectLines.join("\n")}\n`;
  }

  // ── Full per-class detail ─────────────────────────────────────────────────
  ctx += `\n### تفصيل كل قسم\n`;

  for (const [classLabel, students] of sortedClasses) {
    const p       = students.filter(s => s.resultat === "admis").length;
    const nr      = students.filter(s => s.resultat === "non_admis").length;
    const mu      = students.filter(s => s.resultat === "mustarrak").length;
    const rate    = Math.round(p / students.length * 100);
    const avgs    = students.map(s => s.annualAvg).filter((v): v is number => v != null);
    const classAvg= avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 100) / 100 : null;
    const boysC   = students.filter(s => s.sexe === "M").length;
    const girlsC  = students.filter(s => s.sexe === "F").length;
    const bpassC  = students.filter(s => s.sexe === "M" && s.resultat === "admis").length;
    const gpassC  = students.filter(s => s.sexe === "F" && s.resultat === "admis").length;
    const redobC  = students.filter(s => s.statut === "redoublant").length;
    const ageRedC = students.filter(s => s.ageRepeat && s.statut !== "redoublant").length;
    const sorted  = [...students].sort((a, b) => (b.annualAvg ?? -1) - (a.annualAvg ?? -1));

    // Per-subject class averages + weakness flags
    const classSubjTotals = new Map<string, { sum: number; count: number; below10: number }>();
    for (const s of students) {
      for (const [subj, avg] of s.subjectAvgs.entries()) {
        const cur = classSubjTotals.get(subj) ?? { sum: 0, count: 0, below10: 0 };
        cur.sum += avg; cur.count += 1;
        if (avg < 10) cur.below10 += 1;
        classSubjTotals.set(subj, cur);
      }
    }

    ctx += `\n#### قسم ${classLabel}\n`;
    ctx += `العدد: ${students.length} | ذ ${boysC} (${bpassC}ناجح) | إ ${girlsC} (${gpassC}ناجحة)\n`;
    ctx += `النتائج: ناجح ${p}/${students.length} (${rate}%) | راسب ${nr}${mu ? ` | منتقل ${mu}` : ""}${classAvg != null ? ` | متوسط القسم: ${classAvg}/20` : ""}\n`;
    if (redobC) ctx += `المعيدون المؤكدون: ${redobC} | المحتملون بالسن: ${ageRedC}\n`;
    else if (ageRedC) ctx += `المحتملون بالسن: ${ageRedC}\n`;

    // Subject averages for class
    if (classSubjTotals.size > 0) {
      const subjLine = [...classSubjTotals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subj, { sum, count, below10 }]) =>
          `${subj}: ${Math.round(sum / count * 10) / 10}${below10 > 0 ? ` (${below10}راسب)` : ""}`
        ).join(" | ");
      ctx += `متوسطات المواد: ${subjLine}\n`;
    }

    // Student roster with full detail
    ctx += `قائمة التلاميذ (مرتبة بالمعدل):\n`;
    sorted.forEach((s, rank) => {
      const sexeStr   = s.sexe === "M" ? "ذ" : "إ";
      const triStr    = [
        s.t1 != null ? `ف1:${s.t1}` : null,
        s.t2 != null ? `ف2:${s.t2}` : null,
        s.t3 != null ? `ف3:${s.t3}` : null,
      ].filter(Boolean).join("|");
      const resLabel  =
        s.resultat === "admis"     ? "ناجح" :
        s.resultat === "non_admis" ? "راسب" :
        s.resultat === "mustarrak" ? "منتقل" : "—";
      const absStr    = s.absences.total > 0
        ? ` | غياب:${s.absences.total}س(م${s.absences.justified}+غم${s.absences.unjustified})`
        : "";
      const statutStr = s.statut === "redoublant" ? " [معيد]" : s.ageRepeat ? " [محتمل-سن]" : "";
      const ageStr    = s.age != null ? ` عمر:${s.age}` : "";

      // Subject scores for this student
      let subjStr = "";
      if (s.subjectAvgs.size > 0) {
        const weak = [...s.subjectAvgs.entries()]
          .filter(([, avg]) => avg < 10)
          .sort(([, a], [, b]) => a - b)
          .map(([subj, avg]) => `${subj}:${avg}`)
          .join(",");
        const strong = [...s.subjectAvgs.entries()]
          .filter(([, avg]) => avg >= 10)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([subj, avg]) => `${subj}:${avg}`)
          .join(",");
        if (weak)   subjStr += ` | ضعف:[${weak}]`;
        if (strong) subjStr += ` | قوة:[${strong}]`;
      }

      ctx += `  ${rank + 1}. ${s.nomPrenom} [${sexeStr}${statutStr}${ageStr}] — ${triStr ? triStr + " | " : ""}معدل:${s.annualAvg ?? "—"}/20 — ${resLabel}${absStr}${subjStr}\n`;
    });
  }

  // ── Cross-cutting analytics ───────────────────────────────────────────────

  // Most absent (top 15)
  const mostAbsent = [...enriched]
    .filter(s => s.absences.total > 0)
    .sort((a, b) => b.absences.total - a.absences.total)
    .slice(0, 15);
  if (mostAbsent.length > 0) {
    ctx += `\n### أكثر التلاميذ غياباً (أعلى 15)\n`;
    ctx += mostAbsent
      .map(s => `  • ${s.nomPrenom} (${s.niveau}-${s.classe}): ${s.absences.total}س — مبرر:${s.absences.justified}س غير مبرر:${s.absences.unjustified}س — ${s.resultat === "non_admis" ? "راسب" : s.resultat === "admis" ? "ناجح" : "منتقل"}`)
      .join("\n") + "\n";
  }

  // Students in double danger: failing + high absences
  const highAbsThreshold = 30;
  const doubleDanger = enriched
    .filter(s => s.resultat === "non_admis" && s.absences.total >= highAbsThreshold)
    .sort((a, b) => b.absences.total - a.absences.total);
  if (doubleDanger.length > 0) {
    ctx += `\n### تلاميذ في خطر مزدوج (راسب + غياب ≥ ${highAbsThreshold}س)\n`;
    ctx += doubleDanger
      .map(s => `  • ${s.nomPrenom} (${s.niveau}-${s.classe}): معدل ${s.annualAvg ?? "—"}/20 | غياب ${s.absences.total}س`)
      .join("\n") + "\n";
  }

  // Failing students closest to passing
  const closestToPass = enriched
    .filter(s => s.resultat === "non_admis" && s.annualAvg != null && s.annualAvg >= 7)
    .sort((a, b) => b.annualAvg! - a.annualAvg!)
    .slice(0, 20);
  if (closestToPass.length > 0) {
    ctx += `\n### الراسبون الأقرب للنجاح (معدل ≥ 7/20) — أولى بالدعم\n`;
    ctx += closestToPass
      .map(s => `  • ${s.nomPrenom} (${s.niveau}-${s.classe}): ${s.annualAvg}/20 — ينقصه ${Math.round((10 - s.annualAvg!) * 10) / 10} نقطة`)
      .join("\n") + "\n";
  }

  // Age-detected probable repeaters (not already marked redoublant)
  const ageProbable = enriched.filter(s => s.ageRepeat && s.statut !== "redoublant");
  if (ageProbable.length > 0) {
    ctx += `\n### معيدون محتملون بالسن (تجاوزوا السن الطبيعي لمستواهم)\n`;
    ctx += `حد السن الطبيعي: 1AM≤11 | 2AM≤12 | 3AM≤13 | 4AM≤15 (عند مطلع السنة الدراسية)\n`;
    ctx += ageProbable
      .map(s => `  • ${s.nomPrenom} (${s.niveau}-${s.classe}): عمر ${s.age} سنة | معدل ${s.annualAvg ?? "—"}/20 | ${s.resultat === "non_admis" ? "راسب" : s.resultat === "admis" ? "ناجح" : "منتقل"}`)
      .join("\n") + "\n";
  }

  // Top 5 students school-wide
  const top5 = [...enriched]
    .filter(s => s.annualAvg != null)
    .sort((a, b) => b.annualAvg! - a.annualAvg!)
    .slice(0, 5);
  if (top5.length > 0) {
    ctx += `\n### أفضل 5 تلاميذ في المؤسسة\n`;
    ctx += top5.map((s, i) =>
      `  ${i + 1}. ${s.nomPrenom} (${s.niveau}-${s.classe}): ${s.annualAvg}/20`
    ).join("\n") + "\n";
  }

  // Class ranking by success rate
  const classRanking = sortedClasses
    .map(([label, students]) => {
      const p = students.filter(s => s.resultat === "admis").length;
      const avgs = students.map(s => s.annualAvg).filter((v): v is number => v != null);
      const avg = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10 : null;
      return { label, rate: Math.round(p / students.length * 100), avg, total: students.length, passed: p };
    })
    .sort((a, b) => b.rate - a.rate);

  if (classRanking.length > 1) {
    ctx += `\n### ترتيب الأقسام بنسبة النجاح\n`;
    ctx += classRanking
      .map((c, i) => `  ${i + 1}. ${c.label}: ${c.rate}% (${c.passed}/${c.total})${c.avg != null ? ` متوسط ${c.avg}/20` : ""}`)
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
    res.status(500).json({ error: "المساعد الذكي غير مُهيّأ بعد — يرجى إضافة GROQ_API_KEY" });
    return;
  }

  try {
    const schoolContext = await buildSchoolContext(req.user!.id);

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: schoolContext },
        ...parsed.data.messages.map(m => ({ role: m.role, content: m.content })),
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      || "تعذّر الحصول على رد، حاول مجدداً.";
    res.json(AssistantChatResponse.parse({ reply }));
  } catch (err: any) {
    console.error("Assistant chat error:", err);
    const msg = err?.status === 413
      ? "البيانات كبيرة جداً للمعالجة، حاول تصفية النتائج أولاً."
      : "تعذّر الاتصال بالمساعد الذكي، حاول مجدداً بعد قليل";
    res.status(502).json({ error: msg });
  }
});

export default router;
