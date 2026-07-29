/**
 * Members Page — Head-Admin only
 * Manage teacher and parent sub-accounts for the school.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, UserPlus, Trash2, Pencil, GraduationCap,
  UserCheck, AlertCircle, BookOpen, Link2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

interface Member {
  id: string;
  schoolUserId: string;
  memberUserId: string | null;
  role: "teacher" | "parent";
  name: string;
  email: string | null;
  phone: string | null;
  assignedClasses: string[];
  linkedStudentId: string | null;
  createdAt: string;
}

interface Student {
  id: string;
  nomPrenom: string;
  niveau: string;
  classe: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const EMPTY_FORM = {
  role: "teacher" as "teacher" | "parent",
  name: "",
  email: "",
  phone: "",
  assignedClasses: "",
  linkedStudentId: "",
};

export default function MembersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load members + students
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}api/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${BASE}api/students?limit=500`, { credentials: "include" }).then(r => r.json()),
    ]).then(([mem, stu]) => {
      setMembers(Array.isArray(mem) ? mem : []);
      setStudents(Array.isArray(stu?.students) ? stu.students : Array.isArray(stu) ? stu : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      role: m.role,
      name: m.name,
      email: m.email ?? "",
      phone: m.phone ?? "",
      assignedClasses: (m.assignedClasses ?? []).join(", "),
      linkedStudentId: m.linkedStudentId ?? "",
    });
    setDialogOpen(true);
  }

  async function saveMember() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      role: form.role,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      assignedClasses: form.role === "teacher"
        ? form.assignedClasses.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      linkedStudentId: form.role === "parent" ? (form.linkedStudentId || null) : null,
    };
    try {
      const url = editing ? `${BASE}api/members/${editing.id}` : `${BASE}api/members`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      if (editing) {
        setMembers(prev => prev.map(m => m.id === saved.id ? saved : m));
      } else {
        setMembers(prev => [...prev, saved]);
      }
      toast({ description: t("members.saved") });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(id: string) {
    try {
      const res = await fetch(`${BASE}api/members/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setMembers(prev => prev.filter(m => m.id !== id));
      toast({ description: t("members.deleted") });
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setDeleteId(null);
    }
  }

  const teachers = members.filter(m => m.role === "teacher");
  const parents  = members.filter(m => m.role === "parent");

  function studentName(id: string | null) {
    if (!id) return "—";
    return students.find(s => s.id === id)?.nomPrenom ?? id;
  }

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate"
      className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
              <Users className="w-5 h-5 text-white" />
            </span>
            {t("members.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("members.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <UserPlus className="w-4 h-4" />
          {t("members.add")}
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40 p-3 text-xs text-blue-700 dark:text-blue-400">
        <Link2 className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{t("members.linked_hint")}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground text-sm">جارٍ التحميل...</div>
      ) : (
        <div className="space-y-6">
          {/* Teachers */}
          <Section
            icon={<GraduationCap className="w-4 h-4 text-violet-500" />}
            title={`${t("members.teacher")}s (${teachers.length})`}
            color="border-violet-200 bg-violet-50/40 dark:bg-violet-950/20"
          >
            {teachers.length === 0 ? (
              <EmptyState label={t("members.none")} />
            ) : (
              teachers.map(m => (
                <MemberCard
                  key={m.id}
                  member={m}
                  extra={m.assignedClasses?.length
                    ? `${t("members.classes")}: ${m.assignedClasses.join(" · ")}`
                    : undefined}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeleteId(m.id)}
                />
              ))
            )}
          </Section>

          {/* Parents */}
          <Section
            icon={<UserCheck className="w-4 h-4 text-emerald-500" />}
            title={`${t("members.parent")}s (${parents.length})`}
            color="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20"
          >
            {parents.length === 0 ? (
              <EmptyState label={t("members.none")} />
            ) : (
              parents.map(m => (
                <MemberCard
                  key={m.id}
                  member={m}
                  extra={m.linkedStudentId
                    ? `${t("members.student")}: ${studentName(m.linkedStudentId)}`
                    : undefined}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeleteId(m.id)}
                />
              ))
            )}
          </Section>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `تعديل: ${editing.name}` : t("members.add")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Role (only when adding) */}
            {!editing && (
              <div className="space-y-1.5">
                <Label>{t("members.role")}</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">
                      <span className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-violet-500" />{t("members.teacher")}</span>
                    </SelectItem>
                    <SelectItem value="parent">
                      <span className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-500" />{t("members.parent")}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label>{t("members.name")} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="…" />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label>{t("members.email")}</Label>
              <Input value={form.email} type="email" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" dir="ltr" />
              <p className="text-xs text-muted-foreground">{t("members.linked_hint")}</p>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label>{t("members.phone")}</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" dir="ltr" />
            </div>

            {/* Teacher: assigned classes */}
            {form.role === "teacher" && (
              <div className="space-y-1.5">
                <Label>{t("members.classes")}</Label>
                <Input
                  value={form.assignedClasses}
                  onChange={e => setForm(f => ({ ...f, assignedClasses: e.target.value }))}
                  placeholder="1AM A, 2AM B"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">{t("members.class_hint")}</p>
              </div>
            )}

            {/* Parent: linked student */}
            {form.role === "parent" && (
              <div className="space-y-1.5">
                <Label>{t("members.student")}</Label>
                <Select value={form.linkedStudentId} onValueChange={v => setForm(f => ({ ...f, linkedStudentId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التلميذ…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nomPrenom} — {s.niveau} {s.classe}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={saveMember} disabled={saving || !form.name.trim()}>
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              {t("members.delete_confirm")}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMember(deleteId)}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ icon, title, color, children }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`border shadow-sm ${color}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-4">{label}</p>
  );
}

function MemberCard({ member, extra, onEdit, onDelete }: {
  member: Member;
  extra?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{member.name}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {member.memberUserId ? t("members.status_linked") : t("members.status_pending")}
          </Badge>
        </div>
        {member.email && (
          <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{member.email}</p>
        )}
        {extra && (
          <p className="text-xs text-muted-foreground mt-0.5">{extra}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
