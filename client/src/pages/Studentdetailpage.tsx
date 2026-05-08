import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Edit3, Save, X, Loader2 } from 'lucide-react';

interface Grade {
  id: string;
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  devoir: number | null;
  exam: number | null;
  average: number | null;
  trimester: number;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  registrationNo: string | null;
  level: string;
  className: string;
  generalAverage: number | null;
  status: string;
  grades: Grade[];
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ devoir: '', exam: '' });
  const [saving, setSaving] = useState(false);
  const [trimester, setTrimester] = useState(1);

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/students/${id}`);
      setStudent(res.data.student);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudent(); }, [id]);

  const startEdit = (grade: Grade) => {
    setEditingGrade(grade.id);
    setEditValues({
      devoir: grade.devoir?.toString() ?? '',
      exam: grade.exam?.toString() ?? '',
    });
  };

  const saveGrade = async (gradeId: string) => {
    setSaving(true);
    try {
      await api.put(`/students/${id}/grades/${gradeId}`, {
        devoir: editValues.devoir !== '' ? parseFloat(editValues.devoir) : null,
        exam: editValues.exam !== '' ? parseFloat(editValues.exam) : null,
      });
      setEditingGrade(null);
      fetchStudent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const filteredGrades = student?.grades.filter((g) => g.trimester === trimester) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-sky-500" />
      </div>
    );
  }

  if (!student) return <div className="p-6 text-slate-500">Élève introuvable</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/students" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-6 w-fit transition-colors">
        <ArrowLeft size={16} />
        Retour à la liste
      </Link>

      {/* Student header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {student.lastName} {student.firstName}
            </h1>
            {student.registrationNo && (
              <p className="text-slate-500 text-sm mt-1">N° d'inscription: {student.registrationNo}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium">
                {student.level}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                Classe {student.className}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${student.generalAverage !== null ? (student.generalAverage >= 10 ? 'text-emerald-500' : 'text-red-500') : 'text-slate-400'}`}>
              {student.generalAverage !== null ? `${student.generalAverage}/20` : '—'}
            </div>
            <p className="text-sm text-slate-500 mt-1">Moyenne générale</p>
            {student.status !== 'N/A' && (
              <span className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                {student.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trimester selector */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map((t) => (
          <button
            key={t}
            onClick={() => setTrimester(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              trimester === t
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Trimestre {t}
          </button>
        ))}
      </div>

      {/* Grades table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filteredGrades.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>Aucune note pour le trimestre {trimester}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Matière</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Coeff.</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Devoir (40%)</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Examen (60%)</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Moyenne</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredGrades.map((grade) => (
                <tr key={grade.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{grade.subjectName}</p>
                    <p className="text-xs text-slate-400">{grade.subjectCode}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{grade.coefficient}</td>
                  <td className="px-4 py-3 text-center">
                    {editingGrade === grade.id ? (
                      <input
                        type="number" min="0" max="20" step="0.25"
                        value={editValues.devoir}
                        onChange={(e) => setEditValues({ ...editValues, devoir: e.target.value })}
                        className="w-16 text-center border border-sky-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <span className={grade.devoir !== null ? 'text-slate-800' : 'text-slate-300'}>
                        {grade.devoir ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingGrade === grade.id ? (
                      <input
                        type="number" min="0" max="20" step="0.25"
                        value={editValues.exam}
                        onChange={(e) => setEditValues({ ...editValues, exam: e.target.value })}
                        className="w-16 text-center border border-sky-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <span className={grade.exam !== null ? 'text-slate-800' : 'text-slate-300'}>
                        {grade.exam ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${grade.average !== null ? (grade.average >= 10 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-300'}`}>
                      {grade.average?.toFixed(2) ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingGrade === grade.id ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => saveGrade(grade.id)} disabled={saving}
                          className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </button>
                        <button onClick={() => setEditingGrade(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(grade)}
                        className="p-1.5 hover:bg-sky-50 text-sky-500 rounded-lg transition-colors">
                        <Edit3 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}