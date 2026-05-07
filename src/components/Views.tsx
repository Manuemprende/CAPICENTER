import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw, Eye, X, Shield, Globe, MessageSquare, Tag, Terminal, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function TechnicalInspector({ data, onClose }: { data: any, onClose: () => void }) {
  if (!data) return null;

  const sections = [
    {
      title: "Información General",
      icon: <Globe className="h-4 w-4" />,
      fields: [
        { label: "Nombre Cliente", value: data.customerName },
        { label: "Teléfono", value: data.phone },
        { label: "Normalizado", value: data.phoneNormalized },
        { label: "País", value: data.country },
      ]
    },
    {
      title: "Datos de Anuncio (Meta)",
      icon: <Tag className="h-4 w-4" />,
      fields: [
        { label: "ID Anuncio", value: data.adId },
        { label: "Nombre Anuncio", value: data.adName },
        { label: "Headline (Título)", value: data.adHeadline },
        { label: "URL Anuncio", value: data.adUrl, isLink: true },
        { label: "CLID Click-to-WhatsApp", value: data.ctwaClid },
      ]
    },
    {
      title: "Estado CAPI / Eventos",
      icon: <Terminal className="h-4 w-4" />,
      fields: [
        { label: "Estado CAPI", value: data.capiStatus },
        { label: "ID Evento Meta", value: data.metaEventId },
        { label: "Estado Meta", value: data.metaStatus },
        { label: "Error Meta", value: data.metaError },
        { label: "Respuesta Meta", value: data.metaResponse },
        { label: "Fecha Envío Meta", value: data.fechaEnvioMeta ? format(new Date(data.fechaEnvioMeta), 'dd/MM/yyyy HH:mm:ss') : null },
      ]
    },
    {
      title: "Parámetros de Flujo",
      icon: <MessageSquare className="h-4 w-4" />,
      fields: [
        { label: "ID Conversación", value: data.conversationId },
        { label: "Etapa / Stage", value: data.stage },
        { label: "Convertido", value: data.isConverted },
        { label: "Intentos Reintento", value: data.intentosReintento },
        { label: "Revisión Manual", value: data.requiereRevisionManual ? "SÍ" : "NO" },
      ]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-xl">
              <Database className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Inspector Técnico de Datos</h3>
              <p className="text-xs text-zinc-500 font-mono">ID: {data.id}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-widest">
                {section.icon}
                {section.title}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {section.fields.map((f, fIdx) => (
                  <div key={fIdx} className="bg-black/50 p-3 rounded-xl border border-zinc-900/50">
                    <div className="text-[10px] text-zinc-500 font-bold mb-1 uppercase tracking-tight">{f.label}</div>
                    <div className={cn(
                      "text-sm font-mono break-all",
                      f.value ? "text-zinc-200" : "text-zinc-600 italic"
                    )}>
                      {f.isLink && f.value ? (
                        <a href={f.value} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">Ver Enlace</a>
                      ) : (
                        String(f.value || 'Sin Dato')
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-black/50 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono text-center">
          Integridad de Datos Verificada • Impulsado por Meta Conversion API (v19.0)
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LeadsView() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ 
    from: format(new Date(), 'yyyy-MM-dd'), 
    to: format(new Date(), 'yyyy-MM-dd') 
  });

  const fetchLeads = () => {
    setLoading(true);
    const params = new URLSearchParams(dateRange);
    fetch(`/api/leads?${params.toString()}`)
      .then(async res => {
        if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid format");
        return res.json();
      })
      .then(data => {
        setLeads(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 120000);
    return () => clearInterval(interval);
  }, [dateRange]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white selection:bg-blue-500/30">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-[#020617] sticky top-0 py-4 z-20 gap-4">
        <div>
          <h2 className="text-3xl font-black italic text-white tracking-tighter uppercase font-cyber leading-none">Seguimiento de <span className="text-blue-400 not-italic">Leads</span> WhatsApp</h2>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">Señales Entrantes // Análisis en Tiempo Real</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-2 border border-slate-900 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
           <div className="flex items-center gap-2 px-3 border-r border-slate-800">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desde_Nodo</span>
             <input 
              type="date" 
              className="bg-transparent text-xs text-blue-400 outline-none font-mono font-bold" 
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
             />
           </div>
           <div className="flex items-center gap-2 px-3">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hasta_Nodo</span>
             <input 
              type="date" 
              className="bg-transparent text-xs text-blue-400 outline-none font-mono font-bold"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
             />
           </div>
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchLeads}
            className="text-slate-500 hover:text-blue-400 rounded-none border-l border-slate-900 ml-2"
           >
             <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
           </Button>
        </div>
      </div>

      <Card className="border-slate-900 bg-slate-950/40 shadow-2xl overflow-hidden rounded-none cyber-card">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-900 hover:bg-transparent">
              <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest py-5 pl-8">Identidad Entrante</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Fuente de Señal</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Malla de Campaña</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest text-center">Seguimiento de Estado</TableHead>
              <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-widest text-right pr-8">Inspeccionar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-blue-500/[0.012] border-slate-900/50 transition-all group">
                <TableCell className="pl-8 py-5">
                  <div className="font-black text-slate-200 group-hover:text-white uppercase tracking-tight text-xs transition-colors">{lead.customerName || 'Nodo_Desconocido'}</div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Badge variant="outline" className="text-[8px] border-slate-800 text-slate-500 h-4 uppercase rounded-none font-black tracking-widest bg-slate-900/50">
                      GEO::{lead.country || 'Global'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs font-bold text-slate-400 tracking-tighter">{lead.phone}</div>
                  <div className="text-[9px] text-blue-400 font-bold mt-1 font-mono">{lead.phoneNormalized}</div>
                </TableCell>
                <TableCell>
                   <div className="text-slate-200 font-bold text-xs truncate max-w-[150px] uppercase">
                     {lead.campaignName || (lead.adId ? 'Meta Ads' : 'Orgánico')}
                   </div>
                   <div className="text-[9px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">
                     {lead.adId ? `AD::${lead.adId.slice(-8)}` : (lead.adsetName || 'SIN ANUNCIO')}
                   </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-center gap-1.5">
                    <Badge className="w-fit text-[9px] bg-blue-600/10 text-blue-400 uppercase border border-blue-500/20 h-4 rounded-none font-black tracking-widest shadow-[0_0_10px_rgba(37,99,235,0.1)]">
                      {lead.stage || 'Captación'}
                    </Badge>
                    <div className="text-[8px] font-mono text-slate-700 truncate max-w-[80px] font-bold group-hover:text-slate-500 transition-colors">
                      {lead.conversationId ? `CONV_ID::${lead.conversationId.slice(-6)}` : '#'+lead.id.substring(0,6)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-8">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-none border border-slate-900 hover:border-blue-500/30 transition-all"
                    onClick={() => setInspecting(lead)}
                   >
                     <Eye className="h-4 w-4" />
                   </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AnimatePresence>
        {inspecting && <TechnicalInspector data={inspecting} onClose={() => setInspecting(null)} />}
      </AnimatePresence>
    </div>
  );
}

export function SalesView() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [inspecting, setInspecting] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ 
    from: format(new Date(), 'yyyy-MM-dd'), 
    to: format(new Date(), 'yyyy-MM-dd') 
  });

  const fetchSales = () => {
    setLoading(true);
    const params = new URLSearchParams(dateRange);
    fetch(`/api/sales?${params.toString()}`)
      .then(async res => {
        if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid format");
        return res.json();
      })
      .then(data => {
        setSales(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, 120000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const handleRetry = async (saleId: string) => {
    setRetryingIds(prev => new Set(prev).add(saleId));
    try {
      await fetch(`/api/capi/retry/${saleId}`, { method: 'POST' });
      fetchSales();
    } catch (error) {
      console.error(error);
    }
    setRetryingIds(prev => {
      const next = new Set(prev);
      next.delete(saleId);
      return next;
    });
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-[#020617] sticky top-0 py-4 z-20 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Historial de Ventas</h2>
          <p className="text-slate-500 text-sm">Mostrando registros del rango seleccionado (Auto-refresco 2m)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-2 rounded-2xl border border-slate-900">
           <div className="flex items-center gap-2 px-3 border-r border-slate-900">
             <span className="text-[10px] font-bold text-slate-500 uppercase">Desde</span>
             <input 
              type="date" 
              className="bg-transparent text-sm text-blue-400 outline-none font-mono" 
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
             />
           </div>
           <div className="flex items-center gap-2 px-3">
             <span className="text-[10px] font-bold text-slate-500 uppercase">Hasta</span>
             <input 
              type="date" 
              className="bg-transparent text-sm text-blue-400 outline-none font-mono"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
             />
           </div>
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchSales}
            className="text-slate-400 hover:text-white"
           >
             <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
           </Button>
        </div>
      </div>

      <Card className="border-slate-900 bg-slate-950 shadow-xl overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
              <TableRow className="bg-slate-900 border-slate-800">
                <TableHead className="font-bold text-slate-400">Monto / Fecha</TableHead>
                <TableHead className="font-bold text-slate-400">Cliente / Etapa</TableHead>
                <TableHead className="font-bold text-slate-400">WhatsApp / Conv</TableHead>
                <TableHead className="font-bold text-slate-400">Atribución</TableHead>
                <TableHead className="font-bold text-slate-400">CAPI</TableHead>
                <TableHead className="font-bold text-slate-400 text-center">Acción</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id} className="hover:bg-slate-900 border-slate-900">
                <TableCell>
                  <div className="font-black text-white font-mono text-lg">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sale.amount)}
                  </div>
                  <div className="text-slate-500 text-[10px] font-mono mt-1">
                    {format(new Date(sale.createdAt), 'dd/MM/yy HH:mm', { locale: es })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-white uppercase">{sale.customerName || 'SIN NOMBRE'}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[9px] border-blue-900 text-blue-400 h-4 uppercase bg-blue-500/5">
                      {sale.stage || 'FLUJO'}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] border-slate-800 text-slate-500 h-4 uppercase">
                      {sale.country || 'CL'}
                    </Badge>
                    {sale.isConverted && (
                      <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-none h-4 uppercase font-black">
                        {sale.isConverted === '1' ? 'Convertido' : sale.isConverted}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="font-medium text-slate-300">{sale.phone}</div>
                   <div className="text-[10px] text-slate-600 font-mono">{sale.conversationId ? `CONV: ${sale.conversationId}` : sale.phoneNormalized}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge 
                      className={cn(
                        "font-black text-[9px] px-2 py-0 border-none shadow-none uppercase h-4 w-fit",
                        sale.attributionStatus === 'strong_match' ? "bg-blue-500/10 text-blue-400" : 
                        sale.attributionStatus === 'attributed' ? "bg-blue-500/10 text-blue-400" :
                        sale.attributionStatus === 'no_match' ? "bg-slate-800 text-slate-600" :
                        "bg-blue-900/10 text-blue-500"
                      )}
                    >
                      {sale.attributionStatus === 'strong_match' ? 'MATCH FUERTE' : 
                       sale.attributionStatus === 'attributed' ? 'ATRIBUIDO' : 
                       sale.attributionStatus === 'no_match' ? 'SIN MATCH' : 
                       (sale.attributionStatus || 'SIN MATCH').replace('_', ' ')}
                    </Badge>
                    {sale.isScalable && (
                       <div className="text-[8px] text-blue-400 font-bold tracking-widest uppercase">Escalable</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        sale.capiStatus === 'sent' ? "bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" : 
                        sale.capiStatus === 'failed' ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-slate-700"
                      )} />
                      <span className={cn(
                        "font-black text-[9px] uppercase",
                        sale.capiStatus === 'sent' ? "text-blue-400" : 
                        sale.capiStatus === 'failed' ? "text-red-500" : "text-slate-600"
                      )}>
                        {sale.capiStatus === 'sent' ? 'ENVIADO' : sale.capiStatus === 'failed' ? 'FALLIDO' : 'PENDIENTE'}
                      </span>
                    </div>
                    {sale.metaStatus && (
                      <div className="text-[8px] text-slate-500 font-mono mt-0.5 truncate max-w-[100px]" title={sale.metaError || sale.metaResponse}>
                        {sale.metaStatus}: {sale.metaError || 'OK'}
                      </div>
                    )}
                    {sale.fechaEnvioMeta && (
                      <div className="text-[7px] text-slate-600 font-mono">
                        {format(new Date(sale.fechaEnvioMeta), 'dd/MM HH:mm')}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col gap-1 items-center">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10"
                      onClick={() => setInspecting(sale)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(sale.capiStatus === 'failed' || sale.capiStatus === 'pending') && sale.attributionStatus !== 'no_match' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 text-[8px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 px-2"
                        onClick={() => handleRetry(sale.id)}
                        disabled={retryingIds.has(sale.id)}
                      >
                        {retryingIds.has(sale.id) ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          'RE-CAPI'
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AnimatePresence>
        {inspecting && <TechnicalInspector data={inspecting} onClose={() => setInspecting(null)} />}
      </AnimatePresence>
    </div>
  );
}
