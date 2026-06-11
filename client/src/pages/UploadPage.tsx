import { useState, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle,
  Download, Loader2, History, X, ChevronDown,
  TrendingUp, Users, Award, AlertTriangle
} from 'lucide-react';

const LEVELS = ['AM1', 'AM2', 'AM3', 'AM4'];

interface SubjectGrades {
  [key: string]: number;
}

interface Student {
  name: string;
  subjects: SubjectGrades;
  average: number;
  passed: boolean;
  rank: number;
}

interface Summary {
  classAverage: number;
  highestAverage: number;
  lowestAverage: number;
  passRate: number;
  passCount: number;
  failCount: number;
  topStudent: string;
  weakestStudent: string;
}

interface GradeResult {
  students: Student[];
  summary: Summary;
  fileName: string;
  totalStudents: number;
  schoolMode: string;
  subjects: string[];
}

interface UploadHistory {
  id: string;
  originalName: string;
  studentsCount: number;
  level: string;
  className: string;
  trimester: number;
  createdAt: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  arabic:     'اللغة العربية',
  french:     'اللغة الفرنسية',
  math:       'الرياضيات',
  science:    'علوم الطبيعة',
  islamic:    'التربية الإسلامية',
  history:    'التاريخ والجغرافيا',
  physics:    'الفيزياء والكيمياء',
  english:    'اللغة الإنجليزية',
  philosophy: 'الفلسفة',
};

const TRIMESTER_LABELS: Record<string, string> = {
  '1': 'الفصل الأول',
  '2': 'الفصل الثاني',
  '3': 'الفصل الثالث',
};

function getGradeColor(avg: number): string {
  if (avg >= 16) return '#10b981';
  if (avg >= 14) return '#3b82f6';
  if (avg >= 10) return '#f59e0b';
  return '#ef4444';
}

function getGradeBg(avg: number): string {
  if (avg >= 16) return 'rgba(16,185,129,.12)';
  if (avg >= 14) return 'rgba(59,130,246,.12)';
  if (avg >= 10) return 'rgba(245,158,11,.12)';
  return 'rgba(239,68,68,.12)';
}

