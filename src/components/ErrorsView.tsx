import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertTriangle, RefreshCw, XCircle, UserX, Send } from 'lucide-react';
import { motion } from 'motion/react';

export function ErrorsView() {
  const [failedCapi, setFailedCapi] = useState<any[]>([]);
  const [noMatch, setNoMatch] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const [capiRes, salesRes] = await Promise.all([
        fetch('/api/capi/events?status=failed&limit=50').then(r => r.json()),
        fetch('/api/sales?from=2026-01-01&to=2099-12-31').then(r => r.json()),
      ]);
      setFailedCapi(Array.isArray(capiRes) ? capiRes : []);
      const noMatchSales = Array.isArray(salesRes)
        ? salesRes.filter((s: any) => s.attributionStatus === 'no_match' || s.attributionStatus === 'manual_review')
        : [];
      setNoMatch(noMatchSales);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchErrors(); }, []);

  const handleRetry = async (saleId: string) => {
    setRetrying(prev => new Set(prev).add(saleId));
    await fetch(`/api/capi/retry/${saleId}`, { method: 'POST' }).catch(() => {});
    setRetrying(prev => { const n = new Set(prev); n.delete(saleId); return n; });
    fetchErrors();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 text-white animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center sticky top-0 bg-[#020617] py-3 z-20">
        <div>
          <h2 className="text-2xl md:text-3xl font-black italic text-white tracking-tighter uppercase leading-none">
            Centro de <span className="text-red-400 not-italic">Errores</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
            CAPI fallidos · Ventas sin atribuir
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchErrors} className="text-slate-500 hover:text-white border border-slate-800">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'CAPI Fallidos', value: failedCapi.length, icon: <XCircle className="h-4 w-4" />, color: 'red' },
          { label: 'Sin Atribución', value: noMatch.length, icon: <UserX className="h-4 w-4" />, color: 'orange' },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("border p-4 rounded-none", k.color === 'red' ? 'bg-red-500/5 border-red-500/20' : 'bg-orange-500/5 border-orange-500/20')}>
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{k.label}</span>
              <span className={k.color === 'red' ? 'text-red-400' : 'text-orange-400'}>{k.icon}</span>
            </div>
            <div className={cn("text-3xl font-black mt-3", k.color === 'red' ? 'text-red-400' : 'text-orange-400')}>
              {k.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* CAPI Fallidos */}
      {failedCapi.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest">
            <XCircle className="h-3.5 w-3.5" /> Eventos CAPI Fallidos
          </div>
          {failedCapi.map((ev, i) => (
            <div key={i} className="bg-slate-950 border border-red-500/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white uppercase text-sm">{ev.sale?.customerName || '—'}</div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">{ev.sale?.phone}</div>
                  <div className="text-[9px] text-red-400 mt-1 font-mono bg-red-500/5 p-1.5 border border-red-500/10 mt-2">
                    {ev.error || 'Error desconocido'}
                  </div>
                  <div className="text-[8px] text-slate-600 mt-1">
                    {ev.createdAt ? format(new Date(ev.createdAt), 'dd/MM/yyyy HH:mm:ss') : ''}
                  </div>
                </div>
                <Button size="sm" variant="ghost"
                  className="shrink-0 h-8 text-[9px] font-black text-blue-400 border border-blue-500/20 px-3 hover:bg-blue-500/10 rounded-none"
                  onClick={() => handleRetry(ev.saleId)}
                  disabled={retrying.has(ev.saleId)}>
                  {retrying.has(ev.saleId) ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" />RETRY</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ventas sin atribución */}
      {noMatch.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-orange-400 uppercase tracking-widest">
            <UserX className="h-3.5 w-3.5" /> Ventas sin Lead Asociado
          </div>
          <p className="text-[9px] text-slate-500">
            Estas ventas no pudieron ser atribuidas a un anuncio. El cliente posiblemente llegó por tráfico orgánico o antes de que se configurara el sistema.
          </p>
          {noMatch.map((s, i) => (
            <div key={i} className="bg-slate-950 border border-orange-500/20 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-black text-white uppercase text-sm">{s.customerName || 'Sin nombre'}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400">{s.phone}</span>
                    <span className="font-black text-white font-mono">${new Intl.NumberFormat('es-CL').format(s.amount)}</span>
                    <Badge className={cn("text-[7px] rounded-none border font-black h-4 uppercase",
                      s.attributionStatus === 'manual_review' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                    )}>
                      {s.attributionStatus === 'manual_review' ? 'REVISIÓN' : 'SIN MATCH'}
                    </Badge>
                  </div>
                  {s.campaignName && <div className="text-[9px] text-slate-600 mt-1">{s.campaignName}</div>}
                </div>
                <div className="text-[8px] text-slate-600 font-mono text-right shrink-0">
                  {s.createdAt ? format(new Date(s.createdAt), 'dd/MM HH:mm') : ''}
                  <div className={cn("mt-1 font-black uppercase",
                    s.capiStatus === 'sent' ? 'text-blue-400' : s.capiStatus === 'failed' ? 'text-red-400' : 'text-slate-600'
                  )}>CAPI: {s.capiStatus}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!loading && failedCapi.length === 0 && noMatch.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-green-400" />
          </div>
          <div className="text-white font-black uppercase tracking-widest text-sm">Sin Errores</div>
          <div className="text-slate-500 text-xs mt-2">Todo funcionando correctamente</div>
        </div>
      )}
    </div>
  );
}
