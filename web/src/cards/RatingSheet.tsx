import { useState } from 'react';
import clsx from 'clsx';
import { Send, Star, ThumbsDown, ThumbsUp } from '../icons';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import type { CardCtx, CardOf } from './types';
import { errMsg } from './format';
import { strings } from './strings';
import { ErrorLine, inputCls } from './ui';

type RatingPayload = CardOf<'rating'>;

export function StarRow({ value, onChange, label, size = 'lg' }: { value: number; onChange?: (n: number) => void; label: string; size?: 'lg' | 'sm' }) {
  const readOnly = !onChange;
  return (
    <div role={readOnly ? 'img' : 'radiogroup'} aria-label={readOnly ? `${label}: ${value}/5` : label} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const icon = <Star size={size === 'lg' ? 28 : 16} aria-hidden className={on ? 'fill-accent text-accent' : 'text-line-strong'} />;
        if (readOnly) return <span key={n}>{icon}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n}`}
            onClick={() => onChange(n)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:bg-accent-tint active:scale-90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

export interface RatingFormProps {
  payload: RatingPayload;
  ctx: CardCtx;
  /** Called with the average star score once the rating is saved. */
  onDone: (avg: number) => void;
}

/** The rating form itself — used inline by the rating card and inside RatingSheet. */
export function RatingForm({ payload, ctx, onDone }: RatingFormProps) {
  const t = strings(ctx.lang);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(payload.questions.filter((q) => q.auto).map((q) => [q.id, Math.max(1, Math.min(5, Math.round(q.auto!)))])),
  );
  const [repeat, setRepeat] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = payload.questions.every((q) => scores[q.id] >= 1) && repeat !== null;
  const avg = payload.questions.length ? payload.questions.reduce((s, q) => s + (scores[q.id] ?? 0), 0) / payload.questions.length : 0;

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await ctx.api.post('/api/ratings', { orderId: payload.orderId, scores, wouldRepeat: repeat, comment: comment.trim() || undefined });
      onDone(avg);
      ctx.refresh();
    } catch (e) {
      const msg = errMsg(e);
      if (/already/i.test(msg)) onDone(avg);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const repeatQ = payload.direction === 'buyer_to_seller' ? t('would_repeat_seller') : t('would_repeat_buyer');

  return (
    <div className="space-y-3">
      {payload.questions.map((q) => (
        <div key={q.id}>
          <p className="text-[14px] font-medium text-ink">{q.label}</p>
          <div className="-ml-1.5">
            <StarRow label={q.label} value={scores[q.id] ?? 0} onChange={(n) => setScores((s) => ({ ...s, [q.id]: n }))} />
          </div>
        </div>
      ))}
      <div>
        <p className="text-[14px] font-medium text-ink">{repeatQ}</p>
        <div role="radiogroup" aria-label={repeatQ} className="mt-1.5 grid grid-cols-2 gap-2">
          {([true, false] as const).map((v) => {
            const on = repeat === v;
            const Icon = v ? ThumbsUp : ThumbsDown;
            return (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRepeat(v)}
                className={clsx(
                  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border text-[14px] font-medium transition-colors',
                  on
                    ? v
                      ? 'border-success bg-success-tint text-success'
                      : 'border-danger bg-danger-tint text-danger'
                    : 'border-line bg-surface text-ink-2 hover:bg-sunken',
                )}
              >
                <Icon size={18} aria-hidden />
                {v ? t('yes') : t('no')}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('comment')}
        aria-label={t('comment')}
        rows={2}
        className={clsx(inputCls, 'h-auto min-h-[72px] resize-none rounded-[16px] bg-sunken py-2.5 focus:bg-surface')}
      />
      <ErrorLine>{error}</ErrorLine>
      <Button block icon={Send} loading={busy} disabled={!complete} onClick={submit}>
        {t('submit')}
      </Button>
    </div>
  );
}

export interface RatingSheetProps {
  open: boolean;
  onClose: () => void;
  payload: RatingPayload;
  ctx: CardCtx;
  onDone?: (avg: number) => void;
}

/** Rating in a bottom sheet (e.g. from the Orders screen). */
export function RatingSheet({ open, onClose, payload, ctx, onDone }: RatingSheetProps) {
  const t = strings(ctx.lang);
  return (
    <Sheet open={open} onClose={onClose} title={t('rate_title', { name: payload.rateeName })} subtitle={t('thanks_rating')}>
      <div className="pt-1">
        <RatingForm
          payload={payload}
          ctx={ctx}
          onDone={(avg) => {
            onDone?.(avg);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}

export default RatingSheet;
