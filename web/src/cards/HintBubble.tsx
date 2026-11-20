import { useState } from 'react';
import { Check, Lock, Send } from '../icons';
import type { HintPayload } from '@shared/cards';
import { ClaireMark } from '../components/Avatar';
import { Button } from '../components/Button';
import { dealT } from '../chat/deal.strings';
import type { CardCtx, ChatMessage } from './types';
import { cleanLabel, inr, num, unitPer, unitQty } from './format';
import { dealOf, theirPrice } from './dealCtx';

export interface HintBubbleProps {
  message: ChatMessage;
  payload: HintPayload;
  ctx: CardCtx;
}

/** `offer:90` / `counter:90` / `quote:90` → the draft Claire suggests sending. */
function parseDraft(chipId: string | undefined): { kind: 'offer' | 'counter' | 'quote'; price: number } | null {
  const m = /^(offer|counter|quote):(\d+(?:\.\d+)?)$/.exec(chipId ?? '');
  if (!m) return null;
  const price = Number(m[2]);
  return price > 0 ? { kind: m[1] as 'offer' | 'counter' | 'quote', price } : null;
}

/** Claire's private negotiation tip, visible to one side only, with an optional ready-to-send offer. */
export function HintBubble({ message, payload, ctx }: HintBubbleProps) {
  const dt = dealT(ctx.lang);
  const [used, setUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const action = payload.action;
  const deal = dealOf(ctx);
  const draft = parseDraft(action?.chipId);

  // Collapse once I've sent an offer after this tip (from here or anywhere else) or a newer card replaced it.
  const actedLater = Boolean(deal?.offers.some((o) => o.mine && (o.createdAt ?? 0) > message.sentAt));
  const stale = typeof ctx.latestCardAt === 'number' && message.sentAt < ctx.latestCardAt;
  const showAction = Boolean(action) && !used && !actedLater && !stale;

  const qty = deal?.qty ?? deal?.offers.at(-1)?.qty;
  const unit = deal?.unit ?? 'piece';
  const ref = theirPrice(deal);
  const savings = draft && draft.kind !== 'quote' && qty && ref && ref > draft.price ? Math.round((ref - draft.price) * qty) : 0;
  const value = draft && qty ? Math.round(draft.price * qty) : 0;

  const send = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await ctx.chip(action.chipId, cleanLabel(action.label));
      setUsed(true);
    } finally {
      setBusy(false);
    }
  };

  const draftLabel = draft?.kind === 'counter' ? dt('draft_counter') : draft?.kind === 'quote' ? dt('draft_quote') : dt('draft_offer');
  const sendLabel = draft?.kind === 'counter' ? dt('send_counter_to_supplier') : draft?.kind === 'quote' ? dt('send_quote_to_buyer') : dt('send_to_supplier');

  return (
    <div className="w-full max-w-[92%] animate-fade-up rounded-[22px] border border-accent/30 bg-accent-tint p-3.5">
      <div className="flex items-center gap-2.5">
        <ClaireMark size={30} />
        <div className="min-w-0 flex-1">
          <p className="font-head text-[15px] leading-tight font-semibold text-ink">{dt('claire_tip')}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] leading-tight text-accent-ink">
            <Lock size={12} aria-hidden className="shrink-0" />
            {dt('only_you')}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-[14px] leading-[1.5] whitespace-pre-line text-ink-2">{payload.text}</p>

      {action && showAction && draft && (
        <div className="mt-3 rounded-[18px] border border-line bg-surface p-3">
          <p className="text-[12px] font-semibold text-accent-ink">{draftLabel}</p>
          <div className="mt-1.5 flex items-stretch gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-ink">
                <span className="font-head text-[26px] leading-none font-bold tabular-nums">{inr(draft.price)}</span>
                <span className="text-[14px] text-meta"> / {unitPer(unit, ctx.lang)}</span>
              </p>
              {qty ? (
                <p className="mt-1 text-[13px] text-meta tabular-nums">
                  {num(qty)} {unitQty(unit, qty, ctx.lang)}
                </p>
              ) : null}
            </div>
            {savings > 0 ? (
              <div className="flex shrink-0 flex-col justify-center rounded-[16px] bg-success-tint px-3 py-2 text-right">
                <span className="text-[12px] leading-tight text-success">{dt('potential_savings')}</span>
                <span className="font-head text-[18px] leading-tight font-bold text-success tabular-nums">{inr(savings)}</span>
              </div>
            ) : value > 0 ? (
              <div className="flex shrink-0 flex-col justify-center rounded-[16px] bg-sunken px-3 py-2 text-right">
                <span className="text-[12px] leading-tight text-meta">{dt('order_value')}</span>
                <span className="font-head text-[17px] leading-tight font-bold text-ink tabular-nums">{inr(value)}</span>
              </div>
            ) : null}
          </div>
          <Button block icon={Send} loading={busy} onClick={() => void send()} className="mt-3">
            {sendLabel}
          </Button>
        </div>
      )}

      {action && showAction && !draft && (
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void send()} className="mt-3">
          {cleanLabel(action.label)}
        </Button>
      )}

      {action && (used || actedLater) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-success">
          <Check size={15} aria-hidden /> {dt('sent')}
        </p>
      )}
    </div>
  );
}

export default HintBubble;
