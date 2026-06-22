import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, XCircle, Clock, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL;

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active:    { label: "نشط",    color: "text-emerald-500", icon: CheckCircle2 },
  pending:   { label: "معلّق",  color: "text-amber-500",   icon: Clock },
  suspended: { label: "موقوف", color: "text-red-500",     icon: XCircle },
};

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/admin/users`, { credentials: "include" });
      if (res.ok) setUsers(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id: string, subscriptionStatus: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`${BASE}api/admin/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionStatus }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, subscriptionStatus } : u));
      }
    } finally { setUpdating(null); }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh] text-center p-8">
        <div>
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">هذه الصفحة للمسؤولين فقط</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter(u =>
    !search || (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div className="p-6 max-w-5xl mx-auto space-y-6"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Shield className="w-5 h-5 text-white" />
            </span>
            لوحة الإدارة
          </h1>
          <p className="text-xs text-muted-foreground mt-1 ms-11">إدارة حسابات المستخدمين والاشتراكات</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي", value: users.length, color: "from-blue-500 to-indigo-600" },
          { label: "نشط",    value: users.filter(u => u.subscriptionStatus === "active").length, color: "from-emerald-500 to-green-600" },
          { label: "معلّق",  value: users.filter(u => u.subscriptionStatus === "pending").length, color: "from-amber-500 to-orange-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="border-0 shadow-md overflow-hidden">
              <div className={`bg-gradient-to-br ${s.color} p-4`}>
                <p className="text-white/70 text-xs">{s.label}</p>
                <p className="text-3xl font-extrabold text-white">{s.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بالإيميل أو الاسم..."
          className="w-full ps-9 pe-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Users table */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">المستخدمون ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : (
            <div className="divide-y">
              {filtered.map(u => {
                const cfg = STATUS_CONFIG[u.subscriptionStatus] || STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                return (
                  <motion.div key={u.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {u.subscriptionStatus !== "active" && (
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          disabled={updating === u.id}
                          onClick={() => updateStatus(u.id, "active")}>
                          تفعيل
                        </Button>
                      )}
                      {u.subscriptionStatus !== "pending" && (
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          disabled={updating === u.id}
                          onClick={() => updateStatus(u.id, "pending")}>
                          تعليق
                        </Button>
                      )}
                      {u.subscriptionStatus !== "suspended" && (
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                          disabled={updating === u.id}
                          onClick={() => updateStatus(u.id, "suspended")}>
                          إيقاف
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {!filtered.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">لا توجد نتائج</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
