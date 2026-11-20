import { useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Factory,
  FileText,
  IndianRupee,
  Info,
  Package,
  Truck,
  Wallet,
  type LucideIcon,
} from '../icons';
import { Button, type ButtonVariant } from '../components/Button';
import { Sheet } from '../components/Sheet';
import type { CardOf, CardProps } from './types';
import { errMsg, fmtDate, inr, num, unitPer, unitQty } from './format';
import { strings, type StrKey, type T } from './strings';
import { ChoiceChips, ErrorLine, Field, OrderStatusPill, Pill, inputCls } from './ui';
import { dealT } from '../chat/deal.strings';

type OrderPayload = CardOf<'order'>;
type EventType = 'advance_paid' | 'payment_confirmed' | 'in_production' | 'dispatched' | 'delivered' | 'balance_paid' | 'problem';
type Form = 'pay' | 'dispatch' | 'problem' | null;

const STEPS = ['confirmed', 'advance_paid', 'in_production', 'dispatched', 'delivered', 'balance_paid'] as const;
const DAY = 86_400_000;

function stepIndex(status: string): number {
  if (status === 'closed') return STEPS.length; // everything done
  if (status === 'disputed') return 4; // problems are raised on delivered goods
  const i = (STEPS as readonly string[]).indexOf(status);
  return i < 0 ? 0 : i;
}

interface Action {
  type: EventType;
  label: StrKey;
  icon: LucideIcon;
  variant: ButtonVariant;
  form: Form;
}

/** Older cards lack `advancePaid`; fall back to the status for them. */
const advanceIsPaid = (p: OrderPayload) => p.advancePaid ?? (p.status !== 'confirmed' && p.advancePct > 0);

function actionsFor(role: 'buyer' | 'seller' | 'viewer', p: OrderPayload): Action[] {
  const s = p.status;
  const out: Action[] = [];
  if (role === 'buyer') {
    // The seller may start production before the advance lands; the buyer can still record it.
    if ((s === 'confirmed' || s === 'in_production') && p.advancePct > 0 && !advanceIsPaid(p))
      out.push({ type: 'advance_paid', label: 'a_advance_paid', icon: IndianRupee, variant: 'primary', form: 'pay' });
    if (s === 'dispatched') out.push({ type: 'delivered', label: 'a_delivered', icon: Package, variant: 'primary', form: null });
    if (s === 'delivered') out.push({ type: 'balance_paid', label: 'a_balance_paid', icon: IndianRupee, variant: 'primary', form: 'pay' });
    if (s === 'dispatched' || s === 'delivered') out.push({ type: 'problem', label: 'a_problem', icon: AlertTriangle, variant: 'danger', form: 'problem' });
  } else if (role === 'seller') {
    const toConfirm = p.toConfirm ?? (p.advancePaid === undefined && s === 'advance_paid' ? 'advance' : undefined);
    if (toConfirm) out.push({ type: 'payment_confirmed', label: 'a_payment_confirmed', icon: Wallet, variant: 'primary', form: null });
    if (s === 'confirmed' || s === 'advance_paid')
      out.push({ type: 'in_production', label: 'a_in_production', icon: Factory, variant: s === 'confirmed' && p.advancePct === 0 ? 'primary' : 'secondary', form: null });
    if (s === 'in_production') out.push({ type: 'dispatched', label: 'a_dispatched', icon: Truck, variant: 'primary', form: 'dispatch' });
  }
  return out;
}

