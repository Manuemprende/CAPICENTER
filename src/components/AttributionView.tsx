import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Target, RefreshCw, Link2, Link2Off, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const SCORE_COLOR = (score: number) =>
  score >= 90 ? 'text-blue-400' : score >= 70 ? 'text-cyan-400' : 'text-slate-500';

const STATUS_STYLE: Record<string, string> = {
  strong_match:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  attributed:    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  weak_match:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  no_match:      'bg-slate-800 text-slate-500 border-slate-700',
  manual_review: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function AttributionView() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '2026-01-01', to: format(new Date(), 'yyyy-MM-dd') });

  const fetch = () => {
    setLoading(true);
    const p = new URLSearchParams(dateRange);
    window.fetch(`/api/attribution?${p}&limit=200`)
      .then(r => r.json())
      .then(d => { setMatches(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [dateRange]);

  const strong = matches.filter(m => m.matchScore >= 90).length;
  const attributed = matches.filter(m => m.matchScore >= 70 && m.matchScore < 90).length;
  const weak = matches.filter(m => m.matchScore < 70).length;

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 text-white animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-0 bg-[#020617] py-4 z-20">
        <div>
          <h2 className="text-3xl font-black italic text-white tracking-tighter uppercase leading-none">
            Motor de <span className="text-blue-400 not-italic">Atribución</span>
          </h2>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">
            Matches Lead → Venta // {matches.length} registros
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950 p-2 border border-slate-900">
          <input type="date" className="bg-transparent text-xs text-blue-400 outline-none font-mono"
            value={dateRange.from} onChange={e => setDateRange(p => ({...p, from: e.target.value}))} />
          <span className="text-slate-700">→</span>
          <input type="date" className="bg-transparent text-xs text-blue-400 outline-none font-mono"
            value={dateRange.to} onChange={e => setDateRange(p => ({...p, to: e.target.value}))} />
          <Button variant="ghost" size="sm" onClick={fetch} className="text-slate-500 hover:text-blue-400">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Match Fuerte (≥90)', value: strong, color: 'blue', icon: <Link2 className="h-4 w-4" /> },
          { label: 'Atribuido (≥70)', value: attributed, color: 'cyan', icon: <Target className="h-4 w-4" /> },
          { label: 'Match Débil', value: weak, color: 'slate', icon: <Link2Off className="h-4 w-4" /> },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
            className="bg-slate-950 border border-slate-900 p-5 rounded-none">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{k.label}</span>
              <span className={`text-${k.color}-400`}>{k.icon}</span>
            </div>
            <div className={`text-3xl font-black mt-3 text-${k.color}-400`}>{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabla */}
      {/* MOBILE: Tarjetas */}
      <div className="md:hidden space-y-2">
        {matches.map((m, i) => (
          <div key={i} className="bg-slate-950 border border-slate-900 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-black text-white uppercase text-sm">{m.sale?.customerName || '—'}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{m.sale?.phone} · ${new Intl.NumberFormat('es-CL').format(m.sale?.amount || 0)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-2xl font-black tabular-nums", SCORE_COLOR(m.matchScore))}>{m.matchScore}</span>
                <div className={cn("h-2 w-2 rounded-full",
                  m.sale?.capiStatus === 'sent' ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' :
                  m.sale?.capiStatus === 'failed' ? 'bg-red-500' : 'bg-slate-700'
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/30 p-2">
                <div className="text-[8px] text-slate-600 uppercase font-black mb-0.5">Lead</div>
                <div className="text-[10px] text-slate-300 font-bold">{m.lead?.customerName || '—'}</div>
                <div className="text-[8px] text-slate-600 font-mono truncate">{m.lead?.phone}</div>
              </div>
              <div className="bg-black/30 p-2">
                <div className="text-[8px] text-slate-600 uppercase font-black mb-0.5">Método</div>
                <Badge className="text-[7px] font-black bg-slate-900 text-slate-400 border border-slate-800 rounded-none uppercase">
                  {m.matchType?.toUpperCase() || '—'}
                </Badge>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 truncate">{m.lead?.campaignName || m.sale?.campaignName || 'Sin campaña'}</div>
          </div>
        ))}
      </div>

      {/* DESKTOP: Tabla */}
      <Card className="hidden md:block border-slate-900 bg-slate-950 overflow-hidden rounded-none">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-900 hover:bg-transparent bg-slate-950">
              <TableHead className="text-[9px] font-black uppercase text-slate-500 py-4 pl-6 tracking-widest">Venta</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Lead</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Score</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Método</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Campaña</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">CAPI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m, i) => (
              <TableRow key={i} className="border-slate-900/50 hover:bg-blue-500/[0.015] transition-all">
                <TableCell className="pl-6 py-4">
                  <div className="font-black text-slate-200 text-xs uppercase">{m.sale?.customerName || '—'}</div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">${new Intl.NumberFormat('es-CL').format(m.sale?.amount || 0)}</div>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-slate-300 text-xs">{m.lead?.customerName || '—'}</div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">{m.lead?.phone}</div>
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn("text-xl font-black tabular-nums", SCORE_COLOR(m.matchScore))}>{m.matchScore}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className="text-[8px] font-black bg-slate-900 text-slate-400 border border-slate-800 rounded-none uppercase">{m.matchType?.toUpperCase() || '—'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-[10px] text-slate-400 font-bold truncate max-w-[140px]">{m.lead?.campaignName || 'Sin campaña'}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className={cn("h-1.5 w-1.5 rounded-full", m.sale?.capiStatus === 'sent' ? 'bg-blue-500' : m.sale?.capiStatus === 'failed' ? 'bg-red-500' : 'bg-slate-700')} />
                    <span className={cn("text-[8px] font-black uppercase", m.sale?.capiStatus === 'sent' ? 'text-blue-400' : m.sale?.capiStatus === 'failed' ? 'text-red-500' : 'text-slate-600')}>
                      {m.sale?.capiStatus === 'sent' ? 'OK' : m.sale?.capiStatus === 'failed' ? 'ERR' : 'PEND'}
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
  );
}
