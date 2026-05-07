import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CapiEventsView() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '2026-01-01', to: format(new Date(), 'yyyy-MM-dd') });

  const fetchEvents = () => {
    setLoading(true);
    const p = new URLSearchParams({ ...dateRange, limit: '200' });
    if (filter !== 'all') p.set('status', filter);
    window.fetch(`/api/capi/events?${p}`)
      .then(r => r.json())
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, [filter, dateRange]);

  const sent    = events.filter(e => e.status === 'sent').length;
  const failed  = events.filter(e => e.status === 'failed').length;
  const pending = events.filter(e => e.status === 'pending').length;

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 text-white animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-0 bg-[#020617] py-4 z-20">
        <div>
          <h2 className="text-3xl font-black italic text-white tracking-tighter uppercase leading-none">
            Eventos <span className="text-blue-400 not-italic">CAPI</span>
          </h2>
          <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-bold">
            Log de Transmisiones a Meta Conversion API
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950 p-2 border border-slate-900">
          <input type="date" className="bg-transparent text-xs text-blue-400 outline-none font-mono"
            value={dateRange.from} onChange={e => setDateRange(p => ({...p, from: e.target.value}))} />
          <span className="text-slate-700">→</span>
          <input type="date" className="bg-transparent text-xs text-blue-400 outline-none font-mono"
            value={dateRange.to} onChange={e => setDateRange(p => ({...p, to: e.target.value}))} />
          <Button variant="ghost" size="sm" onClick={fetchEvents} className="text-slate-500 hover:text-blue-400">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPIs + Filtros */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Enviados', value: sent, status: 'sent', color: 'blue', icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: 'Fallidos', value: failed, status: 'failed', color: 'red', icon: <XCircle className="h-4 w-4" /> },
          { label: 'Pendientes', value: pending, status: 'pending', color: 'slate', icon: <Clock className="h-4 w-4" /> },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}
            onClick={() => setFilter(f => f === k.status ? 'all' : k.status as any)}
            className={cn("border p-5 rounded-none cursor-pointer transition-all",
              filter === k.status ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-950 border-slate-900 hover:border-slate-700'
            )}>
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{k.label}</span>
              <span className={`text-${k.color}-400`}>{k.icon}</span>
            </div>
            <div className={`text-3xl font-black mt-3 ${k.color === 'blue' ? 'text-blue-400' : k.color === 'red' ? 'text-red-400' : 'text-slate-500'}`}>
              {k.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabla de eventos */}
      <Card className="border-slate-900 bg-slate-950 overflow-hidden rounded-none">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-900 hover:bg-transparent bg-slate-950">
              <TableHead className="text-[9px] font-black uppercase text-slate-500 py-4 pl-6 tracking-widest">Cliente</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Event ID</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest text-center">Estado</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Monto</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Enviado</TableHead>
              <TableHead className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Error / Respuesta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev, i) => (
              <React.Fragment key={ev.id}>
                <TableRow
                  className={cn("border-slate-900/50 transition-all cursor-pointer",
                    ev.status === 'failed' ? 'hover:bg-red-500/[0.01]' : 'hover:bg-blue-500/[0.015]'
                  )}
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                >
                  <TableCell className="pl-6 py-4">
                    <div className="font-black text-slate-200 text-xs uppercase">
                      {ev.sale?.customerName || '—'}
                    </div>
                    <div className="text-[9px] text-slate-600 font-mono mt-0.5">{ev.sale?.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-[9px] text-slate-500 truncate max-w-[160px]">{ev.eventId}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[8px] font-black rounded-none border uppercase tracking-widest",
                      ev.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]' :
                      ev.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' :
                      'bg-slate-800 text-slate-500 border-slate-700'
                    )}>
                      {ev.status === 'sent' ? '✓ ENVIADO' : ev.status === 'failed' ? '✗ FALLIDO' : '⏳ PENDIENTE'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-black text-white font-mono text-sm">
                      ${new Intl.NumberFormat('es-CL').format(ev.sale?.amount || 0)}
                    </span>
                    <div className="text-[8px] text-slate-600 uppercase">{ev.sale?.currency || 'CLP'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {ev.sentAt ? format(new Date(ev.sentAt), 'dd/MM HH:mm:ss') : '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] text-slate-500 truncate max-w-[120px]">
                        {ev.error || (ev.status === 'sent' ? 'OK' : '—')}
                      </div>
                      {expanded === ev.id ? <ChevronUp className="h-3 w-3 text-slate-600" /> : <ChevronDown className="h-3 w-3 text-slate-700" />}
                    </div>
                  </TableCell>
                </TableRow>

                <AnimatePresence>
                  {expanded === ev.id && (
                    <TableRow className="border-slate-900/30 bg-black/30">
                      <TableCell colSpan={6} className="py-4 pl-6">
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Campaña / Anuncio</div>
                              <div className="text-xs text-slate-300">{ev.sale?.campaignName || 'Sin campaña'}</div>
                              <div className="text-[9px] text-slate-500 mt-1">{ev.sale?.adName || ''}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Respuesta Meta</div>
                              <pre className="text-[8px] text-slate-400 font-mono bg-black/50 p-2 rounded max-h-20 overflow-auto">
                                {ev.response ? JSON.stringify(JSON.parse(ev.response), null, 2).slice(0, 300) : ev.error || '—'}
                              </pre>
                            </div>
                          </div>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </TableBody>
        </div>
        </Table>
      </Card>
    </div>
  );
}
