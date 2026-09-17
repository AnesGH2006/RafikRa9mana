import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Play } from "lucide-react";

interface SyncResult {
  class_id: string;
  trimester: number;
  total_records: number;
  validated_records: number;
  flagged_errors: number;
  sync_status: "pending" | "in_progress" | "completed" | "failed";
  timestamp: string;
}

export function MinistryGradePanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [classId, setClassId] = useState("1AM1");
  const [trimestre, setTrimestre] = useState("1");
  const [tharwaUsername, setTharwaUsername] = useState("");
  const [tharwaPassword, setTharwaPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSync = async () => {
    if (!tharwaUsername || !tharwaPassword) {
      alert("Please enter Tharwa credentials");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/api/ministry-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          trimestre: parseInt(trimestre),
          annee: "2025-2026",
          tharwaUsername,
          tharwaPassword,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.sync_status === "completed") {
        alert(
          `✅ Sync complete!\n\nValid: ${data.validated_records.length}\nErrors: ${data.flagged_errors.length}`
        );
      } else {
        alert(`❌ Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          وزارة التعليم - وكيل الدرجات 📊
        </h2>
        <p className="text-slate-400 text-sm">
          مزامنة تلقائية آمنة للدرجات مع منصة الرقمنة
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Class Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            الفصل / القسم
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
          >
            <option>1AM1</option>
            <option>1AM2</option>
            <option>2AM1</option>
            <option>2AM2</option>
            <option>3AM1</option>
            <option>3AM2</option>
          </select>
        </div>

        {/* Trimester Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            الفصل الدراسي
          </label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
          >
            <option value="1">الفصل الأول</option>
            <option value="2">الفصل الثاني</option>
            <option value="3">الفصل الثالث</option>
          </select>
        </div>

        {/* Tharwa Credentials */}
        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 mb-3">
            ⚠️ بيانات تسجيل الدخول بثروة (لن تُحفظ)
          </p>

          <input
            type="text"
            placeholder="اسم المستخدم"
            value={tharwaUsername}
            onChange={(e) => setTharwaUsername(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-slate-600 border border-slate-500 text-white mb-2 placeholder-slate-400"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="كلمة المرور"
              value={tharwaPassword}
              onChange={(e) => setTharwaPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg bg-slate-600 border border-slate-500 text-white placeholder-slate-400"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
            >
              {showPassword ? "إخفاء" : "عرض"}
            </button>
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.sync_status === "completed"
              ? "bg-emerald-900/30 border-emerald-500/50"
              : "bg-red-900/30 border-red-500/50"
          }`}
        >
          <div className="flex gap-3 mb-2">
            {result.sync_status === "completed" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={`font-semibold ${
                  result.sync_status === "completed"
                    ? "text-emerald-200"
                    : "text-red-200"
                }`}
              >
                {result.sync_status === "completed"
                  ? "✅ تمت المزامنة بنجاح"
                  : "❌ فشلت المزامنة"}
              </p>
              <div className="mt-2 text-sm space-y-1">
                <p>📊 إجمالي السجلات: {result.total_records}</p>
                <p className="text-emerald-300">
                  ✅ سجلات صحيحة: {result.validated_records}
                </p>
                <p className="text-red-300">
                  ❌ أخطاء: {result.flagged_errors}
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  {new Date(result.timestamp).toLocaleString("ar-DZ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleSync}
        disabled={loading}
        className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري المزامنة...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            بدء مزامنة الدرجات
          </>
        )}
      </button>

      {/* Info */}
      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 text-xs text-slate-300">
        <p className="mb-2 font-semibold">ℹ️ كيفية الاستخدام:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>اختر الفصل والفصل الدراسي</li>
          <li>أدخل بيانات تسجيل الدخول بثروة</li>
          <li>اضغط "بدء المزامنة"</li>
          <li>سيتم إدخال الدرجات الصحيحة تلقائياً</li>
        </ol>
      </div>
    </div>
  );
}