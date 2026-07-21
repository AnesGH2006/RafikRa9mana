import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { db, studentsTable, gradesTable, absencesTable, schoolInfoTable } from "../../shared/db.js";
import { AssistantChatBody, AssistantChatResponse } from "../../shared/schemas.js";
import { runReActAgent } from "../lib/react-agent.js";

const router: IRouter = Router();

// ── System prompt (keep short to save tokens) ─────────────────────────────────
const SYSTEM_PROMPT = `أنت "المساعد الذكي" لتطبيق إدارة متوسطة جزائرية.
لديك ملخص بيانات المؤسسة أدناه. استند إليه حصراً — لا تخترع أرقاماً.
دورك: تحليل النتائج، إجابة الأسئلة الإحصائية، تحديد التلاميذ في خطر، تقديم توصيات تربوية.
أجب بلغة المستخدم. كن مختصراً وعملياً.`;

// ── Age helpers ───────────────────────────────────────────────────────────────
const MAX_NORMAL_AGE: Record<string, number> = { "1AM": 11, "2AM": 12, "3AM": 13, "4AM": 15 };

function calcAge(dob: string | null, annee: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const yr = parseInt(annee.split("-")[0]);
  if (isNaN(yr)) return null;
  return Math.floor((new Date(yr, 8, 1).getTime() - birth.getTime()) / (365.25 * 864e5));
}

