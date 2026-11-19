// Supervisor strip: open tickets by language, SLA breaches, agent load.
import { AlertTriangle, CheckCircle2, Clock, Users } from '../icons';
import { C, LangChip } from './kit';

export interface DeskStats {
  open: number;
  queued: number;
  byPriority: Record<string, number>;
  byLanguage: Record<string, number>;
  slaBreaches: number;
  resolvedToday: number;
  avgFirstResponseMin: number | null;
  agents: { id: string; name: string; languages: string[]; status: string; online: boolean; load: number; max: number }[];
}

export function normStats(r: any): DeskStats {
  return {
    open: r?.open ?? 0,
    queued: r?.queued ?? 0,
    byPriority: r?.byPriority ?? {},
    byLanguage: r?.byLanguage ?? {},
    slaBreaches: r?.slaBreaches ?? r?.sla_breaches ?? 0,
    resolvedToday: r?.resolvedToday ?? 0,
    avgFirstResponseMin: r?.avgFirstResponseMin ?? null,
    agents: Array.isArray(r?.agents) ? r.agents : [],
  };
}

export function SupervisorStrip({ stats }: { stats: DeskStats | null }) {
  if (!stats) return <div className="h-11 border-b bg-surface" style={{ borderColor: C.border }} />;
  const langs = Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex h-11 items-center gap-5 overflow-x-auto border-b bg-surface px-4 text-[12px] [scrollbar-width:none]" style={{ borderColor: C.border, color: C.ink2 }}>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="font-semibold" style={{ color: C.ink }}>{stats.open}</span> open
        <span style={{ color: C.meta }}>({stats.queued} queued)</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {langs.length ? langs.map(([l, n]) => (
          <span key={l} className="flex items-center gap-1"><LangChip code={l} /> <span className="tabular-nums">{n}</span></span>
        )) : <span style={{ color: C.meta }}>No open tickets</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1" style={{ color: stats.slaBreaches ? C.danger : C.ink2 }}>
        <AlertTriangle size={13} /> <span className="font-semibold">{stats.slaBreaches}</span> SLA breach{stats.slaBreaches === 1 ? '' : 'es'}
      </span>
      <span className="flex shrink-0 items-center gap-1"><CheckCircle2 size={13} color={C.success} /> {stats.resolvedToday} resolved today</span>
      {stats.avgFirstResponseMin != null && <span className="flex shrink-0 items-center gap-1"><Clock size={13} /> {stats.avgFirstResponseMin} min first reply</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <Users size={13} />
        {stats.agents.map((a) => (
          <span key={a.id} className="flex items-center gap-1" title={`${a.name}: ${a.load}/${a.max} · ${a.languages.join(', ').toUpperCase()}`}>
            <span className="size-2 rounded-full" style={{ background: a.online ? C.success : C.lineStrong }} />
            {a.name} <span className="tabular-nums" style={{ color: C.meta }}>{a.load}/{a.max}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
