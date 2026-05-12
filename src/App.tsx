import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { LeadsView, SalesView } from './components/Views';
import { SettingsView } from './components/SettingsView';
import { ImportView } from './components/ImportView';
import { AttributionView } from './components/AttributionView';
import { CapiEventsView } from './components/CapiEventsView';
import { ErrorsView } from './components/ErrorsView';
import { LoginView } from './components/LoginView';
import { Menu } from 'lucide-react';
import logoIcon from './assets/images/wentix_logo_icon.png';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('capi_token');
    if (!token) { setIsAuthenticated(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setIsAuthenticated(d.authenticated === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('capi_token');
    setIsAuthenticated(false);
    setCurrentView('dashboard');
  };

  if (isAuthenticated === null) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-b-2 border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setMobileOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':   return <DashboardView />;
      case 'leads':       return <LeadsView />;
      case 'sales':       return <SalesView />;
      case 'import':      return <ImportView />;
      case 'attribution': return <AttributionView />;
      case 'capi':        return <CapiEventsView />;
      case 'errors':      return <ErrorsView />;
      case 'settings':    return <SettingsView />;
      default:
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold">Vista en Desarrollo</h2>
            <p className="text-zinc-500">La vista "{currentView}" estará disponible pronto.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">

      {/* Overlay mobile — click para cerrar */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar: solo se renderiza si es desktop O si está abierto en mobile */}
      {(mobileOpen || window.innerWidth >= 768) && (
        <div className={`shrink-0 ${mobileOpen ? 'fixed inset-y-0 left-0 z-50' : 'relative'}`}>
          <Sidebar currentView={currentView} onViewChange={handleViewChange} onLogout={handleLogout} />
        </div>
      )}

      {/* Main content — ocupa todo el ancho en mobile */}
      <main className="flex-1 overflow-y-auto min-w-0 w-full">

        {/* Top bar solo en mobile */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="Wentix AI" className="h-6 w-6 object-contain" />
            <span className="text-sm font-black text-white uppercase tracking-widest">
              WENTIX <span className="text-blue-400">AI</span>
            </span>
          </div>
          <div className="w-8" />
        </div>

        {renderView()}
      </main>
    </div>
  );
}