export function OrderCard({ payload, ctx }: CardProps<'order'>) {
  const t = strings(ctx.lang);
  const dt = dealT(ctx.lang);
  const role: 'buyer' | 'seller' | 'viewer' =
    ctx.me.businessId && ctx.me.businessId === payload.buyerBusinessId
      ? 'buyer'
      : ctx.me.businessId && ctx.me.businessId === payload.sellerBusinessId
        ? 'seller'
        : 'viewer';
  const [busy, setBusy] = useState<EventType | null>(null);
  const [sent, setSent] = useState<EventType | null>(null);
  const [form, setForm] = useState<{ kind: Exclude<Form, null>; action: Action } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const subtotal = payload.total;
  const gst = Math.round((subtotal * payload.gstPct) / 100);
  const grand = subtotal + gst;
  // Same basis as the server (server/src/money.ts): advance and balance are shares of the GST-inclusive total.
  const advanceAmt = Math.round((grand * payload.advancePct) / 100);
  const advancePaid = advanceIsPaid(payload);
  const balanceAmt = Math.max(0, grand - (advancePaid ? advanceAmt : 0));
  const idx = stepIndex(payload.status);
  const now = Date.now();

  const post = async (type: EventType, body: Record<string, unknown> = {}) => {
    setBusy(type);
    setError(null);
    try {
      await ctx.api.post(`/api/orders/${encodeURIComponent(payload.orderId)}/event`, { type, payload: body });
      setSent(type);
      setForm(null);
      ctx.refresh();
    } catch (e) {
      setError(errMsg(e));
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const actions = sent ? [] : actionsFor(role, payload);
  const [primary, ...rest] = actions;
  const cancelled = payload.status === 'cancelled';
  const finished = payload.status === 'closed' || payload.status === 'balance_paid';
  const dispatchText = payload.dispatch
    ? [payload.dispatch.transporter, payload.dispatch.lr && `${t('lr')} ${payload.dispatch.lr}`, payload.dispatch.bundles && `${payload.dispatch.bundles} ${t('bundles').toLowerCase()}`]
        .filter(Boolean)
        .join(' · ')
    : '';

  const balanceOpen = payload.balanceDueAt && !['balance_paid', 'closed', 'cancelled'].includes(payload.status);
  const overdueDays = balanceOpen && payload.balanceDueAt! < now ? Math.floor((now - payload.balanceDueAt!) / DAY) : 0;
  const counterpartName = role === 'buyer' ? payload.sellerName : role === 'seller' ? payload.buyerName : `${payload.buyerName} · ${payload.sellerName}`;
  const kindLabel = payload.kindLabel ? (payload.kindLabel === 'Sample' ? t('sample') : payload.kindLabel === 'Job work' ? t('job_work') : payload.kindLabel) : '';

  const steps = STEPS.map((s, i) => {
    // Production can start before the advance is paid: keep that step open until it is.
    const advanceOpen = s === 'advance_paid' && payload.advancePct > 0 && !advancePaid && i < idx && payload.status !== 'closed';
    const state: 'done' | 'current' | 'future' = advanceOpen ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future';
    const disputedHere = payload.status === 'disputed' && i === idx;
    let detail: string | null = null;
    if (s === 'dispatched' && i <= idx && dispatchText) detail = dispatchText;
    if (s === 'advance_paid' && payload.advancePct > 0) detail = `${inr(advanceAmt)} · ${payload.advancePct}%${advanceOpen ? ` · ${t('s_pending')}` : ''}`;
    if (s === 'balance_paid' && balanceOpen) detail = `${inr(balanceAmt)} · ${t('balance_due', { date: fmtDate(payload.balanceDueAt!, ctx.lang) })}`;
    return { s, i, state, disputedHere, detail, label: disputedHere ? t('s_disputed') : t(`s_${s}` as StrKey) };
  });
  const current = steps.find((x) => x.state === 'current');

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[22px] border border-line bg-surface text-ink">
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-primary-tint text-primary">
            <Package size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-tight text-meta">
              {t('order')}
              {kindLabel ? ` · ${kindLabel}` : ''} · <span className="font-semibold text-ink-2 tabular-nums">{payload.code}</span>
            </p>
            <p className="mt-0.5 font-head text-[16px] leading-snug font-semibold text-ink">{payload.title}</p>
          </div>
          <OrderStatusPill status={payload.status} t={t} />
        </div>

        <p className="mt-2 text-[13px] text-meta">
          <span className="tabular-nums">
            {num(payload.qty)} {unitQty(payload.unit, payload.qty, ctx.lang)} × {inr(payload.unitPrice)}/{unitPer(payload.unit, ctx.lang)}
          </span>{' '}
          · {counterpartName}
        </p>

        <div className="mt-3 flex items-end justify-between gap-3 rounded-[18px] bg-sunken px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] text-meta">{dt('order_total_incl')}</p>
            <p className="font-head text-[22px] leading-tight font-bold text-ink tabular-nums">{inr(grand)}</p>
          </div>
          <p className="shrink-0 text-right text-[12px] leading-snug text-meta tabular-nums">
            {inr(subtotal)}
            <br />+ {t('gst', { pct: payload.gstPct })} {inr(gst)}
          </p>
        </div>

        {payload.qtyDone != null && payload.qty > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[12px] text-meta">
              <span>{t('s_in_production')}</span>
              <span className="font-semibold text-ink tabular-nums">
                {num(payload.qtyDone)} / {num(payload.qty)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (payload.qtyDone / payload.qty) * 100)}%` }} />
            </div>
          </div>
        )}

        {!cancelled && (
          <div className="mt-3">
            {/* Compact progress: six segments and the step we are on. */}
            <div className="flex gap-1" aria-hidden>
              {steps.map((x) => (
                <span
                  key={x.s}
                  className={clsx(
                    'h-1.5 flex-1 rounded-full',
                    x.state === 'done' && 'bg-success',
                    x.state === 'current' && (x.disputedHere ? 'bg-danger' : 'bg-primary'),
                    x.state === 'future' && 'bg-sunken',
                  )}
                />
              ))}
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                {current ? (
                  <>
                    <p className={clsx('text-[14px] font-semibold', current.disputedHere ? 'text-danger' : 'text-ink')}>{current.label}</p>
                    {current.detail && <p className="text-[12px] text-meta">{current.detail}</p>}
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-success">
                    <CircleCheck size={16} aria-hidden /> {t('s_closed')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
                className="-mr-1 inline-flex min-h-[32px] shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[12px] font-semibold text-primary"
              >
                {showSteps ? dt('hide_steps') : dt('show_steps')}
                <ChevronDown size={14} aria-hidden className={clsx('transition-transform', showSteps && 'rotate-180')} />
              </button>
            </div>

            {showSteps && (
              <ol className="mt-2.5" aria-label={t('order')}>
                {steps.map((x) => {
                  const last = x.i === STEPS.length - 1;
                  return (
                    <li key={x.s} className="relative flex gap-3 pb-3 last:pb-0" aria-current={x.state === 'current' ? 'step' : undefined}>
                      {!last && <span aria-hidden className={clsx('absolute top-6 left-[11px] h-[calc(100%-18px)] w-0.5 rounded-full', x.i < idx ? 'bg-success' : 'bg-line')} />}
                      <span
                        aria-hidden
                        className={clsx(
                          'relative z-[1] mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full',
                          x.state === 'done' && 'bg-success text-white',
                          x.state === 'current' && !x.disputedHere && 'border-2 border-primary bg-surface',
                          x.disputedHere && 'border-2 border-danger bg-surface',
                          x.state === 'future' && 'border-2 border-line-strong bg-surface',
                        )}
                      >
                        {x.state === 'done' && <Check size={14} />}
                        {x.state === 'current' && <span className={clsx('size-2.5 rounded-full', x.disputedHere ? 'bg-danger' : 'bg-primary')} />}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className={clsx('text-[14px] leading-tight', x.state === 'future' ? 'text-faint' : 'text-ink', x.state === 'current' && 'font-semibold')}>{x.label}</p>
                        {x.detail && <p className="mt-0.5 text-[12px] text-meta tabular-nums">{x.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {(payload.ewayBill || overdueDays > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {payload.ewayBill && (
              <Pill tone="warning" icon={FileText}>
                {t('eway')}
              </Pill>
            )}
            {overdueDays > 0 && <Pill tone="danger">{t('overdue', { n: overdueDays })}</Pill>}
          </div>
        )}

        {payload.creditDays > 0 && balanceOpen && role !== 'viewer' && <CreditNote role={role} p={payload} t={t} now={now} />}

        {sent && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-success">
            <CircleCheck size={16} aria-hidden /> {t('updated')}
          </p>
        )}

        {primary && (
          <div className="mt-3">
            <Button
              block
              variant={primary.variant === 'danger' ? 'danger' : 'primary'}
              icon={primary.icon}
              loading={busy === primary.type}
              disabled={busy !== null}
              onClick={() => (primary.form ? setForm({ kind: primary.form, action: primary }) : void post(primary.type).catch(() => undefined))}
            >
              {t(primary.label)}
            </Button>
            {rest.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {rest.map((a) => (
                  <Button
                    key={a.type}
                    variant="ghost"
                    size="sm"
                    icon={a.icon}
                    className={a.variant === 'danger' ? 'text-danger hover:bg-danger-tint' : undefined}
                    loading={busy === a.type}
                    disabled={busy !== null}
                    onClick={() => (a.form ? setForm({ kind: a.form, action: a }) : void post(a.type).catch(() => undefined))}
                  >
                    {t(a.label)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {!primary && !sent && role !== 'viewer' && !cancelled && !finished && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-meta">
            <Clock size={14} aria-hidden /> {dt('waiting_for', { name: role === 'buyer' ? payload.sellerName : payload.buyerName })}
          </p>
        )}
        {!form && <ErrorLine>{error}</ErrorLine>}
      </div>

      <EventSheet
        form={form}
        onClose={() => setForm(null)}
        t={t}
        amount={form?.action.type === 'advance_paid' ? advanceAmt : balanceAmt}
        busy={busy !== null}
        error={error}
        onSubmit={(body) => (form ? post(form.action.type, body) : Promise.resolve())}
      />
    </div>
  );
}

function CreditNote({ role, p, t, now }: { role: 'buyer' | 'seller'; p: OrderPayload; t: T; now: number }) {
  const startedAt = p.balanceDueAt ? p.balanceDueAt - p.creditDays * DAY : null;
  const outstanding = startedAt && now > startedAt ? Math.floor((now - startedAt) / DAY) : 0;
  const text =
    role === 'buyer'
      ? t('rule45_buyer')
      : outstanding > 0 && ['delivered', 'disputed'].includes(p.status)
        ? t('outstanding', { n: outstanding })
        : t('rule45_seller', { n: p.creditDays });
  return (
    <p className="mt-2.5 flex items-start gap-1.5 rounded-[16px] bg-accent-tint px-3 py-2 text-[12px] leading-snug text-ink-2">
      <Info size={14} aria-hidden className="mt-px shrink-0 text-accent-ink" />
      {text}
    </p>
  );
}

const REASONS = ['short', 'damaged', 'colour', 'quality', 'other'] as const;

function EventSheet({
  form,
  onClose,
  t,
  amount,
  busy,
  error,
  onSubmit,
}: {
  form: { kind: Exclude<Form, null>; action: Action } | null;
  onClose: () => void;
  t: T;
  amount: number;
  busy: boolean;
  error: string | null;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [reference, setReference] = useState('');
  const [transporter, setTransporter] = useState('');
  const [lr, setLr] = useState('');
  const [bundles, setBundles] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState('');

  const kind = form?.kind ?? null;
  const valid = kind === 'dispatch' ? transporter.trim() !== '' && lr.trim() !== '' : kind === 'problem' ? reason !== null : true;

  const submit = () => {
    if (!valid || busy || !kind) return;
    const body =
      kind === 'pay'
        ? { reference: reference.trim() || undefined, amount }
        : kind === 'dispatch'
          ? { transporter: transporter.trim(), lr: lr.trim(), bundles: bundles ? Number(bundles) : undefined }
          : { reason, note: note.trim() || undefined };
    onSubmit(body).catch(() => undefined);
  };

  const title = form ? (kind === 'dispatch' ? t('dispatch_title') : kind === 'problem' ? t('problem_title') : t(form.action.label)) : '';

  return (
    <Sheet
      open={form !== null}
      onClose={onClose}
      title={title}
      footer={
        <>
          <ErrorLine>{error}</ErrorLine>
          <Button
            block
            size="lg"
            className="mt-1"
            icon={form?.action.icon}
            loading={busy}
            disabled={!valid}
            onClick={submit}
          >
            {form ? t(form.action.label) : ''}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {kind === 'pay' && (
          <>
            <div className="rounded-[18px] bg-sunken px-3.5 py-3">
              <p className="text-[13px] text-meta">{t('pay_amount')}</p>
              <p className="font-head text-[24px] font-bold text-ink tabular-nums">{inr(amount)}</p>
            </div>
            <Field label={t('pay_ref')}>
              <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
            </Field>
          </>
        )}
        {kind === 'dispatch' && (
          <>
            <Field label={t('transporter')}>
              <input className={inputCls} value={transporter} onChange={(e) => setTransporter(e.target.value)} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('lr')}>
                <input className={inputCls} value={lr} onChange={(e) => setLr(e.target.value)} inputMode="text" autoComplete="off" />
              </Field>
              <Field label={t('bundles')}>
                <input className={inputCls} value={bundles} onChange={(e) => setBundles(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
              </Field>
            </div>
          </>
        )}
        {kind === 'problem' && (
          <>
            <ChoiceChips
              label={t('problem_title')}
              options={REASONS.map((r) => ({ value: r, label: t(`p_${r}` as StrKey) }))}
              value={reason}
              onChange={setReason}
            />
            <Field label={t('note')}>
              <textarea className={clsx(inputCls, 'h-24 resize-none py-2.5')} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default OrderCard;
