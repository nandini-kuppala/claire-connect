// Dispute (03 S8): both figures, the difference and the allowance, four outcomes labelled from this side, the proposal
// thread, Accept, and Ask Trade Desk. Using the other side's figure settles at once.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { TradeS } from './Trade.strings';
import { ArrowLeft, ChevronRight, LifeBuoy } from '../../icons';
import { TwoS } from './Two.strings';
import { qty as fmtQty } from './format';

type Outcome = 'sent' | 'received' | 'split' | 'credit';
interface D {
  id: string; state: string; line_label: string; dim: string; counted: boolean; allowed: number; pct: number; figures: { sent: number; received: number }; difference: number;
  sender: { k: string; id: string; name: string }; receiver: { k: string; id: string; name: string }; side: 'sender' | 'receiver' | 'recorder'; twoSided: boolean;
  cause?: string | null; note?: string | null; kind?: string;
  lastProposal: { by_business_id: string; outcome: Outcome } | null; mayAccept: boolean; resolution: { outcome: Outcome } | null; ticket_id: string | null; role: 'owner' | 'staff';
}

export default function DisputeScreen() {
  const s = TwoS.use();
  const nav = useNavigate();
  const tr = TradeS.use();
  const { id } = useParams();
  const [d, setD] = useState<D | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desk, setDesk] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get<D>(`/api/sc/disputes/${id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  if (!d) return <p className="px-4 pt-6 text-[14px] text-meta">{error ?? ''}</p>;

  const short = d.difference > 0;
  const absDiff = Math.abs(d.difference);
  const mine: Outcome | null = d.side === 'sender' ? 'sent' : d.side === 'receiver' ? 'received' : null;
  const other = d.side === 'sender' ? d.receiver : d.sender;
  const fig = (o: Outcome) => (o === 'sent' ? d.figures.sent : d.figures.received);
  const effect = (o: Outcome) =>
    d.kind === 'casualty' ? '' :
    o === 'split' ? s('eff_split', { qty: fmtQty(Math.floor(absDiff / 2), d.dim) })
    : o === 'credit' ? s('eff_value')
    : o === 'received' && short ? (d.counted ? s('eff_mine_short', { name: d.sender.name }) : s('eff_loss'))
    : s('eff_theirs', { qty: fmtQty(fig(o), d.dim) });
  const outcomeName = (o: Outcome) => s(`o_${o}`);
  const casualty = d.kind === 'casualty';
  const options: { o: Outcome; label: string }[] = casualty
    ? [{ o: 'received', label: tr('accept_loss') }, { o: 'sent', label: tr('not_lost') }, { o: 'split', label: s('split') }, { o: 'credit', label: s('value') }]
    : mine
    ? [
        { o: mine, label: s('use_mine', { qty: fmtQty(fig(mine), d.dim) }) },
        { o: mine === 'sent' ? 'received' : 'sent', label: s('use_theirs', { name: other.name, qty: fmtQty(fig(mine === 'sent' ? 'received' : 'sent'), d.dim) }) },
        { o: 'split', label: s('split') },
        { o: 'credit', label: s('value') },
      ]
    : [
        { o: 'sent', label: s('use_theirs', { name: d.sender.name, qty: fmtQty(d.figures.sent, d.dim) }) },
        { o: 'received', label: s('use_theirs', { name: d.receiver.name, qty: fmtQty(d.figures.received, d.dim) }) },
        { o: 'split', label: s('split') },
        { o: 'credit', label: s('value') },
      ];
  const open = !['resolved', 'cancelled'].includes(d.state);
  const owner = d.role === 'owner';

  const act = async (path: string, body?: unknown) => {
    setBusy(path);
    setError(null);
    try {
      const r = await api.post<{ ticket?: { code: string } }>(`/api/sc/disputes/${d.id}/${path}`, body);
      if (r.ticket) setDesk(r.ticket.code);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="min-w-0">
          <h1 className="font-head text-[20px] font-bold leading-tight text-ink">{casualty ? tr('lost_title', { cause: tr(`c_${d.cause ?? 'other'}` as 'c_fire') }) : s('dispute')} · {fmtQty(absDiff, d.dim)}</h1>
          <p className="truncate text-[13px] text-meta">{d.line_label}</p>
        </div>
      </header>

      {casualty ? (
        <section className="mx-4 mt-4 rounded-[18px] border border-line bg-surface p-4 text-[15px] text-ink">
          <p>{tr('lost')} · <span className="font-semibold tabular-nums">{fmtQty(absDiff, d.dim)}</span> · {d.receiver.name}</p>
          {d.note && <p className="mt-1 text-[14px] text-ink-2">{d.note}</p>}
        </section>
      ) : (
      <section className="mx-4 mt-4 rounded-[18px] border border-line bg-surface p-4">
        <h2 className="font-head text-[16px] font-semibold text-ink">{s('what_differs')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([['sent', d.sender.name], ['received', d.receiver.name]] as const).map(([o, name]) => (
            <div key={o} className="rounded-[16px] bg-sunken px-3 py-2.5">
              <p className="text-[12.5px] text-meta">{o === 'sent' ? s('sent') : s('received')} · {name}</p>
              <p className="font-head text-[22px] font-bold tabular-nums text-ink">{fmtQty(fig(o), d.dim)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-ink-2">{s('diff')}: <span className="font-semibold tabular-nums">{fmtQty(absDiff, d.dim)}</span> ({d.pct} %) · {s('allowed')}: {d.counted ? '0' : fmtQty(d.allowed, d.dim)}</p>
      </section>
      )}

      {d.resolution ? (
        <p className="mx-4 mt-4 rounded-[14px] bg-success-tint px-3 py-2 text-[14.5px] font-semibold text-success">{s('settled', { outcome: outcomeName(d.resolution.outcome) })}</p>
      ) : (
        <>
          {d.lastProposal && (
            <div className="mx-4 mt-4 rounded-[16px] bg-accent-tint px-4 py-3 text-[14.5px] text-accent-ink">
              {d.lastProposal.by_business_id === (d.side === 'sender' ? d.sender.id : d.receiver.id)
                ? s('proposed_by_you', { outcome: outcomeName(d.lastProposal.outcome), name: other.name })
                : s('proposed_by_them', { name: other.name, outcome: outcomeName(d.lastProposal.outcome) })}
              {d.mayAccept && owner && (
                <Button className="mt-2" block loading={busy === 'accept'} onClick={() => void act('accept')}>{s('accept')}</Button>
              )}
            </div>
          )}
          <h2 className="mx-4 mt-5 font-head text-[17px] font-semibold text-ink">{s('how_settle')}</h2>
          <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {options.map(({ o, label }) => (
              <li key={o}>
                <button disabled={!open || !owner || !!busy} onClick={() => void act('propose', { outcome: o })} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-sunken disabled:opacity-60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold text-ink">{label}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-2">{effect(o)}</span>
                  </span>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="mx-4 mt-2 text-[13px] text-meta">{owner ? (d.twoSided ? s('concede_note') : '') : s('owner_only')}</p>
          {owner && d.twoSided && (
            <div className="mx-4 mt-4">
              {d.ticket_id || desk ? (
                <p className="text-[14px] text-ink-2">{s('with_desk', { code: desk ?? '' })}</p>
              ) : (
                <Button variant="ghost" icon={LifeBuoy} loading={busy === 'escalate'} onClick={() => void act('escalate')}>{s('trade_desk')}</Button>
              )}
            </div>
          )}
        </>
      )}
      {error && <p className={clsx('mx-4 mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger')}>{error}</p>}
    </div>
  );
}
