import { useEffect, useState } from 'react';
import { Minus, Plus, Send } from '../icons';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { errMsg, inr, num, unitPer, unitQty } from './format';
import { strings } from './strings';
import { ChoiceChips, ErrorLine, Field, inputCls } from './ui';

export type Freight = 'paid' | 'to-pay';

export interface OfferValues {
  qty: number;
  unitPrice: number;
  dispatchDays: number;
  advancePct: number;
  creditDays: number;
  freight: Freight;
}

export interface OfferSheetProps {
  open: boolean;
  onClose: () => void;
  /** 'new' = full offer form; 'counter' = price only (respond endpoint takes unitPrice). */
  mode: 'new' | 'counter';
  lang: string;
  unit: string;
  title?: string;
  initial: Partial<OfferValues>;
  /** Price currently on the table (shown in counter mode, drives quick-pick chips). */
  theirPrice?: number;
  /** Seller countering a buyer: quick picks go above their price instead of below. */
  counterUp?: boolean;
  onSubmit: (values: OfferValues) => Promise<void>;
}

export const freightLabel = (f: string, t: ReturnType<typeof strings>) =>
  /^paid$/i.test(f) ? t('freight_paid') : /to.?pay/i.test(f) ? t('freight_topay') : /^extra$/i.test(f) ? t('freight_extra') : f;

const DISPATCH = [2, 3, 5, 7, 10];
const ADVANCE = [0, 30, 50, 100];
const CREDIT = [0, 7, 15, 30];

const roundPrice = (p: number) => (p >= 100 ? Math.round(p) : Math.round(p * 2) / 2);

export function OfferSheet({ open, onClose, mode, lang, unit, title, initial, theirPrice, counterUp = false, onSubmit }: OfferSheetProps) {
  const t = strings(lang);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [dispatchDays, setDispatch] = useState(3);
  const [advancePct, setAdvance] = useState(30);
  const [creditDays, setCredit] = useState(0);
  const [freight, setFreight] = useState<Freight>('to-pay');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setPrice(initial.unitPrice ? String(initial.unitPrice) : '');
    setQty(initial.qty ? String(initial.qty) : '');
    setDispatch(initial.dispatchDays ?? 3);
    setAdvance(initial.advancePct ?? 30);
    setCredit(initial.creditDays ?? 0);
    setFreight(initial.freight ?? 'to-pay');
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const p = Number(price);
  const q = Number(qty);
  const valid = p > 0 && Number.isFinite(p) && (mode === 'counter' || (q > 0 && Number.isInteger(q)));
  const total = valid ? p * (mode === 'counter' ? initial.qty ?? 0 : q) : 0;

  const step = (dir: 1 | -1) => {
    const cur = Number(price) || theirPrice || 0;
    const delta = cur >= 100 ? 1 : 0.5;
    setPrice(String(Math.max(0, roundPrice(cur + dir * delta))));
  };

  const quick =
    mode === 'counter' && theirPrice
      ? counterUp
        ? [3, 5, 8, 10].map((pct) => roundPrice(theirPrice * (1 + pct / 100))).filter((v, i, a) => a.indexOf(v) === i && v > theirPrice)
        : [1, 2, 3, 5].map((pct) => roundPrice(theirPrice * (1 - pct / 100))).filter((v, i, a) => a.indexOf(v) === i && v < theirPrice)
      : [];

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        qty: mode === 'counter' ? initial.qty ?? 0 : q,
        unitPrice: p,
        dispatchDays,
        advancePct,
        creditDays,
        freight,
      });
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const per = unitPer(unit);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'counter' ? t('counter_offer') : t('send_offer')}
      subtitle={title}
      footer={
        <>
          {valid && total > 0 && (
            <p className="mb-2 flex items-baseline justify-between text-[14px] text-ink-2">
              <span>
                {t('total')}
                {mode === 'new' && q > 0 && ` · ${num(q)} ${unitQty(unit, q)}`}
              </span>
              <span className="font-head text-[18px] font-bold text-ink tabular-nums">{inr(total)}</span>
            </p>
          )}
          <ErrorLine>{error}</ErrorLine>
          <Button block size="lg" icon={Send} loading={busy} disabled={!valid} onClick={submit} className="mt-1">
            {mode === 'counter' ? t('send_counter') : t('send_offer')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === 'counter' && theirPrice != null && (
          <p className="text-[14px] text-meta">
            {t('their_price')}: <span className="font-head font-semibold text-ink tabular-nums">{inr(theirPrice)} / {per}</span>
          </p>
        )}

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
            {mode === 'counter' ? t('your_price') : t('price_per', { unit: per })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Lower price"
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:bg-sunken"
            >
              <Minus size={20} />
            </button>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-head text-[24px] font-bold text-meta">₹</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                aria-label={t('price_per', { unit: per })}
                className="h-14 w-full rounded-[16px] border border-line bg-sunken pl-10 pr-14 font-head text-[26px] font-bold text-ink tabular-nums focus:border-primary focus:bg-surface focus:outline-none"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-meta">/ {per}</span>
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Raise price"
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:bg-sunken"
            >
              <Plus size={20} />
            </button>
          </div>
          {quick.length > 0 && (
            <div className="mt-2">
              <ChoiceChips label={t('your_price')} options={quick.map((v) => ({ value: v, label: inr(v) }))} value={p || null} onChange={(v) => setPrice(String(v))} />
            </div>
          )}
        </div>

        {mode === 'new' ? (
          <>
            <Field label={`${t('qty')} (${unitQty(unit)})`}>
              <input
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
                className={inputCls}
              />
            </Field>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{t('dispatch_days')}</span>
              <ChoiceChips label={t('dispatch_days')} options={DISPATCH.map((d) => ({ value: d, label: String(d) }))} value={dispatchDays} onChange={setDispatch} />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{t('advance_pct')}</span>
              <ChoiceChips label={t('advance_pct')} options={ADVANCE.map((d) => ({ value: d, label: `${d}%` }))} value={advancePct} onChange={setAdvance} />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{t('credit_days')}</span>
              <ChoiceChips
                label={t('credit_days')}
                options={CREDIT.map((d) => ({ value: d, label: d === 0 ? t('none') : t('days', { n: d }) }))}
                value={creditDays}
                onChange={setCredit}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{t('freight')}</span>
              <ChoiceChips<Freight>
                label={t('freight')}
                options={[
                  { value: 'to-pay', label: t('freight_topay') },
                  { value: 'paid', label: t('freight_paid') },
                ]}
                value={freight}
                onChange={setFreight}
              />
            </div>
          </>
        ) : (
          <p className="rounded-[16px] bg-sunken px-3 py-2.5 text-[13px] text-meta">{t('terms_same')}</p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default OfferSheet;
