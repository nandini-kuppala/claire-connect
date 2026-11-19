import { useState } from 'react';
import { CircleCheck, Scissors, Send } from '../icons';
import { Button } from '../components/Button';
import type { CardProps } from './types';
import { errMsg, inr, num } from './format';
import { strings } from './strings';
import { CardShell, ErrorLine, Eyebrow, Title } from './ui';

// Dye palette: loom green, marigold, madder, plum, turmeric ink, slate.
const PALETTE = ['#1F8C73', '#E9A23B', '#B9502F', '#6D4466', '#8A5A12', '#3C4247'];

/** A job-work order split across several units, with one-tap job offers to all. */
export function JobSplitCard({ payload, ctx }: CardProps<'job_split'>) {
  const t = strings(ctx.lang);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQty = payload.lines.reduce((s, l) => s + l.qty, 0);
  const n = payload.lines.length;

  const send = async () => {
    if (busy || sent) return;
    setBusy(true);
    setError(null);
    try {
      await ctx.api.post('/api/jobs/offer', { requirementId: payload.requirementId, lines: payload.lines });
      setSent(true);
      ctx.refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell>
      <div className="px-4 pt-4 pb-4">
        <Eyebrow icon={Scissors} className="mb-1.5 text-primary">
          {t('job_units', { n })}
        </Eyebrow>
        <Title>{payload.title}</Title>

        {totalQty > 0 && (
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={payload.lines.map((l) => `${l.businessName} ${l.qty}`).join(', ')}>
            {payload.lines.map((l, i) => (
              <span
                key={l.listingId + i}
                className="h-full border-r-2 border-surface last:border-r-0"
                style={{ width: `${(l.qty / totalQty) * 100}%`, background: PALETTE[i % PALETTE.length] }}
              />
            ))}
          </div>
        )}

        <ul className="mt-3 divide-y divide-line">
          {payload.lines.map((l, i) => (
            <li key={l.listingId + i} className="flex min-h-12 items-center gap-2.5 py-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
              <button
                type="button"
                onClick={() => ctx.openStorefront(l.businessId)}
                className="min-h-11 min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold text-ink hover:text-primary"
              >
                {l.businessName}
              </button>
              <span className="shrink-0 text-right text-[13px] text-ink-2 tabular-nums">
                <span className="font-semibold text-ink">{num(l.qty)}</span> × {inr(l.unitPrice)}
                <span className="block text-[11px] text-meta">{t('ready_in', { n: l.readyDays })}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-2 grid grid-cols-3 gap-2 rounded-[18px] bg-sunken px-3 py-3 text-center">
          <div>
            <p className="text-[11px] text-meta">{t('total_qty')}</p>
            <p className="font-head text-[16px] font-bold text-ink tabular-nums">{num(totalQty)}</p>
          </div>
          <div>
            <p className="text-[11px] text-meta">{t('avg_rate')}</p>
            <p className="font-head text-[16px] font-bold text-ink tabular-nums">{inr(payload.avgPrice)}</p>
          </div>
          <div>
            <p className="text-[11px] text-meta">{t('ready')}</p>
            <p className="font-head text-[16px] font-bold text-ink tabular-nums">{t('days', { n: payload.readyDays })}</p>
          </div>
        </div>
        <p className="mt-2 text-right text-[13px] text-meta">
          {t('job_value')} <span className="font-head font-bold text-ink tabular-nums">{inr(payload.total)}</span>
        </p>

        {sent ? (
          <p className="mt-3 flex items-start gap-2 rounded-[18px] bg-success-tint px-3.5 py-3 text-[14px] leading-[1.45] font-medium text-success">
            <CircleCheck size={17} aria-hidden className="mt-px shrink-0" />
            {t('jobs_sent', { n })}
          </p>
        ) : (
          <Button block size="lg" className="mt-3" icon={Send} loading={busy} onClick={send}>
            {n === 1 ? t('send_job') : t('send_jobs', { n })}
          </Button>
        )}
        <ErrorLine>{error}</ErrorLine>
      </div>
    </CardShell>
  );
}

export default JobSplitCard;
