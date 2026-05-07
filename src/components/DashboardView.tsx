import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, ShieldCheck, Target, Send, Activity, Zap, TrendingUp, AlertTriangle, RefreshCw, Orbit, Database, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardData {
  summary: {
    salesToday: number;
    totalAmount: number;
    attributedSales: number;
    matchRate: string;
    sentToMeta: number;
    notSentToMeta: number;
    capiGapPercent: string;
    metaConversions: number;
    roasReal: string;
    cpaReal: string;
    spend: number;
    scalableAds: number;
    revisionManual: number;
    ticketPromedio: string;
    leadsCount: number;
    conversionRate: string;
    topProducts: { name: string; count: number }[];
  };
  recentLeads: any[];
  recentSales: any[];
}

interface AdPerformance {
  adId: string;
  adName: string;
  spend: number;
  metaSales: number;
  realSales: number;
  revenue: number;
  roasReal: string;
  capiGap: string;
  status: 'scale' | 'hold' | 'data_problem' | 'do_not_scale';
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [adPerformance, setAdPerformance] = useState<AdPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ 
    from: format(new Date(), 'yyyy-MM-dd'), 
    to: format(new Date(), 'yyyy-MM-dd') 
  });

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(dateRange);
    try {
      const [summaryRes, perfRes] = await Promise.all([
        fetch(`/api/dashboard/summary?${params.toString()}`).then(async res => {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Invalid response from server");
          }
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(json.error || "Failed to fetch summary");
          return json;
        }),
        fetch(`/api/performance/ads?${params.toString()}`).then(async res => {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Invalid response from server");
          }
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(json.error || "Failed to fetch performance");
          return json;
        })
      ]);
      setData(summaryRes);
      setAdPerformance(perfRes);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 120000);
    return () => clearInterval(interval);
  }, [dateRange]);

  if (loading && !data) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 font-cyber">
       <div className="w-16 h-16 border-b-2 border-blue-500 rounded-full animate-spin mb-6" />
       <div className="text-xs tracking-[0.5em] text-blue-400 uppercase animate-pulse">Inicializando Nodo WENTIX...</div>
    </div>
  );
  
  if (error) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 font-cyber p-8 text-center text-red-500">
      <AlertTriangle className="h-12 w-12 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Error de Conexión</h2>
      <p className="text-sm font-mono max-w-md">{error}</p>
      <Button onClick={fetchDashboard} variant="outline" className="mt-6 border-red-500 text-red-500 hover:bg-red-500 hover:text-black">
        Reintentar Conexión
      </Button>
    </div>
  );

  if (!data) return null;

  const { summary, recentSales } = data;

  const huds = [
    { label: "Ventas Totales", value: summary.salesToday, sub: "Registradas hoy", icon: <TrendingUp />, color: "blue", isMoney: false },
    { label: "Ingresos", value: summary.totalAmount, sub: "Ventas netas", icon: <DollarSign />, color: "blue", isMoney: true },
    { label: "Leads Captados", value: summary.leadsCount ?? 0, sub: `${summary.conversionRate ?? "0.0"}% conversión`, icon: <Target />, color: "blue", isMoney: false },
    { label: "Atribuidas", value: summary.attributedSales, sub: `${summary.matchRate}% de éxito`, icon: <Target />, color: "blue", isMoney: false },
    { label: "Enviadas Meta", value: summary.sentToMeta, sub: "Sin errores CAPI", icon: <Send />, color: "blue", isMoney: false },
    { label: "Discrepancia", value: `${summary.capiGapPercent}%`, sub: `${summary.notSentToMeta} sin reportar`, icon: <AlertTriangle />, color: Number(summary.capiGapPercent) > 15 ? "red" : "blue", isMoney: false },
    { label: "ROAS Real", value: `${summary.roasReal}x`, sub: `Meta: ${summary.metaConversions}`, icon: <ShieldCheck />, color: "blue", isMoney: false },
    { label: "CPA", value: summary.cpaReal, sub: "Costo por venta", icon: <Activity />, color: "blue", isMoney: true },
    { label: "Ads Escalables", value: summary.scalableAds, sub: "Buen rendimiento", icon: <Zap />, color: "blue", isMoney: false },
    { label: "Gasto", value: summary.spend, sub: "Meta Ads", icon: <Database />, color: "blue", isMoney: true },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950 cyber-grid relative selection:bg-blue-500/40 overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="flex flex-col gap-4 md:gap-6">
          {/* HUD Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 z-10">
         <div className="flex items-center gap-3 md:gap-6">
            <div className="h-12 w-12 md:h-20 md:w-20 bg-slate-900 flex items-center justify-center border-l border-t border-blue-500/20 relative group overflow-hidden shrink-0">
               <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
               <Orbit className="h-6 w-6 md:h-10 md:w-10 text-blue-400 z-10 animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
               <h1 className="text-2xl sm:text-3xl md:text-5xl font-black italic tracking-tight text-white font-cyber leading-none uppercase">CAPI <span className="text-blue-400">CENTER</span></h1>
               <div className="flex items-center gap-2 mt-1 md:mt-3">
                  <span className="text-[8px] text-blue-400/60 font-bold uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="hidden sm:inline">ORBITAL INTELLIGENCE //</span> ACTIVO
                  </span>
               </div>
            </div>
         </div>

         <div className="flex items-stretch bg-slate-900 border border-slate-800 h-10 md:h-14 overflow-hidden w-full xl:w-auto min-w-0">
            <div className="flex items-center px-2 md:px-6 gap-1 md:gap-6 relative overflow-hidden group min-w-0">
               <div className="absolute inset-y-0 left-0 w-[2px] bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
               
               <div className="flex flex-col min-w-0">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-wider block leading-none mb-1 hidden md:block">Inicio</span>
                  <div className="flex items-center gap-1">
                     <Calendar className="h-3 w-3 text-blue-500/40 shrink-0" />
                     <input
                        type="date"
                        value={dateRange.from}
                        onChange={e => setDateRange({...dateRange, from: e.target.value})}
                        className="bg-transparent text-[11px] md:text-xs font-mono font-bold text-blue-400 border-none p-0 focus:ring-0 cursor-pointer [color-scheme:dark] min-w-0 w-full"
                     />
                  </div>
               </div>

               <div className="h-4 w-[1px] bg-slate-800 self-center mx-1" />

               <div className="flex flex-col min-w-0">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-wider block leading-none mb-1 hidden md:block">Fin</span>
                  <div className="flex items-center gap-1">
                     <Calendar className="h-3 w-3 text-blue-500/40 shrink-0" />
                     <input
                        type="date"
                        value={dateRange.to}
                        onChange={e => setDateRange({...dateRange, to: e.target.value})}
                        className="bg-transparent text-[11px] md:text-xs font-mono font-bold text-blue-400 border-none p-0 focus:ring-0 cursor-pointer [color-scheme:dark] min-w-0 w-full"
                     />
                  </div>
               </div>
            </div>

            <Button 
               onClick={fetchDashboard}
               disabled={loading}
               className="h-full px-6 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-none border-l border-slate-800 transition-all active:scale-95 group relative"
            >
               <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors" />
               <RefreshCw className={cn("h-4 w-4 relative z-10 transition-transform active:rotate-180", loading && "animate-spin")} />
            </Button>
         </div>
      </div>

      {/* 10 KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 z-10">
         {huds.map((hud, i) => (
            <motion.div 
               key={i}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.05 }}
               className={cn(
                  "cyber-card p-3 md:p-5 group flex flex-col justify-between h-28 md:h-36 overflow-hidden",
                  hud.color === 'red' && 'border-red-500/40 bg-red-500/[0.03]'
               )}
            >
               <div className="flex justify-between items-start">
                  <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-wider leading-tight group-hover:text-zinc-400 transition-colors line-clamp-2">{hud.label}</span>
                  <div className={cn("p-1 md:p-1.5 border border-zinc-900 shrink-0",
                    hud.color === 'red' && 'text-red-500 border-red-500/20',
                    hud.color === 'blue' && 'text-blue-500 border-blue-500/20'
                  )}>
                     {React.cloneElement(hud.icon as React.ReactElement<any>, { className: "h-2.5 w-2.5 md:h-3 md:w-3" })}
                  </div>
               </div>
               <div className="min-w-0">
                  <div className={cn(
                    "text-xl md:text-2xl font-black font-cyber text-white tabular-nums truncate",
                    hud.color === 'blue' && 'neon-text-blue',
                    hud.color === 'red' && 'neon-text-red text-red-500'
                  )}>
                    {hud.isMoney ? `$${new Intl.NumberFormat('es-CL').format(Number(hud.value))}` : hud.value}
                  </div>
                  <p className="text-[8px] font-bold text-zinc-600 mt-1 uppercase tracking-tighter truncate">{hud.sub}</p>
               </div>
            </motion.div>
         ))}
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6 z-10 flex-1 min-h-0 pb-8">
         
         {/* Ad Analytics Node */}
         <div className="xl:col-span-8 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-y-4 px-4">
               <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="leading-relaxed">Rendimiento por Anuncio (Meta vs. Real)</span>
               </h3>
               <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="text-[9px] font-black text-blue-400 flex items-center gap-2 whitespace-nowrap">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_#3b82f6]" /> 
                     <span>LISTOS PARA ESCALAR: <span className="text-white ml-1">{adPerformance.filter(a => a.status === 'scale').length}</span></span>
                  </div>
                  <div className="text-[9px] font-black text-red-500 flex items-center gap-2 whitespace-nowrap">
                     <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444] animate-pulse" /> 
                     <span>CONFLICTO DE DATOS: <span className="text-white ml-1">{adPerformance.filter(a => a.status === 'data_problem').length}</span></span>
                  </div>
               </div>
            </div>

            <Card className="cyber-card bg-slate-900/20 border-slate-800 flex-1 overflow-hidden">
               <div className="overflow-auto h-full custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-slate-950 sticky top-0 z-30">
                      <TableRow className="border-slate-800 border-b hover:bg-transparent">
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 py-5 pl-4 tracking-widest">Nombre del Anuncio</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 text-center tracking-widest px-2">Ventas (M / R)</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 text-center tracking-widest px-2">Ingresos</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 text-center tracking-widest px-2">Error CAPI</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 text-center tracking-widest px-2">ROAS Real</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-slate-500 text-right pr-4 tracking-widest">Decisión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adPerformance.map((ad, idx) => (
                        <TableRow key={idx} className="border-slate-800/50 hover:bg-blue-500/[0.012] transition-all group">
                          <TableCell className="pl-4 py-4">
                             <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-300 group-hover:text-white transition-colors leading-tight block break-words max-w-[220px]">
                                   {ad.adName}
                                </span>
                                <span className="text-[7px] font-mono text-slate-600 mt-1 uppercase">ID: {ad.adId.slice(-8)}</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-[10px] px-2">
                             <div className="flex items-center justify-center gap-1.5">
                                <span className="text-slate-600">{ad.metaSales}</span>
                                <span className="text-slate-800 italic">::</span>
                                <span className="text-blue-400 neon-text-blue">{ad.realSales}</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-center font-black text-white text-[11px] tabular-nums px-2">${new Intl.NumberFormat('es-CL').format(ad.revenue)}</TableCell>
                          <TableCell className="text-center px-2">
                             <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-sm tabular-nums", 
                                Number(ad.capiGap) > 15 ? "text-red-400 bg-red-500/10" : "text-slate-500 bg-slate-900"
                             )}>
                               {ad.capiGap}%
                             </span>
                          </TableCell>
                          <TableCell className="text-center px-2">
                             <div className={cn("inline-block px-2 py-0.5 font-black text-[11px] tabular-nums", 
                                Number(ad.roasReal) >= 2.5 ? "text-blue-400 bg-blue-400/5 border-l border-blue-400/40" : "text-slate-400 bg-slate-900"
                             )}>
                               {ad.roasReal}x
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-4 py-4">
                             <div className="flex flex-col items-end gap-0.5">
                                <Badge className={cn("text-[7px] font-black tracking-widest h-4.5 px-2 rounded-none border-none", 
                                   ad.status === 'scale' ? "bg-blue-500 text-black shadow-[0_0_10px_#3b82f6]" : 
                                   ad.status === 'data_problem' ? "bg-red-500 text-white animate-pulse" : "bg-slate-800 text-slate-500"
                                )}>
                                   {ad.status === 'scale' ? 'LISTO ESCALAR' : 
                                    ad.status === 'data_problem' ? 'PROBLEMA DATOS' : 'NODO ESTABLE'}
                                </Badge>
                                <span className="text-[6px] font-bold text-slate-600 uppercase italic">
                                   {ad.status === 'scale' ? '🚀 IMPULSO' : ad.status === 'hold' ? '⏳ ESTABLE' : '🛑 RE-ATTR'}
                                </span>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
               </div>
            </Card>
         </div>

         {/* Trace Feeds */}
         <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* Realtime Sale Trace */}
            <Card className="cyber-card bg-slate-900/40 border-slate-800 flex-1 flex flex-col min-h-[350px]">
               <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Últimas Ventas Detectadas</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[8px] font-bold text-blue-500/50 uppercase">En Vivo</span>
                     <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {recentSales.map((s, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ x: 10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 hover:bg-slate-900/60 border-l border-transparent hover:border-blue-400 transition-all flex items-center justify-between group cursor-crosshair"
                    >
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-800 group-hover:text-slate-600 transition-colors tabular-nums">#{i.toString().padStart(3, '0')}</span>
                          <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-300 uppercase group-hover:text-white transition-colors truncate max-w-[140px]">{s.customerName || 'NODO_DESCONOCIDO'}</span>
                             <span className="text-[7px] font-black text-slate-700 group-hover:text-slate-500 transition-colors uppercase tracking-widest">{format(new Date(s.createdAt), 'HH:mm:ss')} // {s.phone?.startsWith('56') ? 'CL' : 'GLOBAL'}</span>
                          </div>
                       </div>
                       <div className="text-right flex flex-col">
                          <span className="text-xs font-black text-blue-400 tabular-nums">${new Intl.NumberFormat('es-CL').format(s.amount)}</span>
                          <span className={cn("text-[7px] font-black uppercase text-center px-1 rounded-[1px] mt-1", 
                            s.capiStatus === 'sent' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-900 text-zinc-700'
                          )}>
                             {s.capiStatus === 'sent' ? 'MESHED' : 'BUFFER'}
                          </span>
                       </div>
                    </motion.div>
                  ))}
               </div>
            </Card>
         </div>
      </div>

        </div>
      </div>

      <div className="p-3 border-t border-slate-900 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-6 px-4">
               <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_5px_#3b82f6]" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Centro de Control Wentix AI // Activo</span>
               </div>
               <div className="h-3 w-[1px] bg-slate-800" />
               <span className="text-[8px] font-mono font-bold text-slate-600 uppercase tracking-widest hidden sm:block">
                  Nodo_Protocolo::WENTIX_2.6.5 // Latencia: 24ms
               </span>
            </div>
            
            <div className="flex items-center gap-6 px-4">
               <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Última_Actualización</span>
                  <span className="text-[10px] font-mono font-bold text-blue-400">{format(new Date(), 'HH:mm:ss')}</span>
               </div>
               <div className="h-3 w-[1px] bg-slate-800" />
               <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Carga_Sistema</span>
                  <div className="w-12 h-1 bg-slate-900 rounded-full overflow-hidden">
                     <div className="w-1/3 h-full bg-blue-500 shadow-[0_0_5px_#3b82f6]" />
                  </div>
               </div>
               <Zap className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}} />
    </div>
  );
}

