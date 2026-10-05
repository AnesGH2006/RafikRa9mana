import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BookOpenCheck, Check, ClipboardCopy, FileQuestion,
  LoaderCircle, MessageSquareText, Printer, RefreshCw, Send, ShieldAlert,
  Sparkles, Star, UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

type View = "remarks" | "quiz" | "risks";
type Language = "ar" | "fr" | "both";
interface SubjectAverage { id: number; subject: string; trimester: string; average: string; }
interface RemarkResult { subject: string; trimester: number; average: number; remark: string | { ar: string; fr: string }; }
interface Warning {
  studentId: string;
  studentName: string;
  niveau: string;
  classe: string;
  risk: "CRITICAL_DROP" | "ATTENDANCE_WARNING" | "ACADEMIC_RISK";
  trimester1Average: number | null;
  trimester2Average: number | null;
  averageDrop: number;
  consecutiveUnexcusedDays: number;
  intervention: string;
}

const LEVELS = ["1AM", "2AM", "3AM", "4AM", "1AS", "2AS", "3AS"];
const SUBJECTS = ["الرياضيات", "الفيزياء", "علوم الطبيعة والحياة", "اللغة العربية", "اللغة الفرنسية", "اللغة الإنجليزية", "التاريخ والجغرافيا"];
const labels: Record<string, string> = {
  exercise1: "التمرين الأول · استرجاع المعارف",
  exercise2: "التمرين الثاني · التطبيق والاستدلال",
  integrationSituation: "الوضعية الإدماجية وشبكة التقييم",
  answerKey: "التصحيح النموذجي وسلم التنقيط",
  question: "السؤال", prompt: "التعليمة", answer: "الإجابة", solution: "الحل",
  points: "النقاط", score: "التنقيط", criteria: "المعيار", evaluationGrid: "شبكة التقييم",
  grid: "شبكة التقييم", expectedAnswer: "الإجابة المنتظرة", title: "العنوان", instructions: "التعليمات",
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "تعذر تنفيذ الطلب");
  return data;
}

function OutputValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="whitespace-pre-wrap leading-7">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return <ol className="list-decimal space-y-2 ps-5">{value.map((entry, index) => <li key={index}><OutputValue value={entry} /></li>)}</ol>;
  }
  if (typeof value === "object") {
    return <div className="space-y-3">{Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
      <div key={key} className="min-w-0">
        <p className="mb-1 text-xs font-bold text-muted-foreground">{labels[key] ?? key}</p>
        <div className="text-sm"><OutputValue value={entry} /></div>
      </div>
    ))}</div>;
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>;
}

