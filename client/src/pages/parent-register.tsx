/**
 * Parent Self-Registration Page — PUBLIC (no auth gate)
 *
 * Flow:
 *  1. Parent visits /parent-register
 *  2. They enter the school join code + their student's national ID
 *  3. If not logged in → Replit OIDC login is triggered (return URL preserved)
 *  4. After login → form is submitted and school_members record is created
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  BookOpen, GraduationCap, CheckCircle2, AlertCircle,
  ArrowLeft, Loader2, School, Hash, User,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

type SchoolPreview = { schoolUserId: string; nom: string; wilaya: string };
type SuccessData  = { student: { nomPrenom: string; niveau: string; classe: string }; school: { nom: string } };
type Step = "form" | "confirming" | "success" | "error";

export default function ParentRegisterPage() {
  const { t } = useLanguage();
  const { user, login } = useAuth();
  const [, navigate] = useLocation();

  const [joinCode,    setJoinCode]    = useState("");
  const [nationalId,  setNationalId]  = useState("");
  const [parentName,  setParentName]  = useState("");
  const [school,      setSchool]      = useState<SchoolPreview | null>(null);
  const [schoolError, setSchoolError] = useState("");
  const [lookingUp,   setLookingUp]   = useState(false);

  const [step,    setStep]    = useState<Step>("form");
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [errMsg,  setErrMsg]  = useState("");

  // Pre-fill name from logged-in user
  useEffect(() => {
    if (user && !parentName) {
      setParentName([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "");
    }
  }, [user]);

  // Look up school when join code is 6 chars
  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setSchool(null); setSchoolError(""); return; }
    if (code.length < 6) return;

    let cancelled = false;
    setLookingUp(true);
    setSchoolError("");
    fetch(`${BASE}api/public/school-by-code/${encodeURIComponent(code)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: SchoolPreview) => { if (!cancelled) { setSchool(data); setLookingUp(false); } })
      .catch(() => { if (!cancelled) { setSchool(null); setSchoolError(t("parent_register.school_not_found")); setLookingUp(false); } });
    return () => { cancelled = true; };
  }, [joinCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      // Save form state in sessionStorage and redirect to OIDC login
      sessionStorage.setItem("parent_register_form", JSON.stringify({ joinCode, nationalId, parentName }));
      login();
      return;
    }
    if (!school || !nationalId.trim()) return;

    setStep("confirming");
    setErrMsg("");

    try {
      const res = await fetch(`${BASE}api/parent-register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: joinCode.trim().toUpperCase(),
          nationalId: nationalId.trim(),
          parentName: parentName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("parent_register.error_generic"));
      setSuccess(data);
      setStep("success");
    } catch (err: any) {
      setErrMsg(err.message);
      setStep("error");
    }
  }

  // Restore form state if returning from OIDC login
  useEffect(() => {
    const saved = sessionStorage.getItem("parent_register_form");
    if (saved && user) {
      try {
        const { joinCode: jc, nationalId: ni, parentName: pn } = JSON.parse(saved);
        setJoinCode(jc ?? "");
        setNationalId(ni ?? "");
        setParentName(pn ?? "");
        sessionStorage.removeItem("parent_register_form");
      } catch { /* ignore */ }
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <motion.div
        className="flex items-center gap-3 mb-8"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="font-black text-xl text-white">{t("appName")}</p>
          <p className="text-xs text-slate-400">{t("parent_register.heading")}</p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── Success ── */}
        {step === "success" && success && (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-white/[0.06] backdrop-blur-xl shadow-2xl text-center">
              <CardContent className="pt-10 pb-8 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                <h2 className="text-xl font-bold text-white">{t("parent_register.success_title")}</h2>
                <p className="text-slate-300 text-sm">
                  {t("parent_register.success_body")
                    .replace("{student}", success.student.nomPrenom)
                    .replace("{school}",  success.school.nom)}
                </p>
                <div className="rounded-xl bg-white/[0.06] p-4 text-right space-y-1">
                  <p className="text-xs text-slate-400">{t("parent_register.student_label")}</p>
                  <p className="font-semibold text-white">{success.student.nomPrenom}</p>
                  <p className="text-xs text-slate-400">{success.student.niveau} — {success.student.classe}</p>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 mt-2"
                  onClick={() => navigate("/")}
                >
                  {t("parent_register.go_dashboard")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Error ── */}
        {step === "error" && (
          <motion.div key="err"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-white/[0.06] backdrop-blur-xl shadow-2xl text-center">
              <CardContent className="pt-10 pb-8 space-y-4">
                <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
                <h2 className="text-lg font-bold text-white">{t("parent_register.error_title")}</h2>
                <p className="text-slate-300 text-sm">{errMsg}</p>
                <Button variant="outline" className="w-full mt-2 text-white border-white/20" onClick={() => setStep("form")}>
                  <ArrowLeft className="w-4 h-4 ml-2" />
                  {t("parent_register.try_again")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Form ── */}
        {(step === "form" || step === "confirming") && (
          <motion.div key="form"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 bg-white/[0.06] backdrop-blur-xl shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                  {t("parent_register.form_title")}
                </CardTitle>
                <p className="text-xs text-slate-400 mt-1">{t("parent_register.form_subtitle")}</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
                  {/* School join code */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5" />
                      {t("parent_register.join_code_label")}
                    </Label>
                    <Input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder={t("parent_register.join_code_placeholder")}
                      maxLength={8}
                      className="bg-white/[0.08] border-white/10 text-white placeholder:text-slate-500 font-mono tracking-widest text-center text-lg uppercase"
                      required
                    />
                    {lookingUp && (
                      <p className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ البحث…</p>
                    )}
                    {school && !lookingUp && (
                      <p className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {school.nom} — {school.wilaya}
                      </p>
                    )}
                    {schoolError && !lookingUp && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {schoolError}
                      </p>
                    )}
                  </div>

                  {/* Student national ID */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      {t("parent_register.national_id_label")}
                    </Label>
                    <Input
                      value={nationalId}
                      onChange={e => setNationalId(e.target.value)}
                      placeholder={t("parent_register.national_id_placeholder")}
                      className="bg-white/[0.08] border-white/10 text-white placeholder:text-slate-500"
                      required
                    />
                    <p className="text-[11px] text-slate-500">{t("parent_register.national_id_hint_raqm")}</p>
                  </div>

                  {/* Parent name */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {t("parent_register.parent_name_label")}
                    </Label>
                    <Input
                      value={parentName}
                      onChange={e => setParentName(e.target.value)}
                      placeholder={t("parent_register.parent_name_placeholder")}
                      className="bg-white/[0.08] border-white/10 text-white placeholder:text-slate-500"
                    />
                  </div>

                  {/* Auth notice if not logged in */}
                  {!user && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                      {t("parent_register.login_required")}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!school || !nationalId.trim() || step === "confirming"}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 h-11 font-semibold"
                  >
                    {step === "confirming"
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("parent_register.registering")}</>
                      : !user
                        ? t("parent_register.login_and_register")
                        : t("parent_register.register_btn")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