export default function UploadPage() {
  const [file, setFile]             = useState<File | null>(null);
  const [level, setLevel]           = useState('AM1');
  const [className, setClassName]   = useState('');
  const [trimester, setTrimester]   = useState('1');
  const [schoolYear]                = useState('2024-2025');
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState<GradeResult | null>(null);
  const [error, setError]           = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory]       = useState<UploadHistory[]>([]);
  const [activeTab, setActiveTab]   = useState<'upload' | 'results'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/upload/history').then((r) => setHistory(r.data.uploads)).catch(() => {});
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f); setResult(null); setError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(''); }
  };

  const handleUpload = async () => {
    if (!file || !level || !className) {
      setError('يرجى تحديد ملف، المستوى، والقسم.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);
    formData.append('className', className);
    formData.append('trimester', trimester);
    formData.append('schoolYear', schoolYear);

    setUploading(true); setError(''); setResult(null);
    try {
      const res = await api.post('/grades/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setActiveTab('results');
      api.get('/upload/history').then((r) => setHistory(r.data.uploads)).catch(() => {});
    } catch (err: any) {
      const msg = err.response?.data?.error || 'حدث خطأ أثناء الاستيراد';
      setError(err.response?.data?.upgradeRequired
        ? msg + ' — انتقل إلى صفحة الاشتراك للترقية إلى Pro.'
        : msg);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => window.open(`/api/upload/template/${level}`, '_blank');

  // ─── styles ───────────────────────────────────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    page:      { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif", direction: 'rtl', padding: '24px' },
    container: { maxWidth: 1100, margin: '0 auto' },

    // header
    header:    { marginBottom: 24 },
    breadcrumb:{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8', marginBottom: 8 },
    sep:       { color: '#475569' },
    title:     { fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 },
    subtitle:  { fontSize: 13, color: '#64748b', marginTop: 4 },

    // tabs
    tabs:      { display: 'flex', gap: 4, marginBottom: 20, background: '#161b27', border: '1px solid #2a3448', borderRadius: 10, padding: 4, width: 'fit-content' },
    tab:       { padding: '7px 20px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 500, border: 'none', transition: 'all .15s', fontFamily: 'inherit' },
    tabActive: { background: '#10b981', color: '#fff' },
    tabInact:  { background: 'transparent', color: '#94a3b8' },

    // cards
    card:      { background: '#161b27', border: '1px solid #2a3448', borderRadius: 12, padding: 20 },
    cardTitle: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },

    // grid
    grid2:     { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 },
    grid2col:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

    // form
    label:     { display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
    input:     { width: '100%', background: '#1e2535', border: '1px solid #2a3448', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
    select:    { width: '100%', background: '#1e2535', border: '1px solid #2a3448', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', cursor: 'pointer' },

    // dropzone
    dropzone:  { border: '2px dashed #2a3448', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', marginBottom: 0 },
    dropActive:{ border: '2px dashed #3b82f6', background: 'rgba(59,130,246,.05)' },
    dropFile:  { border: '2px dashed #10b981', background: 'rgba(16,185,129,.05)' },

    // btn
    btnPrimary:{ width: '100%', background: '#10b981', border: 'none', color: '#fff', fontWeight: 600, padding: '12px 0', borderRadius: 10, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'all .15s' },
    btnSecond: { width: '100%', background: '#1e2535', border: '1px solid #2a3448', color: '#94a3b8', fontWeight: 500, padding: '10px 0', borderRadius: 10, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'all .15s' },

    // alerts
    alertErr:  { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, fontSize: 13, color: '#fca5a5' },
    alertOk:   { padding: '12px 14px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10 },

    // summary cards
    sumGrid:   { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 },
    sumCard:   { background: '#161b27', border: '1px solid #2a3448', borderRadius: 10, padding: '14px 16px' },
    sumLabel:  { fontSize: 11, color: '#64748b', marginBottom: 4 },
    sumVal:    { fontSize: 24, fontWeight: 700 },

    // table
    tableWrap: { background: '#161b27', border: '1px solid #2a3448', borderRadius: 10, overflow: 'hidden' },
    th:        { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', background: '#1e2535', textAlign: 'right' as const, whiteSpace: 'nowrap' as const },
    td:        { padding: '10px 14px', fontSize: 12, color: '#e2e8f0', borderBottom: '1px solid #1e2535', textAlign: 'right' as const, whiteSpace: 'nowrap' as const },

    // history
    histItem:  { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #1e2535' },
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.breadcrumb}>
            <span>لوحة التحكم</span>
            <span style={s.sep}>›</span>
            <span style={{ color: '#e2e8f0' }}>استيراد النتائج</span>
          </div>
          <h1 style={s.title}>استيراد النتائج</h1>
          <p style={s.subtitle}>استيراد ملف Excel بنقاط التلاميذ وتحليلها تلقائياً</p>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(activeTab === 'upload' ? s.tabActive : s.tabInact) }}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={14} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
            استيراد الملف
          </button>
          <button
            style={{ ...s.tab, ...(activeTab === 'results' ? s.tabActive : s.tabInact), opacity: result ? 1 : 0.4, cursor: result ? 'pointer' : 'not-allowed' }}
            onClick={() => result && setActiveTab('results')}
          >
            <TrendingUp size={14} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
            النتائج {result && `(${result.totalStudents})`}
          </button>
        </div>

        {/* ── TAB: UPLOAD ── */}
        {activeTab === 'upload' && (
          <div style={s.grid2}>
            {/* Left: form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Config */}
              <div style={s.card}>
                <div style={s.cardTitle}>
                  <span style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚙</span>
                  إعداد الاستيراد
                </div>
                <div style={s.grid2col}>
                  <div>
                    <label style={s.label}>المستوى</label>
                    <select style={s.select} value={level} onChange={e => setLevel(e.target.value)}>
                      {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>القسم</label>
                    <input style={s.input} value={className} onChange={e => setClassName(e.target.value)} placeholder="مثال: أ، ب، 1، 2..." />
                  </div>
                  <div>
                    <label style={s.label}>الفصل الدراسي</label>
                    <select style={s.select} value={trimester} onChange={e => setTrimester(e.target.value)}>
                      {Object.entries(TRIMESTER_LABELS).map(([v, lbl]) => (
                        <option key={v} value={v}>{lbl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>السنة الدراسية</label>
                    <input style={{ ...s.input, background: '#1a1f2e', color: '#64748b', cursor: 'not-allowed' }} value={schoolYear} disabled />
                  </div>
                </div>
              </div>

              {/* Dropzone */}
              <div
                style={{ ...s.dropzone, ...(isDragging ? s.dropActive : {}), ...(file ? s.dropFile : {}) }}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileSpreadsheet size={26} color="#10b981" />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: '#10b981', margin: 0 }}>{file.name}</p>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{(file.size / 1024).toFixed(1)} KB — انقر للتغيير</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                      <X size={12} /> إزالة
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1e2535', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={24} color="#475569" />
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: '#94a3b8', margin: 0 }}>اسحب وأفلت ملف Excel هنا</p>
                      <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>أو انقر للاختيار</p>
                    </div>
                    <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>.xlsx أو .xls — الحجم الأقصى 10MB</p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={s.alertErr}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#f87171' }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Upload btn */}
              <button
                style={{ ...s.btnPrimary, opacity: uploading || !file ? 0.5 : 1, cursor: uploading || !file ? 'not-allowed' : 'pointer' }}
                onClick={handleUpload}
                disabled={uploading || !file}
              >
                {uploading
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> جارٍ الاستيراد...</>
                  : <><Upload size={16} /> استيراد النتائج</>
                }
              </button>
            </div>

            {/* Right: sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Template download */}
              <div style={s.card}>
                <div style={s.cardTitle}>
                  <Download size={16} color="#3b82f6" />
                  نموذج Excel
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>حمّل النموذج للمستوى المحدد مع الأعمدة الصحيحة</p>
                <button style={{ ...s.btnSecond }} onClick={downloadTemplate}>
                  <Download size={14} />
                  نموذج {level}
                </button>
              </div>

              {/* Format guide */}
              <div style={{ ...s.card, background: '#12171f' }}>
                <div style={s.cardTitle}>
                  📋 الصيغة المطلوبة
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['اسم', 'عمود الاسم الكامل للتلميذ'],
                    ['CODE_D', 'درجة الفرض'],
                    ['CODE_E', 'درجة الامتحان'],
                    ['0–20', 'النقاط بين 0 و 20'],
                    ['صف واحد', 'سطر لكل تلميذ'],
                  ].map(([key, desc]) => (
                    <li key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ background: '#1e2535', border: '1px solid #2a3448', borderRadius: 4, padding: '1px 7px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>{key}</span>
                      <span style={{ color: '#64748b' }}>{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div style={s.card}>
                  <div style={s.cardTitle}>
                    <History size={15} color="#64748b" />
                    آخر الاستيرادات
                  </div>
                  <div>
                    {history.slice(0, 5).map((h, i) => (
                      <div key={h.id} style={{ ...s.histItem, ...(i === history.slice(0,5).length - 1 ? { borderBottom: 'none' } : {}) }}>
                        <div style={{ width: 30, height: 30, borderRadius: 6, background: '#1e2535', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileSpreadsheet size={14} color="#475569" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.originalName}</p>
                          <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
                            {h.level} {h.className} · الفصل {h.trimester} · {h.studentsCount} تلميذ
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: RESULTS ── */}
        {activeTab === 'results' && result && (
          <div>
            {/* Summary cards */}
            <div style={s.sumGrid}>
              <div style={s.sumCard}>
                <div style={s.sumLabel}>إجمالي التلاميذ</div>
                <div style={{ ...s.sumVal, color: '#e2e8f0' }}>{result.totalStudents}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{result.fileName}</div>
              </div>
              <div style={s.sumCard}>
                <div style={s.sumLabel}>معدل القسم</div>
                <div style={{ ...s.sumVal, color: getGradeColor(result.summary.classAverage) }}>
                  {result.summary.classAverage.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>من 20</div>
              </div>
              <div style={{ ...s.sumCard, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)' }}>
                <div style={{ ...s.sumLabel, color: '#34d399' }}>الناجحون</div>
                <div style={{ ...s.sumVal, color: '#10b981' }}>{result.summary.passCount}</div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>نسبة: {result.summary.passRate}%</div>
              </div>
              <div style={{ ...s.sumCard, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
                <div style={{ ...s.sumLabel, color: '#fca5a5' }}>الراسبون</div>
                <div style={{ ...s.sumVal, color: '#ef4444' }}>{result.summary.failCount}</div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
                  نسبة: {(100 - result.summary.passRate).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Top/Weak + ranges row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245,158,11,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={18} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>الأول</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{result.summary.topStudent}</div>
                  <div style={{ fontSize: 11, color: '#f59e0b' }}>{result.summary.highestAverage.toFixed(2)} / 20</div>
                </div>
              </div>
              <div style={{ ...s.card, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={18} color="#ef4444" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>الأدنى</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{result.summary.weakestStudent}</div>
                  <div style={{ fontSize: 11, color: '#ef4444' }}>{result.summary.lowestAverage.toFixed(2)} / 20</div>
                </div>
              </div>
              <div style={{ ...s.card, textAlign: 'center' as const }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>أعلى معدل</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#10b981' }}>{result.summary.highestAverage.toFixed(2)}</div>
              </div>
              <div style={{ ...s.card, textAlign: 'center' as const }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>أدنى معدل</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{result.summary.lowestAverage.toFixed(2)}</div>
              </div>
            </div>

            {/* Pass rate bar */}
            <div style={{ ...s.card, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>نسبة النجاح</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{result.summary.passRate}%</span>
              </div>
              <div style={{ height: 10, background: '#1e2535', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${result.summary.passRate}%`, background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 5, transition: 'width .8s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#475569' }}>
                <span>ناجح: {result.summary.passCount}</span>
                <span>راسب: {result.summary.failCount}</span>
              </div>
            </div>

            {/* Students table */}
            <div style={s.tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>اسم التلميذ</th>
                    {result.subjects.map(subj => (
                      <th key={subj} style={s.th}>{SUBJECT_LABELS[subj] ?? subj}</th>
                    ))}
                    <th style={s.th}>المعدل</th>
                    <th style={s.th}>الترتيب</th>
                    <th style={s.th}>القرار</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((student, i) => (
                    <tr key={i} style={{ transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e2535')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...s.td, color: '#475569', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ ...s.td, fontWeight: 500 }}>{student.name}</td>
                      {result.subjects.map(subj => (
                        <td key={subj} style={{ ...s.td, color: student.subjects[subj] >= 10 ? '#a7f3d0' : '#fca5a5', textAlign: 'center' as const }}>
                          {student.subjects[subj]?.toFixed(2) ?? '—'}
                        </td>
                      ))}
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        <span style={{ background: getGradeBg(student.average), color: getGradeColor(student.average), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {student.average.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const, color: '#64748b', fontSize: 12 }}>
                        {student.rank}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' as const }}>
                        <span style={{
                          background: student.passed ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                          color: student.passed ? '#10b981' : '#ef4444',
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500
                        }}>
                          {student.passed ? 'ناجح' : 'راسب'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Back btn */}
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button style={{ ...s.btnSecond, width: 'auto', padding: '10px 20px' }} onClick={() => setActiveTab('upload')}>
                <Upload size={14} /> استيراد ملف جديد
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}