// ── Context builder — Optimized to prevent HTTP 413 Payload Too Large ─────────
async function buildSchoolContext(userId: string): Promise<string> {
  const [schoolRows, allStudents, allGrades, allAbsences] = await Promise.all([
    db.select().from(schoolInfoTable).where(eq(schoolInfoTable.userId, userId)),
    db.select().from(studentsTable).where(eq(studentsTable.userId, userId)),
    db.select().from(gradesTable).where(eq(gradesTable.userId, userId)),
    db.select().from(absencesTable).where(eq(absencesTable.userId, userId)),
  ]);

  if (allStudents.length === 0) return "لا توجد بيانات تلاميذ بعد.";

  const school = schoolRows[0];
  const annee   = school?.annee || "";

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const triAvg = new Map<string, Map<number, number>>();  // sid → tri → avg
  const subjAcc = new Map<string, Map<string, number[]>>(); // sid → subj → scores[]

  for (const g of allGrades) {
    const score = parseFloat(String(g.score));
    if (isNaN(score)) continue;
    if (g.subject === "__avg__") {
      if (!triAvg.has(g.studentId)) triAvg.set(g.studentId, new Map());
      triAvg.get(g.studentId)!.set(g.trimestre, score);
    } else {
      if (!subjAcc.has(g.studentId)) subjAcc.set(g.studentId, new Map());
      const sm = subjAcc.get(g.studentId)!;
      if (!sm.has(g.subject)) sm.set(g.subject, []);
      sm.get(g.subject)!.push(score);
    }
  }

  const absMap = new Map<string, { tot: number; nj: number }>();
  for (const a of allAbsences) {
    const cur = absMap.get(a.studentId) ?? { tot: 0, nj: 0 };
    cur.tot += a.justifiedHours + a.unjustifiedHours;
    cur.nj  += a.unjustifiedHours;
    absMap.set(a.studentId, cur);
  }

  // ── Enrich students ───────────────────────────────────────────────────────
  const students = allStudents.map(s => {
    const tri  = triAvg.get(s.id);
    const t1 = tri?.get(1) ?? null, t2 = tri?.get(2) ?? null, t3 = tri?.get(3) ?? null;
    const vals = [t1, t2, t3].filter((v): v is number => v !== null);
    const avg  = vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : null;
    const abs  = absMap.get(s.id) ?? { tot: 0, nj: 0 };
    const age  = calcAge(s.dateNaissance, annee);
    const ageRep = age !== null && age > (MAX_NORMAL_AGE[s.niveau] ?? 99);

    const sAvgs = new Map<string, number>();
    for (const [subj, scores] of (subjAcc.get(s.id) ?? new Map()).entries())
      sAvgs.set(subj, +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
    const weakSubjs = [...sAvgs.entries()].filter(([, v]) => v < 10)
      .sort((a, b) => a[1] - b[1]).map(([subj, v]) => `${subj}:${v}`);

    return { ...s, avg, abs, age, ageRep, sAvgs, weakSubjs };
  });

  // ── School & level aggregates ─────────────────────────────────────────────
  const total  = students.length;
  const admis  = students.filter(s => s.resultat === "admis").length;
  const nonAdm = students.filter(s => s.resultat === "non_admis").length;
  const mustar = students.filter(s => s.resultat === "mustarrak").length;
  const redob  = students.filter(s => s.statut === "redoublant").length;
  const boys   = students.filter(s => s.sexe === "M").length;
  const girls  = students.filter(s => s.sexe === "F").length;
  const bPass  = students.filter(s => s.sexe === "M" && s.resultat === "admis").length;
  const gPass  = students.filter(s => s.sexe === "F" && s.resultat === "admis").length;

  const LEVELS = ["1AM", "2AM", "3AM", "4AM"];
  const levelLines = LEVELS.map(niv => {
    const g = students.filter(s => s.niveau === niv);
    if (!g.length) return null;
    const p  = g.filter(s => s.resultat === "admis").length;
    const avgs = g.map(s => s.avg).filter((v): v is number => v !== null);
    const la = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : "—";
    const rb = g.filter(s => s.statut === "redoublant").length;
    const ar = g.filter(s => s.ageRep && s.statut !== "redoublant").length;
    return `${niv}: ${g.length}تلميذ | ناجح ${p}(${Math.round(p/g.length*100)}%) | متوسط ${la}${rb ? ` | معيد ${rb}` : ""}${ar ? ` | محتمل-سن ${ar}` : ""}`;
  }).filter(Boolean);

  // ── Per-class summary ──────────────────────────────────────────────────────
  const classeMap = new Map<string, typeof students>();
  for (const s of students) {
    const key = `${s.niveau}-${s.classe}`;
    if (!classeMap.has(key)) classeMap.set(key, []);
    classeMap.get(key)!.push(s);
  }

  const schoolSubj = new Map<string, { sum: number; n: number; fail: number }>();
  for (const s of students) {
    for (const [subj, avg] of s.sAvgs.entries()) {
      const c = schoolSubj.get(subj) ?? { sum: 0, n: 0, fail: 0 };
      c.sum += avg; c.n += 1; if (avg < 10) c.fail += 1;
      schoolSubj.set(subj, c);
    }
  }
  const subjRanked = [...schoolSubj.entries()]
    .sort(([, a], [, b]) => (a.sum / a.n) - (b.sum / b.n))
    .map(([subj, { sum, n, fail }]) => `${subj}:${(sum/n).toFixed(1)}(${fail}راسب)`)
    .join(" | ");

  const classSummaryLines = [...classeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cls, g]) => {
      const p  = g.filter(s => s.resultat === "admis").length;
      const nr = g.filter(s => s.resultat === "non_admis").length;
      const avgs = g.map(s => s.avg).filter((v): v is number => v !== null);
      const ca = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : "—";
      const top = [...g].filter(s => s.avg != null).sort((a, b) => b.avg! - a.avg!)[0];
      return `${cls}: ${g.length}طالب | ناجح ${p}(${Math.round(p/g.length*100)}%) | راسب ${nr} | متوسط ${ca}${top ? ` | أعلى: ${top.nomPrenom}(${top.avg})` : ""}`;
    });

  // ── Notable student lists (Compact & Truncated to avoid payload errors) ───
  const fmt = (s: (typeof students)[0], extras: string[] = []) => {
    const flags = [
      s.statut === "redoublant" ? "معيد" : s.ageRep ? `سن${s.age}` : null,
      s.abs.tot >= 30 ? `غ${s.abs.tot}` : null,
      ...extras,
    ].filter(Boolean);
    return `${s.nomPrenom}|${s.niveau}-${s.classe}|${s.avg ?? "—"}${flags.length ? "|" + flags.join(",") : ""}`;
  };

  const sorted      = [...students].filter(s => s.avg != null).sort((a, b) => b.avg! - a.avg!);
  const top10       = sorted.slice(0, 10).map(s => fmt(s)).join(" | ");
  const bottom10    = [...sorted].reverse().slice(0, 10).map(s => fmt(s)).join(" | ");
  const mostAbsent  = [...students].sort((a, b) => b.abs.tot - a.abs.tot)
    .filter(s => s.abs.tot > 0).slice(0, 10).map(s => fmt(s)).join(" | ");
  const closestPass = students
    .filter(s => s.resultat === "non_admis" && s.avg != null && s.avg >= 7)
    .sort((a, b) => b.avg! - a.avg!).slice(0, 15)
    .map(s => fmt(s, s.weakSubjs.slice(0, 2))).join(" | ");

  // Limit failing students list to a max of 25 to protect payload size
  const failingAll = students
    .filter(s => s.resultat === "non_admis")
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
    .slice(0, 25)
    .map(s => fmt(s, s.weakSubjs.slice(0, 2))).join(" | ");

  // ── Assemble context ──────────────────────────────────────────────────────
  let ctx = "## بيانات المؤسسة\n";
  if (school) {
    ctx += `${school.nom || ""}${school.commune ? "، " + school.commune : ""}${school.wilaya ? " — " + school.wilaya : ""} | السنة: ${annee}\n`;
  }

  ctx += `\n### إحصاءات المؤسسة\n`;
  ctx += `الإجمالي: ${total} | ذكور: ${boys}(ناجح ${bPass}) | إناث: ${girls}(ناجحة ${gPass})\n`;
  ctx += `ناجح: ${admis}(${Math.round(admis/total*100)}%) | راسب: ${nonAdm}(${Math.round(nonAdm/total*100)}%)${mustar ? ` | منتقل: ${mustar}` : ""}\n`;

  ctx += `\n### حسب المستوى\n${levelLines.join("\n")}\n`;
  if (subjRanked) ctx += `\n### مواد المؤسسة (ضعيف←قوي)\n${subjRanked}\n`;

  ctx += `\n### الأقسام (إحصاء)\n${classSummaryLines.join("\n")}\n`;

  ctx += `\n### أفضل 10 تلاميذ\n${top10 || "—"}\n`;
  ctx += `\n### أدنى 10 معدلات\n${bottom10 || "—"}\n`;

  if (failingAll) ctx += `\n### عينة من الراسبين (أول 25 من إجمالي ${nonAdm})\n${failingAll}\n`;
  if (closestPass) ctx += `\n### راسبون قريبون من النجاح (≥7/20)\n${closestPass}\n`;
  if (mostAbsent)   ctx += `\n### الأكثر غياباً (أعلى 10)\n${mostAbsent}\n`;

  return ctx;
}

