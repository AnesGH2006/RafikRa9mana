import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserCheck, UserX, Pencil, School, MapPin, Calendar, GraduationCap } from "lucide-react";
import type { SchoolInfo, DashboardStats, Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;

const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

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

  const fetchSchool = useCallback(async () => {
    setLoadingSchool(true);
    try {
      const res = await fetch(`${BASE}api/school`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setSchool(d); if (d) setForm({ nom: d.nom, wilaya: d.wilaya, commune: d.commune, annee: d.annee }); }
    } finally { setLoadingSchool(false); }
  }, []);

  const fetchStats = useCallback(async (annee?: string) => {
    setLoadingStats(true);
    try {
      const url = annee ? `${BASE}api/stats?annee=${annee}` : `${BASE}api/stats`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setStats(await res.json());
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
        toast({ title: t("dashboard.save"), description: "✓" });
      }
    } finally { setSaving(false); }
  };

  const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setForm(school ? { nom: school.nom, wilaya: school.wilaya, commune: school.commune, annee: school.annee } : { nom: "", wilaya: "", commune: "", annee: "2025-2026" }); setEditOpen(true); }}>
          <Pencil className="w-4 h-4" />
          {school ? t("dashboard.editInfo") : t("dashboard.setup")}
        </Button>
      </div>

      {/* School Info Card */}
      {!loadingSchool && (
        <motion.div {...fade} transition={{ duration: 0.3 }}>
          {school ? (
            <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40">
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <School className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("dashboard.schoolName")}</p>
                      <p className="font-bold text-foreground text-lg leading-tight">{school.nom}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("dashboard.wilaya")} / {t("dashboard.commune")}</p>
                      <p className="font-semibold text-foreground">{school.wilaya} — {school.commune}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("dashboard.year")}</p>
                      <p className="font-bold text-foreground text-lg">{school.annee}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="pt-6 text-center text-muted-foreground py-10">
                <School className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="mb-4">{t("dashboard.noSchool")}</p>
                <Button onClick={() => setEditOpen(true)}>{t("dashboard.setup")}</Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Stats */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : stats && stats.total > 0 ? (
        <>
          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("stats.total"), value: stats.total, icon: Users, color: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950/30" },
              { label: t("stats.boys"), value: stats.boys, icon: Users, color: "bg-sky-500", light: "bg-sky-50 dark:bg-sky-950/30" },
              { label: t("stats.girls"), value: stats.girls, icon: Users, color: "bg-pink-500", light: "bg-pink-50 dark:bg-pink-950/30" },
            ].map((s, i) => (
              <motion.div key={i} {...fade} transition={{ delay: 0.08 * i }}>
                <Card className={`border-0 ${s.light}`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${s.color} flex items-center justify-center shrink-0`}>
                        <s.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {/* Results card */}
            {(stats.admis > 0 || stats.nonAdmis > 0) && (
              <motion.div {...fade} transition={{ delay: 0.24 }}>
                <Card className="border-0 bg-green-50 dark:bg-green-950/30">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("stats.admis")}</p>
                        <p className="text-2xl font-extrabold text-foreground">{stats.admis}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>

          {/* By Level */}
          {stats.byLevel.length > 0 && (
            <motion.div {...fade} transition={{ delay: 0.15 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-500" />
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
                              <th className="pb-2 text-center font-semibold text-green-600">{t("val.admis")}</th>
                              <th className="pb-2 text-center font-semibold text-red-500">{t("val.non_admis")}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byLevel.map((l, i) => (
                          <tr key={l.niveau} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/30"}`}>
                            <td className="py-3 font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                {LEVEL_LABELS[l.niveau]}
                              </span>
                            </td>
                            <td className="py-3 text-center font-bold">{l.total}</td>
                            <td className="py-3 text-center text-sky-600 dark:text-sky-400">{l.boys}</td>
                            <td className="py-3 text-center text-pink-600 dark:text-pink-400">{l.girls}</td>
                            {stats.byLevel.some(ll => ll.admis > 0 || ll.nonAdmis > 0) && (
                              <>
                                <td className="py-3 text-center text-green-600">{l.admis || "—"}</td>
                                <td className="py-3 text-center text-red-500">{l.nonAdmis || "—"}</td>
                              </>
                            )}
                          </tr>
                        ))}
                        <tr className="font-bold bg-muted/50">
                          <td className="py-3">{t("stats.total_col")}</td>
                          <td className="py-3 text-center">{stats.total}</td>
                          <td className="py-3 text-center text-sky-600 dark:text-sky-400">{stats.boys}</td>
                          <td className="py-3 text-center text-pink-600 dark:text-pink-400">{stats.girls}</td>
                          {stats.byLevel.some(l => l.admis > 0 || l.nonAdmis > 0) && (
                            <>
                              <td className="py-3 text-center text-green-600">{stats.admis}</td>
                              <td className="py-3 text-center text-red-500">{stats.nonAdmis}</td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      ) : (
        !loadingStats && (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{t("stats.noData")}</p>
            </CardContent>
          </Card>
        )
      )}

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
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input id={f.key} value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.key === "annee" ? "2025-2026" : ""} />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("dashboard.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.nom || !form.wilaya || !form.commune || !form.annee}>
              {saving ? "..." : t("dashboard.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
