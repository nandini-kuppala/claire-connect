// Desk queue: tabs (Unassigned / Mine / All) with counts, rows with priority bar, parties, languages, AI summary and a live SLA chip.
import type { ReactNode } from 'react';
import { Inbox } from '../icons';
import { C, HEAD, LangChip, Spinner, useNow, type Ticket } from './kit';

export type QueueTab = 'unassigned' | 'mine' | 'all';

export const PRIORITY_COLOR: Record<string, string> = { P1: C.danger, P2: C.accent, P3: C.chipBorder };

export function SlaChip({ ticket, now }: { ticket: Ticket; now: number }) {
  if (ticket.status === 'resolved') return <Chip bg={C.successTint} fg={C.success}>Resolved</Chip>;
  if (ticket.firstResponseAt) return <Chip bg={C.sunken} fg={C.meta}>Responded</Chip>;
  if (!ticket.slaDueAt) return null;
  const left = ticket.slaDueAt - now;
  if (left <= 0) {
    const m = Math.max(1, Math.floor(-left / 60000));
    return <Chip bg={C.dangerTint} fg={C.danger}>Overdue {m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}</Chip>;
  }
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}:${String(secs).padStart(2, '0')}`;
  return left < 5 * 60000 ? <Chip bg={C.accentTint} fg={C.accentInk}>{label}</Chip> : <Chip bg={C.sunken} fg={C.ink2}>{label}</Chip>;
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold tabular-nums" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

export function QueuePane({
  tickets, myId, tab, onTab, selectedId, onSelect, loading,
}: {
  tickets: Ticket[]; myId: string; tab: QueueTab; onTab: (t: QueueTab) => void; selectedId: string | null; onSelect: (id: string) => void; loading: boolean;
}) {
  const now = useNow(1000);
  const open = tickets.filter((t) => t.status !== 'resolved');
  const lists: Record<QueueTab, Ticket[]> = {
    unassigned: open.filter((t) => !t.agentId),
    mine: tickets.filter((t) => t.agentId === myId && (t.status !== 'resolved' || (t.resolvedAt ?? 0) > now - 3600_000)),
    all: tickets,
  };
  const rank = (t: Ticket) => (t.status === 'resolved' ? 9 : 0) + Number(String(t.priority).replace(/\D/g, '') || 3);
  const list = [...lists[tab]].sort((a, b) => rank(a) - rank(b) || (a.slaDueAt ?? Infinity) - (b.slaDueAt ?? Infinity));

  return (
    <section className="flex min-h-0 flex-col border-r bg-surface" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className={`${HEAD} text-[17px] font-semibold`} style={{ color: C.ink }}>Queue</h2>
        {loading && <Spinner size={14} />}
      </div>
      <div className="flex gap-1 border-b px-3" style={{ borderColor: C.border }} role="tablist">
        {([
          ['unassigned', 'Unassigned'],
          ['mine', 'Mine'],
          ['all', 'All'],
        ] as [QueueTab, string][]).map(([k, label]) => {
          const on = tab === k;
          const n = k === 'all' ? open.length : lists[k].filter((t) => t.status !== 'resolved').length;
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => onTab(k)} className="relative flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium" style={{ color: on ? C.primary : C.meta }}>
              {label}
              <span className="min-w-5 rounded-full px-1.5 text-[11px] leading-5" style={{ background: on ? C.tint : C.sunken, color: on ? C.primary : C.ink2 }}>{n}</span>
              {on && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full" style={{ background: C.primary }} />}
            </button>
          );
        })}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {list.map((t) => {
          const on = t.id === selectedId;
          const parties = t.parties.length ? t.parties.map((p) => p.name).join(' ↔ ') : t.code;
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className="relative flex w-full gap-3 border-b py-3 pl-4 pr-3 text-left transition-colors hover:bg-page"
                style={{ borderColor: C.border, background: on ? C.tint : undefined, opacity: t.status === 'resolved' ? 0.6 : 1 }}
              >
                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full" style={{ background: PRIORITY_COLOR[t.priority] ?? C.border }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: C.ink }}>{parties}</span>
                    <SlaChip ticket={t} now={now} />
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: C.meta }}>
                    <span className="font-semibold" style={{ color: t.priority === 'P3' ? C.meta : t.priority === 'P2' ? C.accentInk : PRIORITY_COLOR[t.priority] }}>{t.priority}</span>
                    <span>·</span>
                    <span className="truncate">{t.typeLabel}</span>
                    <span className="ml-auto flex shrink-0 gap-1">{t.languages.slice(0, 3).map((l) => <LangChip key={l} code={l} />)}</span>
                  </span>
                  {(t.summary || t.description) && (
                    <span className="mt-1 block truncate text-[13px]" style={{ color: C.ink2 }}>{t.summary || t.description}</span>
                  )}
                  {t.agentName && tab !== 'mine' && (
                    <span className="mt-1 block text-[11px]" style={{ color: C.meta }}>{t.agentId === myId ? 'You' : t.agentName}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && !loading && (
          <li className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full" style={{ background: C.tint, color: C.primary }}><Inbox size={26} /></span>
            <p className="mt-3 text-[14px] font-semibold" style={{ color: C.ink }}>{tab === 'mine' ? 'Nothing assigned to you' : 'Queue is clear'}</p>
            <p className="mt-1 text-[12px]" style={{ color: C.meta }}>New tickets appear here within seconds.</p>
          </li>
        )}
      </ul>
    </section>
  );
}