// ── POST /api/assistant/chat ──────────────────────────────────────────────────
router.post("/assistant/chat", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "طلب غير صالح" }); return; }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "المساعد الذكي غير مُهيّأ — يرجى إضافة GROQ_API_KEY" });
    return;
  }

  try {
    const schoolContext = await buildSchoolContext(req.user!.id);

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // Take only last 8 messages to prevent context payload explosion
    const recentMessages = parsed.data.messages.slice(-8);

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "system" as const, content: schoolContext },
      ...recentMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const model = "llama-3.3-70b-versatile";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 1200,
      messages,
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      || "تعذّر الحصول على رد، حاول مجدداً.";
    res.json(AssistantChatResponse.parse({ reply }));
  } catch (err: any) {
    console.error("Assistant chat error:", err?.status, err?.message?.slice(0, 200));
    const msg =
      err?.status === 429
        ? "تجاوزنا حد الطلبات، انتظر دقيقة ثم أعد المحاولة."
        : err?.status === 413
        ? "البيانات كبيرة جداً للمعالجة — يُرجى التواصل مع مطوّر التطبيق."
        : "تعذّر الاتصال بالمساعد، حاول مجدداً بعد قليل.";
    res.status(502).json({ error: msg });
  }
});

// ── POST /api/assistant/run — ReAct agent with SSE streaming ─────────────────
router.post("/assistant/run", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = AssistantChatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "طلب غير صالح" }); return; }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "المساعد الذكي غير مُهيّأ — يرجى إضافة GROQ_API_KEY" });
    return;
  }

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const schoolContext = await buildSchoolContext(req.user!.id);

    // Pass only the last 8 messages to keep ReAct payload light
    const recentMessages = parsed.data.messages.slice(-8);

    await runReActAgent({
      userId: req.user!.id,
      schoolContext,
      messages: recentMessages,
      onStep: (step) => send("step", step),
    });

    send("done", { ok: true });
  } catch (err: any) {
    console.error("ReAct agent error:", err?.status, err?.message?.slice?.(0, 200));
    const msg =
      err?.status === 429
        ? "تجاوزنا حد الطلبات، انتظر دقيقة ثم أعد المحاولة."
        : err?.status === 413
        ? "البيانات كبيرة جداً للمعالجة."
        : (err?.message || "حدث خطأ غير متوقع في المساعد.");
    send("error", { message: msg });
  } finally {
    res.end();
  }
});

export default router;