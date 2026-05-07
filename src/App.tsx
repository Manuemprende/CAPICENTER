import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { LeadsView, SalesView } from './components/Views';
import { SettingsView } from './components/SettingsView';
import { ImportView } from './components/ImportView';
import { AttributionView } from './components/AttributionView';
import { CapiEventsView } from './components/CapiEventsView';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'leads':
        return <LeadsView />;
      case 'sales':
        return <SalesView />;
      case 'import':
        return <ImportView />;
      case 'attribution':
        return <AttributionView />;
      case 'capi':
        return <CapiEventsView />;
      case 'settings':
        return <SettingsView />;
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
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}
