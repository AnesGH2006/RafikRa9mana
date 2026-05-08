import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Check, Zap, Loader2, Crown } from 'lucide-react';

const PLANS = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0',
    period: 'toujours gratuit',
    color: 'slate',
    features: [
      '3 importations par mois',
      'Tableau de bord basique',
      'Export PDF',
      '1 établissement',
    ],
  },
  {
    id: 'BASIC',
    name: 'Basique',
    price: '1 500',
    period: 'DA / mois',
    color: 'sky',
    badge: 'Populaire',
    features: [
      '20 importations par mois',
      'Tous les niveaux (1AM-4AM)',
      'Export PDF avancé',
      'Filtres et rapports',
      'Support email',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '3 500',
    period: 'DA / mois',
    color: 'violet',
    badge: 'Meilleur',
    features: [
      'Importations illimitées',
      'Tous les niveaux (1AM-4AM)',
      'Export PDF avancé',
      'Rapports détaillés',
      'Statistiques avancées',
      'Support prioritaire',
    ],
  },
];

export default function PricingPage() {
  const { school, refreshMe } = useAuth();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    if (planId === school?.plan) return;
    if (!confirm(`Passer au plan ${planId} ?`)) return;

    setUpgrading(planId);
    try {
      await api.post('/subscription/upgrade', { plan: planId });
      await refreshMe();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à niveau');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Abonnement</h1>
        <p className="text-slate-500 text-sm mt-1">
          Plan actuel: <span className="font-semibold text-sky-600">{school?.plan}</span>
          {' · '}{school?.uploadCount}/{school?.uploadLimit} importations utilisées ce mois
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {PLANS.map((plan) => {
          const isCurrent = school?.plan === plan.id;
          const isUpgrade = ['FREE', 'BASIC', 'PRO'].indexOf(plan.id) > ['FREE', 'BASIC', 'PRO'].indexOf(school?.plan || 'FREE');

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                isCurrent ? 'border-sky-400 shadow-sky-100' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-white text-xs font-bold rounded-full">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  {plan.id === 'PRO' && <Crown size={16} className="text-violet-500" />}
                  {plan.id === 'BASIC' && <Zap size={16} className="text-sky-500" />}
                  <h3 className="font-bold text-slate-800">{plan.name}</h3>
                  {isCurrent && (
                    <span className="ml-auto px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded-full font-medium">
                      Actuel
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-bold text-slate-800">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || upgrading !== null}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-slate-50 text-slate-400 cursor-default border border-slate-200'
                    : isUpgrade
                    ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {upgrading === plan.id && <Loader2 size={15} className="animate-spin" />}
                {isCurrent ? 'Plan actuel' : isUpgrade ? 'Passer à ce plan' : 'Rétrograder'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <p className="text-sm text-amber-700">
          <strong>⚠️ Mode démo</strong> — Aucun paiement réel n'est requis. Les plans sont simulés à des fins de démonstration.
        </p>
      </div>
    </div>
  );
}