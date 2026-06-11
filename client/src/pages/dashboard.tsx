import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserCheck, UserX, Pencil, School, MapPin, Calendar, GraduationCap } from "lucide-react";
import { CountUp } from "@/components/count-up";
import type { SchoolInfo, DashboardStats, Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

// ── Animation variants ────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const tableRowVariants = {
  initial: { opacity: 0, x: -16 },
  animate: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, colorBg, colorIcon, light,
}: {
  label: string; value: number; icon: React.ElementType;
  colorBg: string; colorIcon: string; light: string;
}) {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -3, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Card className={`border-0 shadow-sm ${light} overflow-hidden relative`}>
        <div className={`absolute inset-0 opacity-5 ${colorBg}`} />
        <CardContent className="pt-5 pb-4 relative">
          <div className="flex items-center gap-4">
            <motion.div
              className={`w-12 h-12 rounded-2xl ${colorBg} flex items-center justify-center shrink-0`}
              initial={{ scale: 0.5, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            >
              <Icon className={`w-6 h-6 ${colorIcon}`} />
            </motion.div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
              <p className="text-3xl font-extrabold text-foreground leading-none tracking-tight">
                <CountUp to={value} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: "", wilaya: "", commune: "", annee: "2025-2026" });
  const [statsLoaded, setStatsLoaded] = useState(false);

  const fetchSchool = useCallback(async () => {
    setLoadingSchool(true);
    try {
      const res = await fetch(`${BASE}api/school`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setSchool(d);
        if (d) setForm({ nom: d.nom, wilaya: d.wilaya, commune: d.commune, annee: d.annee });
      }
    } finally { setLoadingSchool(false); }
  }, []);

  const fetchStats = useCallback(async (annee?: string) => {
    setLoadingStats(true);
    setStatsLoaded(false);
    try {
      const url = annee ? `${BASE}api/stats?annee=${annee}` : `${BASE}api/stats`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) { setStats(await res.json()); setStatsLoaded(true); }
    } finally { setLoadingStats(false); }
  }, []);

  useEffect(() => { fetchSchool(); fetchStats(); }, [fetchSchool, fetchStats]);

  const handleSave = async () => {
    if (!form.nom || !form.wilaya || !form.commune || !form.annee) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}api/school`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const d = await res.json(); setSchool(d);
        fetchStats(d.annee);
        setEditOpen(false);
        toast({ title: t("dashboard.save") });
      }
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {t("dashboard.title")}
        </motion.h1>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Button variant="outline" size="sm" className="gap-2 hover:shadow-md transition-shadow"
            onClick={() => { setForm(school ? { nom: school.nom, wilaya: school.wilaya, commune: school.commune, annee: school.annee } : { nom: "", wilaya: "", commune: "", annee: "2025-2026" }); setEditOpen(true); }}>
            <Pencil className="w-4 h-4" />
            {school ? t("dashboard.editInfo") : t("dashboard.setup")}
          </Button>
        </motion.div>
      </div>

      {/* School Info Card */}
      <AnimatePresence mode="wait">
        {!loadingSchool && (
          <motion.div
            key={school ? "school" : "no-school"}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {school ? (
              <Card className="border-blue-200 dark:border-blue-800 overflow-hidden relative bg-gradient-to-br from-blue-50 via-indigo-50/50 to-violet-50/30 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/20">
                {/* Decorative blur blob */}
                <div className="absolute -top-12 -end-12 w-40 h-40 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
                <CardContent className="pt-5 relative">
                  <div className="flex flex-wrap gap-6">
                    {[
                      { label: t("dashboard.schoolName"), value: school.nom, icon: School, color: "bg-blue-600" },
                      { label: `${t("dashboard.wilaya")} / ${t("dashboard.commune")}`, value: `${school.wilaya} — ${school.commune}`, icon: MapPin, color: "bg-indigo-500" },
                      { label: t("dashboard.year"), value: school.annee, icon: Calendar, color: "bg-violet-500" },
                    ].map((item, i) => (
                      <motion.div key={i} className="flex items-center gap-3"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.35 }}>
                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0 shadow-sm`}>
                          <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="font-bold text-foreground">{item.value}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                    <School className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  </motion.div>
                  <p className="mb-4">{t("dashboard.noSchool")}</p>
                  <Button onClick={() => setEditOpen(true)}>{t("dashboard.setup")}</Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <AnimatePresence mode="wait">
        {loadingStats ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <motion.div key={i} className="h-28 rounded-xl bg-muted"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        ) : stats && stats.total > 0 ? (
          <motion.div key="stats" variants={containerVariants} initial="initial" animate="animate" className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label={t("stats.total")} value={stats.total} icon={Users}
                colorBg="bg-blue-500" colorIcon="text-white" light="bg-blue-50 dark:bg-blue-950/30" />
              <StatCard label={t("stats.boys")} value={stats.boys} icon={Users}
                colorBg="bg-sky-500" colorIcon="text-white" light="bg-sky-50 dark:bg-sky-950/30" />
              <StatCard label={t("stats.girls")} value={stats.girls} icon={Users}
                colorBg="bg-pink-500" colorIcon="text-white" light="bg-pink-50 dark:bg-pink-950/30" />
              {(stats.admis > 0 || stats.nonAdmis > 0) && (
                <StatCard label={t("stats.admis")} value={stats.admis} icon={UserCheck}
                  colorBg="bg-emerald-500" colorIcon="text-white" light="bg-emerald-50 dark:bg-emerald-950/30" />
              )}
            </div>

            {/* Pass/fail bar */}
            {(stats.admis > 0 || stats.nonAdmis > 0) && stats.total > 0 && (
              <motion.div variants={cardVariants}>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="font-semibold text-emerald-600">{t("val.admis")} — <CountUp to={stats.admis} /></span>
                      <span className="font-semibold text-red-500">{t("val.non_admis")} — <CountUp to={stats.nonAdmis} /></span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex gap-0.5">
                      <motion.div
                        className="h-full bg-emerald-500 rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${(stats.admis / stats.total) * 100}%` }}
                        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                      />
                      <motion.div
                        className="h-full bg-red-400 rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${(stats.nonAdmis / stats.total) * 100}%` }}
                        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Level breakdown */}
            {stats.byLevel.length > 0 && (
              <motion.div variants={cardVariants}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", delay: 0.4 }}>
                        <GraduationCap className="w-5 h-5 text-blue-500" />
                      </motion.div>
                      {t("stats.byLevel")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground text-xs uppercase">
                            <th className="pb-2 text-start font-semibold">{t("stats.level")}</th>
                            <th className="pb-2 text-center font-semibold">{t("stats.total_col")}</th>
                            <th className="pb-2 text-center font-semibold">{t("stats.boys")}</th>
                            <th className="pb-2 text-center font-semibold">{t("stats.girls")}</th>
                            {stats.byLevel.some(l => l.admis > 0 || l.nonAdmis > 0) && (
                              <>
                                <th className="pb-2 text-center font-semibold text-emerald-600">{t("val.admis")}</th>
                                <th className="pb-2 text-center font-semibold text-red-500">{t("val.non_admis")}</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byLevel.map((l, i) => (
                            <motion.tr key={l.niveau}
                              custom={i} variants={tableRowVariants}
                              className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                            >
                              <td className="py-3 font-semibold text-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <motion.span className="w-2 h-2 rounded-full bg-blue-500 inline-block"
                                    animate={{ scale: [1, 1.4, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                                  />
                                  {LEVEL_LABELS[l.niveau as Niveau]}
                                </span>
                              </td>
                              <td className="py-3 text-center font-bold"><CountUp to={l.total} /></td>
                              <td className="py-3 text-center text-sky-600 dark:text-sky-400"><CountUp to={l.boys} /></td>
                              <td className="py-3 text-center text-pink-600 dark:text-pink-400"><CountUp to={l.girls} /></td>
                              {stats.byLevel.some(ll => ll.admis > 0 || ll.nonAdmis > 0) && (
                                <>
                                  <td className="py-3 text-center text-emerald-600">{l.admis ? <CountUp to={l.admis} /> : "—"}</td>
                                  <td className="py-3 text-center text-red-500">{l.nonAdmis ? <CountUp to={l.nonAdmis} /> : "—"}</td>
                                </>
                              )}
                            </motion.tr>
                          ))}
                          <motion.tr
                            className="font-bold bg-muted/50"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: stats.byLevel.length * 0.05 + 0.2 }}
                          >
                            <td className="py-3">{t("stats.total_col")}</td>
                            <td className="py-3 text-center"><CountUp to={stats.total} /></td>
                            <td className="py-3 text-center text-sky-600 dark:text-sky-400"><CountUp to={stats.boys} /></td>
                            <td className="py-3 text-center text-pink-600 dark:text-pink-400"><CountUp to={stats.girls} /></td>
                            {stats.byLevel.some(l => l.admis > 0 || l.nonAdmis > 0) && (
                              <>
                                <td className="py-3 text-center text-emerald-600"><CountUp to={stats.admis} /></td>
                                <td className="py-3 text-center text-red-500"><CountUp to={stats.nonAdmis} /></td>
                              </>
                            )}
                          </motion.tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        ) : (
          !loadingStats && (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}>
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  </motion.div>
                  <p>{t("stats.noData")}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.schoolInfo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { key: "nom", label: t("dashboard.schoolName") },
              { key: "wilaya", label: t("dashboard.wilaya") },
              { key: "commune", label: t("dashboard.commune") },
              { key: "annee", label: t("dashboard.year") },
            ].map((f, i) => (
              <motion.div key={f.key} className="space-y-1.5"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}>
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input id={f.key} value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.key === "annee" ? "2025-2026" : ""} />
              </motion.div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("dashboard.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.nom || !form.wilaya || !form.commune || !form.annee}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <motion.div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                  ...
                </span>
              ) : t("dashboard.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
