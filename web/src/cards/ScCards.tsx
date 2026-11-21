// Supply-chain cards in chat (04 §8.2). One payload for both businesses: this card works out the reader's side from
// fromBusinessId / toBusinessId, so badges and actions match who is reading. No prices are ever in the payload.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatQty } from '@shared/sc/units';
import type { Dimension } from '@shared/sc/types';
import type { CardOf } from './types';
import type { CardCtx } from './types';
import { AlertTriangle, ArrowDown, ArrowRight, CheckCircle2, Clock } from '../icons';
import { ScCardS } from './ScCards.strings';
import { useSession } from '../store/session';

const shortDate = (d: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  } catch {
    return d;
  }
};

const q = (base: number, dim: string) => {
  const f = formatQty(base, dim as Dimension);
  return `${f.value} ${f.unit}`;
};

export function MovementCard({ payload: p, ctx }: { payload: CardOf<'movement'>; ctx: CardCtx }) {
  const s = ScCardS.use();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const goodsOn = useSession((st) => st.features?.supplyChain === true);
  const meId = ctx.me.businessId;
  const iAmSender = meId === p.fromBusinessId;
  const iAmReceiver = meId === p.toBusinessId;
  const other = iAmSender ? p.toName : p.fromName;
  const isReturn = p.action === 'return_from_work';
  // Who confirms: the receiver of a send; the sender (job worker) of a return the owner recorded.
  const iConfirm = !done && p.state === 'sent' && ((iAmReceiver && !isReturn) || (iAmSender && isReturn));
  const title = isReturn ? (iAmSender ? s('sent_back_you', { name: p.toName }) : s('you_got_back', { name: p.fromName })) : iAmSender ? s('you_sent', { name: p.toName }) : s('sent_you', { name: p.fromName });
  const st =
    p.state === 'cancelled' ? { text: s('st_cancelled'), cls: 'bg-sunken text-ink-2', Icon: Clock }
    : p.state === 'disputed' ? { text: s('st_disputed'), cls: 'bg-danger-tint text-danger', Icon: AlertTriangle }
    : p.state === 'within_tolerance' ? { text: s('st_within'), cls: 'bg-success-tint text-success', Icon: CheckCircle2 }
    : p.state === 'confirmed' || done ? { text: s('st_confirmed'), cls: 'bg-success-tint text-success', Icon: CheckCircle2 }
    : iConfirm ? { text: s('st_sent'), cls: 'bg-accent-tint text-accent-ink', Icon: Clock }
    : { text: s('st_waiting', { name: other }), cls: 'bg-sunken text-ink-2', Icon: Clock };

  const confirmAll = async () => {
    setBusy(true);
    try {
      await api.post(`/api/sc/movements/${p.movementId}/${isReturn ? 'sender-figure' : 'confirm'}`, { lines: p.lines.map((l) => ({ line_id: l.lineId })) });
      setDone(true);
      ctx.refresh();
    } finally {
      setBusy(false);
    }
  };

  const Dir = iAmReceiver ? ArrowDown : ArrowRight;
  return (
    <div className="w-[min(92%,400px)] rounded-[18px] border border-line-strong bg-surface px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <Dir size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-head text-[15.5px] font-semibold leading-snug text-ink">{title}</p>
          <p className="text-[12.5px] text-meta">{[isReturn ? s('back') : s('for_work'), p.dcNo ? s('dc', { no: p.dcNo }) : null, shortDate(p.date, ctx.lang)].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-line text-[14px]">
        {p.lines.map((l) => (
          <li key={l.lineId} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 text-ink-2">{l.label}</span>
            <span className="shrink-0 text-right font-semibold tabular-nums text-ink">
              {q(l.sent, l.dim)}
              {l.received !== null && l.received !== undefined && l.received !== l.sent && <span className="block text-[12px] font-normal text-meta">{s('received_label')}: {q(l.received, l.dim)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <span className={clsx('mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold', st.cls)}>
        <st.Icon size={14} aria-hidden />
        {st.text}
      </span>
      {goodsOn && <div className="mt-2.5 flex flex-wrap gap-2">
        {iConfirm && (
          <>
            <button disabled={busy} onClick={() => void confirmAll()} className="min-h-11 flex-1 rounded-full bg-primary px-4 text-[14px] font-semibold text-white disabled:opacity-60">{busy ? s('confirming') : s('all_correct')}</button>
            <button onClick={() => nav(`/goods/movement/${p.movementId}`)} className="min-h-11 flex-1 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink">{s('different')}</button>
          </>
        )}
        {!iConfirm && p.state === 'disputed' && p.disputeId && (
          <button onClick={() => nav(`/goods/dispute/${p.disputeId}`)} className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink">{s('open')}</button>
        )}
        {!iConfirm && p.state !== 'disputed' && (
          <button onClick={() => nav(`/goods/movement/${p.movementId}`)} className="min-h-11 rounded-full px-2 text-[14px] font-semibold text-primary">{s('open')}</button>
        )}
      </div>}
    </div>
  );
}

export function DisputeCard({ payload: p }: { payload: CardOf<'dispute'> }) {
  const s = ScCardS.use();
  const goodsOn = useSession((st) => st.features?.supplyChain === true);
  const nav = useNavigate();
  const resolved = p.state === 'resolved' || p.state === 'cancelled';
  return (
    <div className="w-[min(92%,400px)] rounded-[18px] border border-line-strong bg-surface px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={20} className={clsx('mt-0.5 shrink-0', resolved ? 'text-meta' : 'text-danger')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-head text-[15.5px] font-semibold leading-snug text-ink">{s('dispute_title')}</p>
          <p className="text-[12.5px] text-meta">{p.lineLabel}</p>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
        <div className="rounded-[14px] bg-sunken px-3 py-2"><dt className="text-[12px] text-meta">{s('sent_label')}</dt><dd className="font-head font-bold tabular-nums text-ink">{q(p.sent, p.dim)}</dd></div>
        <div className="rounded-[14px] bg-sunken px-3 py-2"><dt className="text-[12px] text-meta">{s('received_label')}</dt><dd className="font-head font-bold tabular-nums text-ink">{q(p.received, p.dim)}</dd></div>
      </dl>
      <p className="mt-2 text-[13px] text-ink-2">{s('diff', { qty: q(Math.abs(p.difference), p.dim) })} · {s('allowed', { qty: q(p.allowed, p.dim) })}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={clsx('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', resolved ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger')}>{s(`d_${p.state}` as 'd_open')}</span>
        {goodsOn && <button onClick={() => nav(`/goods/dispute/${p.disputeId}`)} className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-primary">{s('open')}</button>}
      </div>
    </div>
  );
}
