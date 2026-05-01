import React, { useState } from 'react';
import { LayoutDashboard, Users, ShoppingCart, Target, Send, AlertCircle, Settings, LogOut, FileUp, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads WhatsApp', icon: Users },
  { id: 'sales', label: 'Ventas', icon: ShoppingCart },
  { id: 'import', label: 'Importar Excel', icon: FileUp },
  { id: 'attribution', label: 'Atribución', icon: Target },
  { id: 'capi', label: 'Eventos CAPI', icon: Send },
  { id: 'errors', label: 'Errores', icon: AlertCircle },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      className="border-r border-white/5 flex flex-col bg-slate-950/40 backdrop-blur-3xl h-screen shrink-0 overflow-hidden relative z-50"
    >
      {/* Glow Effect */}
      <div className="absolute -left-20 top-0 w-40 h-40 bg-blue-600/10 blur-[100px] pointer-events-none" />
      
      {/* Header / Clickable Logo Trigger */}
      <div className={cn("p-6 flex items-center relative transition-all duration-300", isCollapsed ? "px-0 pb-4 justify-center" : "gap-3")}>
        <div 
          className="relative group shrink-0 cursor-pointer transition-transform active:scale-90"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expandir Menú" : "Contraer Menú"}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-blue-400 rounded-2xl blur opacity-20 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-blue-400/50 transition-colors">
            <img 
              src="/src/assets/images/wentix_logo_1777619758544.png" 
              alt="Logo" 
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
            />
          </div>
        </div>
        {!isCollapsed && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col overflow-hidden"
          >
            <h1 className="font-cyber font-black text-lg tracking-tighter leading-none text-white whitespace-nowrap italic uppercase">WENTIX <span className="text-blue-400 not-italic">AI</span></h1>
            <span className="text-[8px] text-blue-400/40 uppercase tracking-[0.4em] font-black mt-1 opacity-80 whitespace-nowrap">Centro de Control</span>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-2 space-y-1 relative overflow-y-auto scrollbar-none", 
        isCollapsed ? "px-2" : "px-4"
      )}>
        {!isCollapsed && <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] px-2 mb-4 whitespace-nowrap opacity-50">Interfaz Principal</p>}
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full transition-all py-5 text-xs font-bold rounded-xl border border-transparent group relative",
              isCollapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
              currentView === item.id 
                ? "bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.05)]" 
                : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
            )}
            onClick={() => onViewChange(item.id)}
            title={isCollapsed ? item.label : undefined}
          >
            {currentView === item.id && (
              <motion.div 
                layoutId="active-pill"
                className="absolute left-0 w-1 h-5 bg-blue-400 rounded-r-full shadow-[2px_0_10px_rgba(59,130,246,0.5)]" 
              />
            )}
            <item.icon className={cn("h-4 w-4 transition-transform duration-300 group-hover:scale-110 shrink-0", currentView === item.id ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400")} />
            {!isCollapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
          </Button>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className={cn("border-t border-white/5 space-y-3 relative transition-all duration-300", isCollapsed ? "p-2" : "p-4")}>
        <div className={cn("flex items-center rounded-xl bg-white/[0.02] border border-white/5 transition-all", isCollapsed ? "justify-center p-1.5" : "gap-3 p-2")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center font-black text-white text-[10px] shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.3)]">
            ME
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-[11px] font-bold text-slate-200 truncate">Manu Emprende</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[9px] text-blue-400/60 font-bold uppercase tracking-tight">Activo</span>
              </div>
            </motion.div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            "w-full text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors h-9",
            isCollapsed ? "justify-center px-0" : "justify-start gap-2 px-3"
          )}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-wider">Cerrar Sesión</span>}
        </Button>
      </div>
    </motion.aside>
  );
}
