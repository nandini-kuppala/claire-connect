// Right-hand context panel: AI brief + next step, order timeline, both parties' trust profiles, actions.
import { useState } from 'react';
import { BadgeCheck, CheckCircle2, Circle, IndianRupee, Lightbulb, Phone, ShieldAlert, Video } from '../icons';
import { useCanCall } from '../call/CallButtons';
import { startCall, useCallStore, type CallContext } from '../call/service';
import { Avatar, ClaireMark } from '../components/Avatar';
import { C, HEAD, LangChip, StatusPill, TrustBreakdown, TrustRing, fmtTime, inr, unitShort, type Order, type Ticket, type Trust } from './kit';

export interface Party {
  id: string; name: string; ownerName?: string | null; city?: string | null; language?: string | null; accent?: string | null; role?: string | null;
  side: 'buyer' | 'seller' | null; trust: Trust | null;
  /** Owner user ids (Nexconn ids) the agent can call. */
  userIds?: string[];
}
export interface OrderEvent { id: string; type: string; at: number | null; payload?: Record<string, unknown> | null }

const EVENT_LABEL: Record<string, string> = {
  created: 'Order confirmed', confirmed: 'Order confirmed', advance_paid: 'Advance paid', payment_confirmed: 'Payment confirmed', in_production: 'In production',
  dispatched: 'Dispatched', delivered: 'Delivered', balance_paid: 'Balance paid', problem: 'Problem reported', overdue: 'Balance overdue',
  dispute_resolved: 'Dispute resolved', closed: 'Closed', progress: 'Progress update',
};
const ALERT_EVENTS = new Set(['problem', 'overdue']);

export const OUTCOMES = ['Payment received', 'Partial payment agreed', 'Replacement or credit note', 'Delivery rescheduled', 'No issue found', 'Question answered'];

