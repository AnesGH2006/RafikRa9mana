import React, { useState, useCallback } from "react";
import { GradeValues, LyceeFiliere, TrimNiveau } from "../grading/types";
import {
  calcStats,
  getBadgeCEM,
  getBadgeBAC,
  getBadgeTrimestre,
  getWorstSubjects,
  getTrimestreReco,
} from "../grading/utils";
import {
  CEM_SUBJECTS,
  MOYEN_SUBJECTS,
  LYCEE_SUBJECTS,
} from "../grading/constants";
import SubjectGrid from "../components/SubjectGrid";
import MetricsBar from "../components/MetricsBar";
import BreakdownTable from "../components/BreakdownTable";
import GradeBars from "../components/GradeBars";

type Tab = "cem" | "lycee" | "trimestre";

const LYCEE_FILIERES: { value: LyceeFiliere; label: string }[] = [
  { value: "science", label: "Sciences de la Nature (SNV)" },
  { value: "math", label: "Mathématiques" },
  { value: "technique", label: "Technique Math" },
  { value: "lettres", label: "Lettres & Sciences Humaines" },
  { value: "gestion", label: "Gestion & Économie" },
];

const GradingPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("cem");

  // CEM state
  const [cemValues, setCemValues] = useState<GradeValues>({});

  // Lycée state
  const [lyceeFiliere, setLyceeFiliere] = useState<LyceeFiliere>("science");
  const [lyceeValues, setLyceeValues] = useState<GradeValues>({});

  // Trimestre state
  const [trimNiveau, setTrimNiveau] = useState<TrimNiveau>("moyen");
  const [trimNum, setTrimNum] = useState<"1" | "2" | "3">("1");
  const [trimValues, setTrimValues] = useState<GradeValues>({});

  // Handlers
  const handleCemChange = useCallback((name: string, value: string) => {
    setCemValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleLyceeChange = useCallback((name: string, value: string) => {
    setLyceeValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleTrimChange = useCallback((name: string, value: string) => {
    setTrimValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFiliereChange = (f: LyceeFiliere) => {
    setLyceeFiliere(f);
    setLyceeValues({});
  };

  const handleNiveauChange = (n: TrimNiveau) => {
    setTrimNiveau(n);
    setTrimValues({});
  };

  // Computed
  const cemStats = calcStats(CEM_SUBJECTS, cemValues);
  const cemBadge = getBadgeCEM(parseFloat(cemStats.avg), cemStats.failCount);

  const lyceeSubs = LYCEE_SUBJECTS[lyceeFiliere];
  const lyceeStats = calcStats(lyceeSubs, lyceeValues);
  const lyceeBadge = getBadgeBAC(parseFloat(lyceeStats.avg), lyceeStats.failCount);

  const trimSubs = trimNiveau === "moyen" ? MOYEN_SUBJECTS : LYCEE_SUBJECTS["science"];
  const trimStats = calcStats(trimSubs, trimValues);
  const trimBadge = getBadgeTrimestre(parseFloat(trimStats.avg));
  const trimReco = getTrimestreReco(parseFloat(trimStats.avg));
  const worstSubs = getWorstSubjects(trimSubs, trimValues);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-2">
        Calcul de notes
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Système scolaire algérien — BEM, BAC, Bulletins trimestriels
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(["cem", "lycee", "trimestre"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t === "cem" && "CEM (BEM)"}
            {t === "lycee" && "Lycée (BAC)"}
            {t === "trimestre" && "Bulletin trimestriel"}
          </button>
        ))}
      </div>

      {/* CEM Panel */}
      {tab === "cem" && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Matières — BEM (Brevet d'Enseignement Moyen)
          </p>
          <SubjectGrid
            subjects={CEM_SUBJECTS}
            values={cemValues}
            onChange={handleCemChange}
          />
          <hr className="border-gray-200 dark:border-gray-700 my-4" />
          <MetricsBar stats={cemStats} badge={cemBadge} />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Détail par matière
          </p>
          <BreakdownTable subjects={CEM_SUBJECTS} values={cemValues} />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Répartition visuelle
          </p>
          <GradeBars subjects={CEM_SUBJECTS} values={cemValues} />
        </div>
      )}

      {/* Lycée Panel */}
      {tab === "lycee" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Filière
            </span>
            <select
              value={lyceeFiliere}
              onChange={(e) => handleFiliereChange(e.target.value as LyceeFiliere)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LYCEE_FILIERES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <SubjectGrid
            subjects={lyceeSubs}
            values={lyceeValues}
            onChange={handleLyceeChange}
          />
          <hr className="border-gray-200 dark:border-gray-700 my-4" />
          <MetricsBar stats={lyceeStats} badge={lyceeBadge} />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Détail par matière
          </p>
          <BreakdownTable subjects={lyceeSubs} values={lyceeValues} />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Répartition visuelle
          </p>
          <GradeBars subjects={lyceeSubs} values={lyceeValues} />
        </div>
      )}

      {/* Trimestre Panel */}
      {tab === "trimestre" && (
        <div>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Niveau
              </span>
              <select
                value={trimNiveau}
                onChange={(e) => handleNiveauChange(e.target.value as TrimNiveau)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="moyen">Moyen (CEM)</option>
                <option value="lycee">Lycée</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Trimestre
              </span>
              <select
                value={trimNum}
                onChange={(e) => setTrimNum(e.target.value as "1" | "2" | "3")}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1er trimestre</option>
                <option value="2">2ème trimestre</option>
                <option value="3">3ème trimestre</option>
              </select>
            </div>
          </div>

          <SubjectGrid
            subjects={trimSubs}
            values={trimValues}
            onChange={handleTrimChange}
          />
          <hr className="border-gray-200 dark:border-gray-700 my-4" />
          <MetricsBar stats={trimStats} badge={trimBadge} />

          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Recommandations
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            <p>{trimReco}</p>
            {worstSubs.length > 0 && (
              <p className="mt-2">
                Matières prioritaires à améliorer :{" "}
                {worstSubs.map((s) => (
                  <span
                    key={s.name}
                    className="inline-block mr-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  >
                    {s.name}
                  </span>
                ))}
              </p>
            )}
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
            Répartition visuelle
          </p>
          <GradeBars subjects={trimSubs} values={trimValues} />
        </div>
      )}
    </div>
  );
};

export default GradingPage;