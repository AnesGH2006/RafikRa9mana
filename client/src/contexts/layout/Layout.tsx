import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Upload, CreditCard,
  LogOut, GraduationCap, ChevronRight, Zap
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/students', icon: Users, label: 'Élèves & Notes' },
  { to: '/upload', icon: Upload, label: 'Importer Excel' },
  { to: '/pricing', icon: CreditCard, label: 'Abonnement' },
];

export default function Layout() {
  const { school, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const uploadPct = school ? Math.round((school.uploadCount / school.uploadLimit) * 100) : 0;

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col text-white shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">CEM Grade</h1>
              <p className="text-slate-400 text-xs">Gestion des notes</p>
            </div>
          </div>
        </div>

        {/* School info */}
        <div className="px-4 py-3 mx-3 mt-3 bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-400 mb-0.5">Établissement</p>
          <p className="text-sm font-semibold text-white truncate">{school?.name}</p>
          <p className="text-xs text-slate-400">{school?.wilaya} · {school?.code}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                  isActive
                    ? 'bg-sky-500 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Plan usage */}
        <div className="px-4 py-3 mx-3 mb-3 bg-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap size={13} className={school?.plan === 'FREE' ? 'text-amber-400' : 'text-emerald-400'} />
              <span className="text-xs font-medium text-slate-300">
                Plan {school?.plan === 'FREE' ? 'Gratuit' : school?.plan === 'BASIC' ? 'Basique' : 'Pro'}
              </span>
            </div>
            <span className="text-xs text-slate-400">{school?.uploadCount}/{school?.uploadLimit}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${uploadPct >= 80 ? 'bg-red-400' : 'bg-sky-500'}`}
              style={{ width: `${Math.min(uploadPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">importations ce mois</p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-6 py-4 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border-t border-slate-700/50 text-sm"
        >
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}