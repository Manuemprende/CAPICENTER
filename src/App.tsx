import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { LeadsView, SalesView } from './components/Views';
import { SettingsView } from './components/SettingsView';
import { ImportView } from './components/ImportView';
import { AttributionView } from './components/AttributionView';
import { CapiEventsView } from './components/CapiEventsView';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

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

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: normal | mobile: drawer */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:relative md:flex
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-white p-1"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-black text-white uppercase tracking-widest">
            WENTIX <span className="text-blue-400">AI</span>
          </span>
        </div>

        {renderView()}
      </main>
    </div>
  );
}