function currentAcademicYear() {
  const now = new Date();
  const firstYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${firstYear}-${firstYear + 1}`;
}

export default function PedagogyCenterPage() {
  const [view, setView] = useState<View>("remarks");
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectAverage[]>([{ id: 1, subject: SUBJECTS[0]!, trimester: "1", average: "" }]);
  const [attendanceRate, setAttendanceRate] = useState("95");
  const [behavior, setBehavior] = useState("4");
  const [language, setLanguage] = useState<Language>("both");
  const [remarks, setRemarks] = useState<RemarkResult[]>([]);
  const [remarksBusy, setRemarksBusy] = useState(false);
  const [gradeLevel, setGradeLevel] = useState("4AM");
  const [quizSubject, setQuizSubject] = useState("الرياضيات");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState("8");
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [warningsBusy, setWarningsBusy] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function generateRemarks(event: React.FormEvent) {
    event.preventDefault();
    if (subjects.some(item => !item.subject.trim() || item.average === "" || !Number.isFinite(Number(item.average)) || Number(item.average) < 0 || Number(item.average) > 20)) {
      toast({ variant: "destructive", title: "تحقق من المعدلات", description: "أدخل معدلاً صحيحاً بين 0 و20 لكل مادة." });
      return;
    }
    setRemarksBusy(true);
    try {
      const response = await fetch(`${BASE}api/v1/pedagogy/generate-remarks`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectAverages: subjects.map(item => ({ subject: item.subject, trimester: Number(item.trimester), average: Number(item.average) })),
          attendanceRate: Number(attendanceRate), behavioralScore: Number(behavior), language,
        }),
      });
      const data = await readJson(response);
      setRemarks(data.remarks ?? []);
    } catch (error) {
      toast({ variant: "destructive", title: "تعذر إنشاء الملاحظات", description: error instanceof Error ? error.message : "حاول مجدداً" });
    } finally { setRemarksBusy(false); }
  }

  async function generateQuiz(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim()) {
      toast({ variant: "destructive", title: "أدخل موضوع الدرس" });
      return;
    }
    setQuizBusy(true);
    setQuiz(null);
    try {
      const response = await fetch(`${BASE}api/v1/ai/generate-quiz`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeLevel, subject: quizSubject, lessonTopic: topic.trim(), difficulty, questionCount: Number(questionCount) }),
      });
      const data = await readJson(response);
      setQuiz(data.quiz);
    } catch (error) {
      toast({ variant: "destructive", title: "تعذر إنشاء الاختبار", description: error instanceof Error ? error.message : "تحقق من إعدادات الذكاء الاصطناعي" });
    } finally { setQuizBusy(false); }
  }

  async function loadWarnings() {
    setWarningsBusy(true);
    try {
      const response = await fetch(`${BASE}api/v1/pedagogy/early-warnings?annee=${encodeURIComponent(academicYear)}`, { credentials: "include" });
      const data = await readJson(response);
      setWarnings(data.warnings ?? []);
    } catch (error) {
      toast({ variant: "destructive", title: "تعذر تحميل قائمة التعثر", description: error instanceof Error ? error.message : "حاول مجدداً" });
    } finally { setWarningsBusy(false); }
  }

  useEffect(() => { if (view === "risks") void loadWarnings(); }, [view]);

  async function sendDisciplineAlert(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedWarning || !message.trim()) return;
    setSending(true);
    try {
      const delivery = await readJson(await fetch(`${BASE}api/v1/notifications/disciplinary`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedWarning.studentId, template_ar: message.trim() }),
      })) as { smsSent?: boolean; portalRecipients?: number };
      const channels = [
        delivery.portalRecipients ? "بوابة الأولياء" : "",
        delivery.smsSent ? "SMS" : "",
      ].filter(Boolean);
      if (channels.length > 0) {
        toast({ title: `تم إرسال التنبيه عبر ${channels.join(" و ")}` });
      } else {
        toast({ variant: "destructive", title: "لم يصل التنبيه إلى ولي الأمر", description: "لا يوجد حساب وليّ مربوط بالتلميذ ولم يتم إرسال SMS." });
      }
      setSelectedWarning(null);
      setMessage("");
    } catch (error) {
      toast({ variant: "destructive", title: "تعذر إرسال الإشعار", description: error instanceof Error ? error.message : "تحقق من إعدادات الرسائل" });
    } finally { setSending(false); }
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: "تم النسخ" }); }
    catch { toast({ variant: "destructive", title: "تعذر النسخ" }); }
  }

  const tabs: Array<{ id: View; label: string; icon: typeof Star }> = [
    { id: "remarks", label: "ملاحظات التلاميذ", icon: MessageSquareText },
    { id: "quiz", label: "إنشاء اختبار", icon: FileQuestion },
    { id: "risks", label: "متابعة التعثر", icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
            <BookOpenCheck className="h-4 w-4" /> التتبع البيداغوجي
          </div>
          <h1 className="text-2xl font-black tracking-normal">فضاء المتابعة والتقويم</h1>
          <p className="mt-1 text-sm text-muted-foreground">ملاحظات التلاميذ، إعداد الاختبارات، والتنبيه المبكر للتعثر</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> أدوات المؤسسة
        </div>
      </header>

      <nav aria-label="أدوات المتابعة" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${view === id ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {view === "remarks" && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
          <form onSubmit={generateRemarks} className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">توليد الملاحظات</h2>
              <p className="mt-1 text-sm text-muted-foreground">أدخل معدل المادة والفصل، ثم راجع صياغة الملاحظة قبل اعتمادها.</p>
            </div>
            <div className="space-y-3">
              {subjects.map((item, index) => (
                <div key={item.id} className="grid gap-3 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_130px_130px]">
                  <Field label="المادة">
                    <Select value={item.subject} onValueChange={value => setSubjects(rows => rows.map(row => row.id === item.id ? { ...row, subject: value } : row))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map(subject => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="الفصل">
                    <Select value={item.trimester} onValueChange={value => setSubjects(rows => rows.map(row => row.id === item.id ? { ...row, trimester: value } : row))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[1, 2, 3].map(term => <SelectItem key={term} value={String(term)}>الفصل {term}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="المعدل / 20">
                    <Input type="number" min="0" max="20" step="0.01" required value={item.average} onChange={event => setSubjects(rows => rows.map(row => row.id === item.id ? { ...row, average: event.target.value } : row))} placeholder="مثال: 15.5" />
                  </Field>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSubjects(rows => [...rows, { id: Date.now(), subject: SUBJECTS[0]!, trimester: "1", average: "" }])}>إضافة مادة</Button>
                {subjects.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setSubjects(rows => rows.slice(0, -1))}>حذف آخر مادة</Button>}
              </div>
            </div>
            <div className="grid gap-4 border-y py-4 sm:grid-cols-3">
              <Field label="نسبة الحضور %"><Input type="number" min="0" max="100" value={attendanceRate} onChange={event => setAttendanceRate(event.target.value)} /></Field>
              <Field label="السلوك (1 إلى 5)">
                <Select value={behavior} onValueChange={setBehavior}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(score => <SelectItem key={score} value={String(score)}>{score} / 5</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="لغة الملاحظة">
                <Select value={language} onValueChange={value => setLanguage(value as Language)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">العربية والفرنسية</SelectItem><SelectItem value="ar">العربية</SelectItem><SelectItem value="fr">الفرنسية</SelectItem></SelectContent></Select>
              </Field>
            </div>
            <Button type="submit" disabled={remarksBusy} className="min-w-44 bg-emerald-700 hover:bg-emerald-800">
              {remarksBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}إنشاء الملاحظات
            </Button>
          </form>

          <section className="space-y-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">الملاحظات المقترحة</h2><p className="text-sm text-muted-foreground">تظهر النتيجة هنا بعد الإنشاء.</p></div>
              {remarks.length > 0 && <Button variant="ghost" size="icon" aria-label="نسخ الملاحظات" title="نسخ الملاحظات" onClick={() => void copyText(remarks.map(item => `${item.subject} · الفصل ${item.trimester}: ${typeof item.remark === "string" ? item.remark : `${item.remark.ar}\n${item.remark.fr}`}`).join("\n"))}><ClipboardCopy /></Button>}
            </div>
            {remarks.length === 0 ? <div className="border-y py-12 text-center text-sm text-muted-foreground"><MessageSquareText className="mx-auto mb-3 h-8 w-8 opacity-40" />أدخل المعدلات لإنشاء صياغة مقترحة.</div> : remarks.map((item, index) => (
              <article key={`${item.subject}-${item.trimester}-${index}`} className="border-b pb-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span className="font-bold text-foreground">{item.subject}</span><span>الفصل {item.trimester} · {item.average.toFixed(2)} / 20</span></div>
                {typeof item.remark === "string" ? <p className="text-sm leading-7">{item.remark}</p> : <><p className="text-sm leading-7">{item.remark.ar}</p><p dir="ltr" className="mt-1 text-sm leading-7 text-muted-foreground">{item.remark.fr}</p></>}
              </article>
            ))}
          </section>
        </div>
      )}

      {view === "quiz" && (
        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <form onSubmit={generateQuiz} className="space-y-4">
            <div><h2 className="text-lg font-bold">صانع الاختبارات</h2><p className="mt-1 text-sm text-muted-foreground">ورقة منظمة حسب المستوى والدرس المطلوب.</p></div>
            <Field label="المستوى"><Select value={gradeLevel} onValueChange={setGradeLevel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEVELS.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="المادة"><Select value={quizSubject} onValueChange={setQuizSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUBJECTS.map(subject => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="موضوع الدرس"><Input required maxLength={300} value={topic} onChange={event => setTopic(event.target.value)} placeholder="مثال: التحولات الكيميائية" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="الصعوبة"><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Easy">سهل</SelectItem><SelectItem value="Medium">متوسط</SelectItem><SelectItem value="Hard">صعب</SelectItem></SelectContent></Select></Field>
              <Field label="عدد الأسئلة"><Input type="number" min="3" max="30" value={questionCount} onChange={event => setQuestionCount(event.target.value)} /></Field>
            </div>
            <Button type="submit" disabled={quizBusy} className="w-full bg-emerald-700 hover:bg-emerald-800">{quizBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}إنشاء الاختبار</Button>
          </form>

          <section className="min-w-0" aria-live="polite">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div><h2 className="text-lg font-bold">ورقة الاختبار والتصحيح</h2><p className="text-sm text-muted-foreground">تمارين، وضعية إدماجية، وشبكة تقييم.</p></div>
              {quiz && <div className="flex gap-1"><Button variant="ghost" size="icon" title="نسخ الاختبار" aria-label="نسخ الاختبار" onClick={() => void copyText(JSON.stringify(quiz, null, 2))}><ClipboardCopy /></Button><Button variant="ghost" size="icon" title="طباعة الاختبار" aria-label="طباعة الاختبار" onClick={() => window.print()}><Printer /></Button></div>}
            </div>
            {quizBusy ? <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />جارٍ إعداد ورقة الاختبار...</div> : !quiz ? <div className="border-y py-12 text-center text-sm text-muted-foreground"><FileQuestion className="mx-auto mb-3 h-8 w-8 opacity-40" />أكمل بيانات الدرس لعرض الاختبار هنا.</div> : (
              <div className="space-y-6 print:text-black">
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-b pb-3 text-sm"><strong>{gradeLevel}</strong><span>{quizSubject}</span><span>{topic}</span><span>{difficulty === "Easy" ? "سهل" : difficulty === "Hard" ? "صعب" : "متوسط"}</span></div>
                {["exercise1", "exercise2", "integrationSituation", "answerKey"].map(key => quiz[key] !== undefined && (
                  <section key={key} className="border-b pb-5"><h3 className="mb-3 flex items-center gap-2 font-bold"><span className="h-2 w-2 rounded-full bg-emerald-600" />{labels[key]}</h3><div className="text-sm leading-7"><OutputValue value={quiz[key]} /></div></section>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {view === "risks" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div><h2 className="text-lg font-bold">مؤشرات التعثر والتدخل المبكر</h2><p className="mt-1 text-sm text-muted-foreground">انخفاض المعدل، الغياب المتواصل، أو معدل دون 10.</p></div>
            <div className="flex items-center gap-2"><Field label="السنة الدراسية"><Input className="w-36" value={academicYear} onChange={event => setAcademicYear(event.target.value)} /></Field><Button variant="outline" size="icon" title="تحديث القائمة" aria-label="تحديث القائمة" disabled={warningsBusy} onClick={() => void loadWarnings()}>{warningsBusy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}</Button></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["CRITICAL_DROP", "انخفاض حاد", "text-rose-700 bg-rose-50 dark:bg-rose-950/30", AlertTriangle],
              ["ATTENDANCE_WARNING", "تنبيه غياب", "text-amber-700 bg-amber-50 dark:bg-amber-950/30", ShieldAlert],
              ["ACADEMIC_RISK", "خطر دراسي", "text-blue-700 bg-blue-50 dark:bg-blue-950/30", Activity],
            ] as const).map(([risk, title, style, Icon]) => <div key={risk} className={`flex items-center justify-between border-b p-3 ${style}`}><span className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{title}</span><span className="text-xl font-black">{warnings.filter(item => item.risk === risk).length}</span></div>)}
          </div>

          {selectedWarning && (
            <form onSubmit={sendDisciplineAlert} className="grid gap-3 border-y py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">إشعار ولي أمر {selectedWarning.studentName}</p><button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSelectedWarning(null)}>إلغاء</button></div><Textarea required maxLength={1200} rows={3} value={message} onChange={event => setMessage(event.target.value)} /></div>
              <div className="flex items-end"><Button type="submit" disabled={sending || !message.trim()} className="bg-emerald-700 hover:bg-emerald-800">{sending ? <LoaderCircle className="animate-spin" /> : <Send />}إرسال SMS</Button></div>
            </form>
          )}

          {warningsBusy ? <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />جارٍ تحليل النتائج والغياب...</div> : warnings.length === 0 ? <div className="border-y py-12 text-center text-sm text-muted-foreground"><Check className="mx-auto mb-3 h-8 w-8 text-emerald-600" />لا توجد مؤشرات تعثر لهذه السنة.</div> : (
            <div className="divide-y">
              {warnings.map(item => <article key={`${item.studentId}-${item.risk}`} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.studentName}</h3><span className="text-xs text-muted-foreground">{item.niveau} · {item.classe}</span><span className={`rounded-sm px-2 py-1 text-[11px] font-bold ${item.risk === "CRITICAL_DROP" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : item.risk === "ATTENDANCE_WARNING" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"}`}>{item.risk === "CRITICAL_DROP" ? "انخفاض حاد" : item.risk === "ATTENDANCE_WARNING" ? "تنبيه غياب" : "خطر دراسي"}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.intervention}</p>
                  <p className="mt-2 text-xs">الفصل 1: {item.trimester1Average ?? "—"} · الفصل 2: {item.trimester2Average ?? "—"} · انخفاض: {item.averageDrop.toFixed(2)} · غياب متواصل: {item.consecutiveUnexcusedDays} أيام</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedWarning(item); setMessage(`تنهي إدارة المؤسسة إلى علمكم بضرورة متابعة وضعية ابنكم ${item.studentName}، ونرجو التواصل مع مستشار التربية في أقرب وقت.`); }}><MessageSquareText />إشعار الولي</Button>
              </article>)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
