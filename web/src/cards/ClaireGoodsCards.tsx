// Personal Claire's goods cards (04 §9.2): an answer whose rows are the records behind it, and a record draft that
// saves only when the user taps Save. Text arrives already in the reader's language; only buttons are local strings.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../lib/api';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Volume2 } from '../icons';
import type { CardCtx, CardOf } from './types';
import { ClaireGoodsS } from './ClaireGoods.strings';

const TONE: Record<string, string> = { late: 'bg-danger-tint text-danger', ready: 'bg-primary-tint text-primary', held: 'bg-accent-tint text-accent-ink', due: 'bg-accent-tint text-accent-ink' };

export function GoodsAnswerCard({ payload: p, ctx }: { payload: CardOf<'goods_answer'>; ctx: CardCtx }) {
  const nav = useNavigate();
  return (
    <div className="w-[min(92%,420px)] rounded-[18px] border border-line-strong bg-surface px-3.5 py-3">
      <p className="font-head text-[15.5px] font-semibold leading-snug text-ink">{p.title}</p>
      {p.rows.length > 0 && (
        <ul className="mt-1.5 divide-y divide-line">
          {p.rows.map((r, i) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{r.label}</span>
                  {r.sub && <span className={clsx('mt-0.5 block text-[12.5px]', r.tone ? 'text-ink-2' : 'text-meta')}>{r.sub}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={clsx('text-right font-head text-[15px] font-bold tabular-nums', r.tone && TONE[r.tone] && 'rounded-full px-2 py-0.5 text-[13.5px]', r.tone && TONE[r.tone])}>{r.value}</span>
                  {r.href && <ChevronRight size={16} className="text-meta" aria-hidden />}
                </span>
              </>
            );
            return (
              <li key={i}>
                {r.href ? <button className="flex w-full items-start gap-3 py-2 text-left hover:bg-sunken" onClick={() => nav(r.href!)}>{body}</button> : <div className="flex items-start gap-3 py-2">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {p.note && <p className="mt-1.5 text-[14px] text-ink-2">{p.note}</p>}
      <p className="mt-2 text-[12px] text-meta">{p.source}</p>
      {!!p.chips?.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.chips.map((c) => <button key={c.id} onClick={() => void ctx.chip(c.id, c.label)} className="min-h-10 rounded-full border border-line-strong px-3 text-[13.5px] font-semibold text-ink">{c.label}</button>)}
        </div>
      )}
    </div>
  );
}

export function RecordDraftCard({ payload, ctx }: { payload: CardOf<'record_draft'>; ctx: CardCtx }) {
  const s = ClaireGoodsS.use();
  const nav = useNavigate();
  const [p, setP] = useState(payload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The chat keeps the card as it was sent; the draft's current state (saved, cancelled) comes from the server.
  useEffect(() => {
    let live = true;
    void api.get<{ card: CardOf<'record_draft'> }>(`/api/sc/drafts/${payload.draftId}`).then((r) => live && setP(r.card)).catch(() => undefined);
    return () => { live = false; };
  }, [payload.draftId]);

  const act = async (path: 'save' | 'cancel') => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ card: CardOf<'record_draft'> }>(`/api/sc/drafts/${p.draftId}/${path}`);
      setP(r.card);
      ctx.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const readAloud = async () => {
    try {
      const r = await api.post<{ url: string | null }>('/api/voice/tts', { text: p.readBack, lang: ctx.lang });
      if (r.url) void new Audio(r.url).play();
    } catch { /* reading aloud is a convenience */ }
  };

  return (
    <div className="w-[min(92%,420px)] rounded-[18px] border border-line-strong bg-surface px-3.5 py-3">
      {p.state === 'draft' && <p className="text-[12.5px] font-semibold text-meta">{s('draft')}</p>}
      <p className="font-head text-[15.5px] font-semibold leading-snug text-ink">{p.header}</p>
      {p.partyName && <p className="text-[13.5px] text-ink-2">{p.partyName}</p>}
      <ul className="mt-1.5 divide-y divide-line text-[14px]">
        {p.lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 text-ink-2">{l.label}</span>
            <span className="shrink-0 font-head font-bold tabular-nums text-ink">{l.qty}</span>
          </li>
        ))}
      </ul>
      {p.notes.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {p.notes.map((n, i) => <li key={i} className="flex items-start gap-1.5 text-[13px] text-accent-ink"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{n}</li>)}
        </ul>
      )}
      {p.state === 'saved' ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-[12.5px] font-semibold text-success"><CheckCircle2 size={14} aria-hidden />{s('saved')}</span>
          {p.movementId && <button onClick={() => nav(`/goods/movement/${p.movementId}`)} className="min-h-10 rounded-full px-2 text-[14px] font-semibold text-primary">{s('open')}</button>}
        </div>
      ) : p.state === 'cancelled' || p.state === 'expired' ? (
        <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-semibold text-ink-2"><Clock size={14} aria-hidden />{p.state === 'cancelled' ? s('not_saved') : s('expired')}</span>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {p.canSave && <button disabled={busy} onClick={() => void act('save')} className="min-h-11 flex-1 rounded-full bg-primary px-4 text-[14px] font-semibold text-white disabled:opacity-60">{busy ? s('saving') : s('save')}</button>}
          <button onClick={() => nav(p.formHref)} className={clsx('min-h-11 rounded-full border px-4 text-[14px] font-semibold', p.canSave ? 'border-line-strong bg-surface text-ink' : 'flex-1 border-primary bg-primary text-white')}>{p.canSave ? s('change') : s('complete')}</button>
          <button disabled={busy} onClick={() => void act('cancel')} className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-ink-2">{s('cancel')}</button>
          <button onClick={() => void readAloud()} className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13.5px] font-semibold text-primary"><Volume2 size={15} aria-hidden />{s('read')}</button>
        </div>
      )}
      {error && <p className="mt-2 rounded-[12px] bg-danger-tint px-3 py-2 text-[13.5px] text-danger">{error}</p>}
    </div>
  );
}
