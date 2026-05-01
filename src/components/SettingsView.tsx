import React, { useEffect, useState } from 'react';
import { Shield, Key, Facebook, CheckCircle2, AlertCircle, RefreshCw, Settings, Trash2, Send, Zap, Fingerprint, Database, Cpu, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const glowVars = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { stiffness: 300, damping: 25 } },
  exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.2 } }
};

export function SettingsView() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [alertConfig, setAlertConfig] = useState<any>({
    telegramBotToken: '',
    telegramChatId: '',
    telegramEnabled: true,
    whatsappEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    pixelId: '', accessToken: '', businessManagerId: '', datasetId: '', testEventCode: '', adminName: '', phoneNumber: '', inboxId: '', chatwootUrl: '', active: true
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'meta' | 'alerts' | 'webhooks'>('meta');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metaRes, alertRes] = await Promise.all([
        fetch('/api/settings/meta').then(async res => {
          if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid format");
          return res.json();
        }),
        fetch('/api/settings/alerts').then(async res => {
          if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid format");
          return res.json();
        })
      ]);
      setConfigs(metaRes || []);
      setAlertConfig(alertRes || alertConfig);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveAlerts = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alertConfig) });
      if (res.ok) setMessage({ type: 'success', text: 'PROTOCOLO INICIALIZADO: ALERTAS ACTIVADAS' });
    } catch (e) {
      setMessage({ type: 'error', text: 'ERROR DEL SISTEMA: FALLÓ LA GUARDIA' });
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch('/api/settings/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isEditing === 'new' ? form : { ...form, id: isEditing }) });
      if (res.ok) {
        setMessage({ type: 'success', text: 'ENLACE ESTABLECIDO. DATOS SINCRONIZADOS.' });
        setIsEditing(null); fetchData();
      } else { setMessage({ type: 'error', text: 'FALLO EN LA SINCRONIZACIÓN.' }); }
    } catch (error) { setMessage({ type: 'error', text: 'RED TERMINADA.' }); }
    setSaving(false);
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('¿TERMINAR ESTE NODO?')) return;
    await fetch(`/api/settings/meta/${id}`, { method: 'DELETE' });
    fetchData();
  };

  if (loading && configs.length === 0) return (
    <div className="h-full flex items-center justify-center bg-slate-950 font-mono text-cyan-500/80 uppercase tracking-[0.3em] text-xs">
      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}>Inicializando Interfaz Neuronal...</motion.div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden font-sans text-slate-300 relative selection:bg-cyan-500/30">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-0" />

      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-shrink-0 z-10 border-b border-cyan-900/40 bg-slate-950/50 backdrop-blur-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-4 items-center">
          <div className="h-10 w-10 flex border-[1px] border-cyan-500/40 bg-cyan-950/30 items-center justify-center rounded-sm">
             <Cpu className="text-cyan-400 h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[0.2em] uppercase text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] flex items-center gap-2">
              Arquitectura de <span className="text-cyan-400 font-light">Sistema</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em] font-mono text-cyan-500">Núcleo Global Online</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-1 px-6 pt-6 z-10 font-mono text-[10px] tracking-[0.15em] uppercase">
        <button onClick={() => setActiveTab('meta')} className={cn("px-6 py-3 border-t-2 transition-all flex items-center gap-2 rounded-t-lg bg-gradient-to-t", activeTab === 'meta' ? "border-blue-400 text-blue-300 from-blue-900/20 to-transparent" : "border-transparent text-slate-500 hover:text-slate-300")}>
          <Facebook className="h-4 w-4" /> Nodos Meta
        </button>
        <button onClick={() => setActiveTab('alerts')} className={cn("px-6 py-3 border-t-2 transition-all flex items-center gap-2 rounded-t-lg bg-gradient-to-t", activeTab === 'alerts' ? "border-sky-400 text-sky-300 from-sky-900/20 to-transparent" : "border-transparent text-slate-500 hover:text-slate-300")}>
          <Send className="h-4 w-4" /> Alertas Telegram
        </button>
        <button onClick={() => setActiveTab('webhooks')} className={cn("px-6 py-3 border-t-2 transition-all flex items-center gap-2 rounded-t-lg bg-gradient-to-t", activeTab === 'webhooks' ? "border-green-400 text-green-300 from-green-900/20 to-transparent" : "border-transparent text-slate-500 hover:text-slate-300")}>
          <Database className="h-4 w-4" /> Enlaces N8N
        </button>
      </div>

      <div className="flex-1 overflow-auto z-10 p-6 relative">
      <AnimatePresence mode="wait">
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("mb-6 p-4 border flex items-center gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] uppercase font-mono text-[10px] tracking-[0.2em] rounded-sm", message.type === 'success' ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-400' : 'bg-red-950/40 border-red-500/50 text-red-400')}>
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {message.text}
          </motion.div>
        )}
      </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === 'meta' && (
            <motion.div key="meta" initial="initial" animate="animate" exit="exit" variants={glowVars} className="h-full">
              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {/* Add New Card */}
                  <motion.div whileHover={{ scale: 1.02 }} className="group relative rounded-xl p-[1px] bg-gradient-to-b from-blue-900/50 to-transparent cursor-pointer h-[240px]" onClick={() => {
                        setForm({ pixelId: '', accessToken: '', businessManagerId: '', datasetId: '', testEventCode: '', adminName: '', phoneNumber: '', inboxId: '', chatwootUrl: '', active: true });
                        setIsEditing('new');
                      }}>
                     <div className="absolute inset-0 bg-blue-900/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="h-full w-full bg-black/90 backdrop-blur-md rounded-xl border border-white/5 flex flex-col items-center justify-center p-6 text-center gap-4 relative z-10 overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Facebook className="h-24 w-24" /></div>
                        <div className="h-14 w-14 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-950/50 text-blue-400 group-hover:bg-blue-500 group-hover:text-black transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                           <Plus className="h-6 w-6" />
                        </div>
                        <div>
                           <h3 className="text-xs font-bold text-white tracking-[0.2em] uppercase mb-1">Añadir Nuevo Nodo</h3>
                           <p className="text-[10px] text-slate-500 font-mono">Esperando configuración</p>
                        </div>
                     </div>
                  </motion.div>

                  {/* Existing Nodes */}
                  {configs.map(c => (
                     <motion.div key={c.id} whileHover={{ scale: 1.02 }} className="group relative rounded-xl p-[1px] bg-gradient-to-b from-slate-800/80 to-transparent h-[240px] flex flex-col">
                        <div className="h-full w-full bg-slate-950/80 backdrop-blur-md rounded-xl border border-white/5 flex flex-col relative z-10 overflow-hidden">
                           <div className="absolute top-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                           <div className="p-5 border-b border-white/5 flex justify-between items-start">
                              <div className="flex gap-3">
                                 <div className="h-8 w-8 rounded bg-blue-950/50 border border-blue-500/30 flex items-center justify-center">
                                    <Facebook className="h-4 w-4 text-blue-400" />
                                 </div>
                                 <div>
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">{c.adminName || 'NODO_DESCONOCIDO'}</h3>
                                    <p className="text-[9px] text-blue-500/80 font-mono mt-0.5">{c.phoneNumber || 'GLOBAL'}</p>
                                 </div>
                              </div>
                              <div className="flex gap-1">
                                 <button onClick={() => { setForm({ ...c, accessToken: '' }); setIsEditing(c.id); }} className="h-6 w-6 rounded bg-slate-800 flex items-center justify-center hover:bg-blue-900 transition-colors">
                                    <Settings className="h-3 w-3 text-slate-300" />
                                 </button>
                                 <button onClick={() => deleteConfig(c.id)} className="h-6 w-6 rounded bg-slate-800 flex items-center justify-center hover:bg-red-900 transition-colors">
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                 </button>
                              </div>
                           </div>
                           <div className="p-5 flex-1 flex flex-col gap-3 justify-center">
                              <div className="flex justify-between items-center bg-black/30 p-2 rounded border border-white/5 font-mono text-[10px]">
                                 <span className="text-slate-500">PIXEL ID</span>
                                 <span className="text-slate-300 font-bold">{c.pixelId}</span>
                              </div>
                              {c.inboxId && (
                                <div className="flex justify-between items-center bg-black/50 p-2 rounded border border-white/5 font-mono text-[10px]">
                                   <span className="text-slate-500">INBOX ID</span>
                                   <span className="text-slate-300 font-bold">{c.inboxId}</span>
                                </div>
                              )}
                           </div>
                           <div className="p-3 border-t border-white/5 flex items-center justify-between bg-black/20">
                              <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Estado</span>
                              <div className="flex items-center gap-2">
                                 <span className="flex h-1.5 w-1.5 relative"><span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", c.active ? "bg-blue-400" : "bg-red-500")}></span><span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", c.active ? "bg-blue-500" : "bg-red-600")}></span></span>
                                 <span className={cn("text-[8px] font-mono uppercase font-bold", c.active ? "text-blue-400" : "text-red-500")}>{c.active ? 'ONLINE' : 'OFFLINE'}</span>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-4xl mx-auto rounded-xl p-[1px] bg-gradient-to-b from-blue-900/60 to-transparent relative">
                   <div className="absolute inset-0 bg-blue-900/10 blur-xl pointer-events-none" />
                   <div className="h-full w-full bg-slate-950 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden flex flex-col relative z-10">
                      <div className="p-6 border-b border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                               <Settings className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                               <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em]">{isEditing === 'new' ? 'INICIALIZAR NUEVO NODO' : 'MODIFICAR NODO PROTOCOLO'}</h2>
                               <p className="text-[10px] text-blue-500 font-mono mt-0.5">CONEXIÓN SEGURA ESTABLECIDA</p>
                            </div>
                         </div>
                         <button onClick={() => setIsEditing(null)} className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white transition-colors border border-slate-700 px-4 py-2 rounded">VOLVER</button>
                      </div>

                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                         {/* Network Details */}
                         <div className="space-y-6">
                            <div>
                               <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2 block">Nombre del Nodo</label>
                               <input value={form.adminName} onChange={e => setForm({...form, adminName: e.target.value})} placeholder="Ej. ADMIN_1" className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2 block">Teléfono Conectado</label>
                               <input value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value})} placeholder="569XXXXXXXX" className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2 block">Bandeja Chatwoot (ID)</label>
                               <input value={form.inboxId} onChange={e => setForm({...form, inboxId: e.target.value})} placeholder="12" className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors shadow-inner" />
                            </div>
                         </div>
                         {/* CAPI DETAILS */}
                         <div className="space-y-6">
                            <div>
                               <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2 block flex items-center gap-2"><Facebook className="h-3 w-3"/> ID del Pixel (Meta)</label>
                               <input value={form.pixelId} onChange={e => setForm({...form, pixelId: e.target.value})} className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest mb-2 block">Business Manager ID</label>
                               <input value={form.businessManagerId} onChange={e => setForm({...form, businessManagerId: e.target.value})} className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors shadow-inner" />
                            </div>
                            <div>
                               <label className="text-[9px] font-mono text-red-500 flex items-center gap-2 uppercase tracking-widest mb-2 block"><Key className="h-3 w-3" /> Token de Acceso (Encriptado)</label>
                               <input type="password" value={form.accessToken} onChange={e => setForm({...form, accessToken: e.target.value})} placeholder="••••••••••••••••••••••••" className="w-full bg-black/40 border border-red-900/50 rounded px-4 py-3 text-xs font-mono text-red-400 focus:border-red-500 focus:outline-none transition-colors shadow-inner shadow-red-900/20" />
                            </div>
                         </div>
                      </div>

                      <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <input type="checkbox" id="nodeActive" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="accent-blue-500 h-4 w-4 bg-[#0a0a0a]" />
                            <label htmlFor="nodeActive" className="text-[10px] font-mono text-slate-300 uppercase tracking-widest cursor-pointer">Activar nodo de inmediato</label>
                         </div>
                         <button onClick={handleSave} disabled={saving} className="bg-blue-500 hover:bg-blue-400 text-white font-bold uppercase tracking-[0.2em] text-[11px] px-8 py-3 rounded transition-colors shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50">
                            {saving ? 'Transmitiendo...' : 'Iniciar Enlace'}
                         </button>
                      </div>
                   </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'alerts' && (
             <motion.div key="alerts" initial="initial" animate="animate" exit="exit" variants={glowVars} className="max-w-3xl mx-auto mt-8">
                <div className="rounded-xl p-[1px] bg-gradient-to-b from-sky-900/60 to-transparent relative">
                   <div className="absolute inset-0 bg-sky-900/10 blur-xl pointer-events-none" />
                   <div className="w-full bg-slate-950 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden flex flex-col relative z-10">
                      <div className="p-8 border-b border-white/5">
                         <h2 className="text-lg font-bold text-white uppercase tracking-[0.2em] flex items-center gap-3">
                            <Send className="h-5 w-5 text-sky-400" /> Centro de Alertas
                         </h2>
                         <p className="text-[11px] text-slate-500 font-mono mt-2 uppercase">Configura la integración del bot de Telegram para notificaciones en tiempo real</p>
                      </div>
                      <div className="p-8 space-y-6">
                         <div>
                            <label className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mb-2 block flex justify-between">
                               <span>Token del Bot de Telegram</span>
                               <span className="text-slate-600">@BotFather</span>
                            </label>
                            <input type="password" value={alertConfig.telegramBotToken || ''} onChange={e => setAlertConfig({...alertConfig, telegramBotToken: e.target.value})} placeholder="1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ" className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-sky-500 focus:outline-none transition-colors" />
                         </div>
                         <div>
                            <label className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mb-2 block">Chat ID Destino</label>
                            <input value={alertConfig.telegramChatId || ''} onChange={e => setAlertConfig({...alertConfig, telegramChatId: e.target.value})} placeholder="-100123456789" className="w-full bg-black/40 border border-slate-800 rounded px-4 py-3 text-xs font-mono text-white focus:border-sky-500 focus:outline-none transition-colors" />
                         </div>
                         <div className="pt-4 flex items-center justify-between border-t border-white/5">
                            <div>
                               <div className="text-[11px] font-bold text-white uppercase tracking-widest mb-1">Transmisor de Alertas</div>
                               <div className="text-[9px] text-slate-500 font-mono">Activar transmisión global de errores</div>
                            </div>
                            <button onClick={() => setAlertConfig({...alertConfig, telegramEnabled: !alertConfig.telegramEnabled})} className={cn("px-6 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all", alertConfig.telegramEnabled ? "bg-sky-500/20 text-sky-400 border border-sky-500/50" : "bg-slate-800 text-slate-400 border border-slate-700")}>
                               {alertConfig.telegramEnabled ? 'Activo' : 'Pausado'}
                            </button>
                         </div>
                      </div>
                      <div className="p-6 bg-black/20 border-t border-white/5 flex gap-4 justify-end">
                         <button onClick={handleSaveAlerts} disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-[0.2em] text-[11px] px-8 py-3 rounded shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all active:scale-95">
                            {saving ? 'Guardando...' : 'Guardar Enlace'}
                         </button>
                      </div>
                   </div>
                </div>
             </motion.div>
          )}

          {activeTab === 'webhooks' && (
             <motion.div key="webhooks" initial="initial" animate="animate" exit="exit" variants={glowVars} className="max-w-4xl mx-auto mt-8">
                <div className="rounded-xl bg-slate-950 backdrop-blur-xl border border-white/5 flex flex-col relative overflow-hidden">
                   <div className="p-8 border-b border-white/5 flex items-center gap-4 bg-gradient-to-r from-green-900/20 to-transparent">
                      <div className="h-12 w-12 rounded bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                         <Database className="h-6 w-6 text-green-400" />
                      </div>
                      <div>
                         <h2 className="text-xl font-bold text-white uppercase tracking-[0.2em]">Puntos de Enlace</h2>
                         <p className="text-[11px] text-slate-500 font-mono mt-1 tracking-widest">ENDPOINTS DE RECEPCIÓN PARA N8N</p>
                      </div>
                   </div>
                   
                   <div className="p-8 space-y-8">
                      {/* Port 1 */}
                      <div className="relative group">
                         <div className="absolute inset-0 bg-green-500/5 border border-green-500/20 rounded-lg transform -skew-x-2" />
                         <div className="relative p-6 flex flex-col md:flex-row gap-6 md:items-center">
                            <div className="flex-1">
                               <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] bg-green-500 text-black px-2 py-0.5 rounded-sm font-bold uppercase">POST</span>
                                  <h3 className="text-sm font-mono text-green-400 tracking-widest">Ingreso de Leads</h3>
                               </div>
                               <div className="bg-black/40 border border-slate-800 p-3 rounded font-mono text-[11px] text-slate-300 break-all select-all">
                                  {window.location.origin}/api/webhooks/leads
                               </div>
                            </div>
                            <div className="w-full md:w-48 bg-black/60 p-4 rounded border border-slate-800 font-mono text-[9px] uppercase space-y-2">
                               <div className="flex justify-between"><span className="text-slate-500">Auth</span><span className="text-green-400">X-API-KEY</span></div>
                               <div className="flex justify-between"><span className="text-slate-500">Límite</span><span className="text-white">SIN LÍMITE</span></div>
                            </div>
                         </div>
                      </div>

                      {/* Port 2 */}
                      <div className="relative group">
                         <div className="absolute inset-0 bg-green-500/5 border border-green-500/20 rounded-lg transform -skew-x-2" />
                         <div className="relative p-6 flex flex-col md:flex-row gap-6 md:items-center">
                            <div className="flex-1">
                               <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] bg-green-500 text-black px-2 py-0.5 rounded-sm font-bold uppercase">POST</span>
                                  <h3 className="text-sm font-mono text-green-400 tracking-widest">Cierre de Ventas</h3>
                               </div>
                               <div className="bg-black/40 border border-slate-800 p-3 rounded font-mono text-[11px] text-slate-300 break-all select-all">
                                  {window.location.origin}/api/webhooks/sales
                               </div>
                            </div>
                            <div className="w-full md:w-48 bg-black/60 p-4 rounded border border-slate-800 font-mono text-[9px] uppercase space-y-2">
                               <div className="flex justify-between"><span className="text-slate-500">Requiere</span><span className="text-green-400">PHONE, AMOUNT</span></div>
                               <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="text-white">JSON</span></div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