export function ContextPanel({
  ticket, parties, order, events, callContext, joined, busy, onMarkPaid, onResolve,
}: {
  ticket: Ticket; parties: Party[]; order: Order | null; events: OrderEvent[]; callContext: CallContext; joined: boolean; busy: string | null;
  onMarkPaid: () => void; onResolve: (r: { outcome: string; upheld: boolean; againstBusinessId: string | null; note: string | null }) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [upheld, setUpheld] = useState(false);
  const [against, setAgainst] = useState<string | null>(null);
  const [openTrust, setOpenTrust] = useState<string | null>(null);
  const canCall = useCanCall();
  const inCall = useCallStore((s) => s.phase !== 'idle' && s.phase !== 'notice' && s.phase !== 'ended');

  const resolved = ticket.status === 'resolved';
  const paid = order && ['balance_paid', 'closed'].includes(order.status);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l bg-surface" style={{ borderColor: C.border }}>
      {/* Brief */}
      <section className="border-b p-4" style={{ borderColor: C.border }}>
        <h3 className={`flex items-center gap-2 ${HEAD} text-[15px] font-semibold`} style={{ color: C.ink }}>
          <ClaireMark size={22} /> Claire's summary
        </h3>
        <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed" style={{ color: C.ink }}>{ticket.summary || ticket.description || 'Summary is being prepared…'}</p>
        {ticket.nextStep && (
          <div className="mt-3 flex gap-2 rounded-[16px] p-3" style={{ background: C.accentTint }}>
            <Lightbulb size={16} color={C.accentInk} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-semibold" style={{ color: C.accentInk }}>Suggested next step</p>
              <p className="mt-0.5 text-[13px]" style={{ color: C.ink }}>{ticket.nextStep}</p>
            </div>
          </div>
        )}
      </section>

      {/* Order timeline */}
      {order && (
        <section className="border-b p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center justify-between">
            <h3 className={`${HEAD} text-[15px] font-semibold`} style={{ color: C.ink }}>Order <span className="tabular-nums" style={{ color: C.meta }}>{order.code}</span></h3>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-2 text-[14px] font-medium" style={{ color: C.ink }}>{order.title}</p>
          <p className="text-[13px]" style={{ color: C.ink2 }}>
            {order.qty.toLocaleString('en-IN')} {unitShort(order.unit)} × {inr(order.unitPrice)} = <b style={{ color: C.ink }}>{inr(order.total)}</b>
          </p>
          <p className="text-[12px]" style={{ color: C.meta }}>
            {order.advancePct}% advance · {order.creditDays ? `${order.creditDays} days credit` : 'no credit'}
            {order.balanceDueAt && ` · balance due ${fmtTime(order.balanceDueAt)}`}
          </p>
          {events.length > 0 && (
            <ol className="mt-3 space-y-0">
              {events.map((e, i) => {
                const alert = ALERT_EVENTS.has(e.type);
                const last = i === events.length - 1;
                return (
                  <li key={e.id || i} className="relative flex gap-2.5 pb-3">
                    {!last && <span className="absolute left-[7px] top-4 h-full w-px" style={{ background: C.border }} />}
                    {alert ? <ShieldAlert size={15} color={C.danger} className="relative mt-0.5 shrink-0 rounded-full bg-surface" /> : last ? <Circle size={15} color={C.primary} fill={C.primary} className="relative mt-0.5 shrink-0" /> : <CheckCircle2 size={15} color={C.success} className="relative mt-0.5 shrink-0 rounded-full bg-surface" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium" style={{ color: alert ? C.danger : C.ink }}>{EVENT_LABEL[e.type] ?? e.type.replace(/_/g, ' ')}</span>
                      <span className="block text-[11px]" style={{ color: C.meta }}>{fmtTime(e.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* Parties */}
      <section className="border-b p-4" style={{ borderColor: C.border }}>
        <h3 className={`${HEAD} text-[15px] font-semibold`} style={{ color: C.ink }}>Parties</h3>
        <div className="mt-2 space-y-2">
          {parties.map((p) => (
            <div key={p.id} className="rounded-[18px] border p-3" style={{ borderColor: C.border, background: C.page }}>
              <button className="flex w-full items-center gap-2.5 text-left" onClick={() => setOpenTrust(openTrust === p.id ? null : p.id)}>
                <Avatar name={p.name} accent={p.accent} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold" style={{ color: C.ink }}>{p.name}</span>
                    {p.language && <LangChip code={p.language} />}
                  </span>
                  <span className="block truncate text-[12px]" style={{ color: C.meta }}>
                    {[p.side ? p.side[0].toUpperCase() + p.side.slice(1) : null, p.role, p.city].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {p.trust && <TrustRing score={p.trust.score} size={38} isNew={p.trust.isNew} />}
              </button>
              {p.trust && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: C.ink2 }}>
                  {p.trust.ratingAvg != null && <span>★ {p.trust.ratingAvg} ({p.trust.ratingCount})</span>}
                  {p.trust.paysOnTime && <span>Pays on time {p.trust.paysOnTime}</span>}
                  {p.trust.onTimePct != null && <span>{p.trust.onTimePct}% on time</span>}
                  {p.trust.badges.includes('GST verified') && <span className="inline-flex items-center gap-0.5" style={{ color: C.success }}><BadgeCheck size={12} /> GST</span>}
                </div>
              )}
              {openTrust === p.id && p.trust && <div className="mt-3"><TrustBreakdown trust={p.trust} /></div>}
            </div>
          ))}
          {!parties.length && <p className="text-[13px]" style={{ color: C.meta }}>No businesses linked.</p>}
        </div>
      </section>

      {/* Actions */}
      <section className="p-4">
        <h3 className={`${HEAD} text-[15px] font-semibold`} style={{ color: C.ink }}>Actions</h3>
        {canCall && (
          <div className="mt-2 space-y-2">
            {[...parties]
              .sort((a, b) => (a.side === 'buyer' ? -1 : b.side === 'buyer' ? 1 : 0))
              .slice(0, 3)
              .map((party) => {
                const side = party.side ?? party.name;
                const userId = party.userIds?.[0];
                const call = (media: 'audio' | 'video') =>
                  userId &&
                  void startCall(
                    { userId, name: party.ownerName ? `${party.ownerName} · ${party.name}` : party.name, accent: party.accent, trust: party.trust?.score ?? null, sub: [party.role, party.city].filter(Boolean).join(' · ') || null },
                    media,
                    callContext,
                  );
                const btn = 'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45';
                return (
                  <div key={party.id} className="flex gap-2">
                    <button disabled={!userId || inCall} onClick={() => call('audio')} className={`${btn} min-w-0 px-3`} style={{ borderColor: C.lineStrong, color: C.ink2, background: C.surface }} title={`Voice call ${party.name}`}>
                      <Phone size={14} /> <span className="truncate">Call {side}</span>
                    </button>
                    <button disabled={!userId || inCall} onClick={() => call('video')} className={`${btn} max-w-[110px]`} style={{ borderColor: C.lineStrong, color: C.ink2, background: C.surface }} title={`Video call ${party.name}`} aria-label={`Video call ${side}`}>
                      <Video size={15} /> Video
                    </button>
                  </div>
                );
              })}
          </div>
        )}
        {order && (
          <button
            onClick={onMarkPaid}
            disabled={!!paid || busy === 'paid' || resolved}
            className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold disabled:opacity-50"
            style={{ background: C.successTint, color: C.success }}
          >
            <IndianRupee size={14} /> {paid ? 'Payment received' : busy === 'paid' ? 'Saving…' : 'Mark payment received'}
          </button>
        )}

        {!resolved && !resolving && (
          <button
            onClick={() => setResolving(true)}
            disabled={!joined}
            title={joined ? undefined : 'Join the conversation first'}
            className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold text-white disabled:opacity-45"
            style={{ background: C.primary }}
          >
            <CheckCircle2 size={14} /> Resolve with outcome
          </button>
        )}

        {resolving && !resolved && (
          <div className="mt-3 rounded-[18px] border p-3" style={{ borderColor: C.border, background: C.page }}>
            <p className="text-[13px] font-semibold" style={{ color: C.ink }}>Outcome</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className="h-8 rounded-full border px-2.5 text-[12px] font-medium"
                  style={{ borderColor: outcome === o ? C.primary : C.chipBorder, background: outcome === o ? C.primary : C.surface, color: outcome === o ? '#fff' : C.primary }}
                >
                  {o}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for both parties (optional)"
              rows={2}
              className="mt-2 w-full resize-none rounded-[14px] border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
              style={{ borderColor: C.border }}
            />
            {parties.length > 1 && (
              <label className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: C.ink2 }}>
                <input type="checkbox" checked={upheld} onChange={(e) => { setUpheld(e.target.checked); if (!e.target.checked) setAgainst(null); }} className="size-4 accent-danger" />
                Complaint upheld (trust penalty)
              </label>
            )}
            {upheld && (
              <select value={against ?? ''} onChange={(e) => setAgainst(e.target.value || null)} className="mt-2 h-10 w-full rounded-[14px] border bg-surface px-3 text-[13px]" style={{ borderColor: C.border }}>
                <option value="">Against which business?</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="mt-3 flex gap-2">
              <button className="h-10 flex-1 rounded-full text-[13px] font-medium" style={{ color: C.ink2, background: C.sunken }} onClick={() => setResolving(false)}>Cancel</button>
              <button
                className="h-10 flex-1 rounded-full text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: C.primary }}
                disabled={!(outcome || note.trim()) || busy === 'resolve' || (upheld && !against)}
                onClick={() => onResolve({ outcome: [outcome, note.trim()].filter(Boolean).join(' — '), upheld, againstBusinessId: against, note: note.trim() || null })}
              >
                {busy === 'resolve' ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          </div>
        )}
        {resolved && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: C.success }}>
            <CheckCircle2 size={14} /> Resolved {ticket.resolvedAt ? fmtTime(ticket.resolvedAt) : ''}
          </p>
        )}
      </section>
    </aside>
  );
}
