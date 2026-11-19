// Shared data + building blocks for the Results and Compare screens (GET /api/requirements/:id).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/AppShell';
import clsx from 'clsx';
import { ArrowLeft, BadgeCheck, Check, Clock, Eye, Factory, Star, Users, type LucideIcon } from '../icons';
import { api, errorText } from '../lib/api';
import GarmentArt from '../components/GarmentArt';
import { badgeLabel, strings as cardStrings } from '../cards/strings';
import { RS, type RT } from './results.strings';

// ── Server shapes (server/src/routes/requirements.ts) ─────────────────────
export interface Supplier {
  businessId: string;
  name: string;
  city: string | null;
  trust: number;
  isNew: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  orders: number;
  onTimePct: number | null;
  badges: string[];
  gstVerified: boolean;
  isManufacturer: boolean;
  replyMinutes: number | null;
}

export interface Art {
  shape: string;
  color: string;
  pattern?: string;
}

export interface RLine {
  listingId: string;
  businessId: string;
  businessName: string;
  qty: number;
  unitPrice: number;
  readyDays: number;
  listingTitle: string;
  stock: number;
  moq: number;
  unit: string;
  art?: Art;
  supplier: Supplier;
}

export interface RCard {
  key: string;
  kind: 'single' | 'combo' | 'mto';
  lines: RLine[];
  avgPrice: number;
  total: number;
  freight: number;
  readyDays: number;
  deliveryDays: number;
  onTime: boolean;
  trust: number;
  badges: string[];
  art?: Art;
  rating?: number;
  onTimePct?: number;
  stock?: number;
  bestPrice?: boolean;
  fastest?: boolean;
  recommended?: boolean;
}

export interface Requirement {
  id: string;
  title: string;
  categoryId: string;
  qty: number;
  unit: string;
  budget: number | null;
  deadlineDays: number | null;
  city: string | null;
  createdAt: number;
  matchCount: number;
  type?: string;
  shape?: string;
}

export interface Band {
  p25: number;
  median: number;
  p75: number;
}

export interface Detail {
  requirement: Requirement;
  results: { singles: RCard[]; combos: RCard[]; mto: RCard[]; band: Band | null; aboveBudget: boolean; short?: number };
  recommendation: { key: string; kind: RCard['kind']; listingId: string; businessId: string; businessName: string; reason: string } | null;
  insights: { freight: number; transitDays: number; budget: number | null; lowest: number | null };
}

export function useRequirement(id: string | undefined) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<Detail>(`/api/requirements/${encodeURIComponent(id)}`));
    } catch (e) {
      setError({ status: (e as { status?: number }).status ?? 0, text: errorText(e) });
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}

// ── Formatting ────────────────────────────────────────────────────────────
export function inr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) < 1000 ? 2 : 0 });
}
export const num = (n: number) => n.toLocaleString('en-IN');

/** Unit word: plural after a quantity ("500 pcs"), singular after "per" ("₹98 / pc"). */
export function unitOf(s: RT, unit: string, one = false) {
  const u = unit === 'kg' ? 'kg' : unit === 'dozen' ? 'dozen' : 'piece';
  return s(`u_${u}${one ? '1' : ''}` as Parameters<RT>[0]);
}
export const daysText = (s: RT, n: number) => (n <= 1 ? s('day_1') : s('days_n', { n }));
export const readyText = (s: RT, n: number) => (n <= 1 ? s('ready_1') : s('ready_in', { n }));

/** "500 pcs · ≤ ₹120/pc · 14 days · Kolkata" */
export function summaryLine(s: RT, r: Requirement) {
  const parts = [
    `${num(r.qty)} ${unitOf(s, r.unit)}`,
    r.budget ? s('budget_le', { price: inr(r.budget), unit: unitOf(s, r.unit, true) }) : s('any_budget'),
    r.deadlineDays ? daysText(s, r.deadlineDays) : s('flexible'),
  ];
  if (r.city) parts.push(r.city);
  return parts.join(' · ');
}

export function joinNames(s: RT, names: string[]) {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + s('and') + names[names.length - 1];
}

/** Single-seller options (singles + made-to-order), in server order. */
export const sellerCards = (d: Detail) => [...d.results.singles, ...d.results.mto];

// ── Header ──
export function useBack(fallback = '/') {
  const nav = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav(fallback, { replace: true });
  };
}

export function PageHeader({ title, sub, back }: { title: string; sub?: string; back: () => void }) {
  const s = RS.use();
  return (
    <ScreenHeader className="gap-1 py-2">
      <button
        type="button"
        onClick={back}
        aria-label={s('back')}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-sunken"
      >
        <ArrowLeft size={22} aria-hidden />
      </button>
      <div className="min-w-0 flex-1 pr-3">
        <h1 className="truncate font-head text-[20px] leading-tight font-bold text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] leading-snug text-meta">{sub}</p>}
      </div>
    </ScreenHeader>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────
export function Thumb({ art, shape, className, w = 84, h = 96 }: { art?: Art; shape?: string; className?: string; w?: number; h?: number }) {
  return (
    <GarmentArt
      shape={art?.shape ?? shape ?? 'tshirt'}
      color={art?.color}
      pattern={art?.pattern}
      className={clsx('shrink-0 overflow-hidden rounded-[16px]', className)}
      style={{ width: w, height: h }}
    />
  );
}

const BADGE_ICON: Record<string, LucideIcon> = {
  'GST verified': BadgeCheck,
  Manufacturer: Factory,
  'Unit visited': Eye,
  'Replies in < 10 min': Clock,
  'Top quality': Star,
};

export function Badges({ badges, lang, max = 2 }: { badges: string[]; lang: string; max?: number }) {
  if (!badges.length) return null;
  const t = cardStrings(lang);
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.slice(0, max).map((b) => {
        const Icon = BADGE_ICON[b] ?? (/repeat/.test(b) ? Users : Check);
        return (
          <span key={b} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-tint px-2.5 text-[12px] font-medium text-primary">
            <Icon size={14} aria-hidden className="shrink-0" />
            {badgeLabel(b, t)}
          </span>
        );
      })}
    </div>
  );
}

export function Tag({ children, tone = 'success', icon: Icon }: { children: ReactNode; tone?: 'success' | 'accent' | 'neutral'; icon?: LucideIcon }) {
  const cls = { success: 'bg-success-tint text-success', accent: 'bg-accent-tint text-accent-ink', neutral: 'bg-sunken text-ink-2' }[tone];
  return (
    <span className={clsx('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold', cls)}>
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(24px+var(--safe-bottom,0px))] z-50 flex justify-center px-4" role="status" aria-live="polite">
      <span className="max-w-[440px] rounded-[18px] bg-ink px-4 py-2.5 text-center text-[14px] leading-snug font-medium text-surface shadow-[var(--shadow-float)]">{text}</span>
    </div>
  );
}

export function useToast(ms = 2600) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (t: string) => {
      window.clearTimeout(timer.current);
      setText(t);
      timer.current = window.setTimeout(() => setText(null), ms);
    },
    [ms],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { text, show };
}

// ── Actions: chat, sample, combo, open several ────────────────────────────
type Action = 'chat' | 'sample' | 'combo' | 'many';

export function useDealActions(requirementId: string | undefined) {
  const nav = useNavigate();
  const [busy, setBusy] = useState<{ key: string; action: Action } | null>(null);
  const [done, setDone] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, action: Action, fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy({ key, action });
    try {
      await fn();
      setDone((d) => ({ ...d, [`${key}:${action}`]: true }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const open = async (businessId: string, listingId?: string) => {
    const r = await api.post<{ conversation?: { id: string } }>('/api/deals/open', { sellerBusinessId: businessId, requirementId, listingId });
    const id = r?.conversation?.id;
    if (!id) throw new Error('Could not open the chat. Please try again.');
    return id;
  };

  return {
    error,
    anyBusy: busy !== null,
    isBusy: (key: string, action: Action) => busy?.key === key && busy.action === action,
    isDone: (key: string, action: Action) => !!done[`${key}:${action}`],
    chat: (key: string, businessId: string, listingId?: string) =>
      run(key, 'chat', async () => {
        nav(`/chat/${await open(businessId, listingId)}`);
      }),
    sample: (key: string, businessId: string, listingId?: string) =>
      run(key, 'sample', async () => {
        const conversationId = await open(businessId, listingId);
        await api.post('/api/samples', { conversationId, listingId, sizes: [], note: '' });
        nav(`/chat/${conversationId}`);
      }),
    /** Opens one chat per line of a combo; lands on the first. */
    combo: (key: string, card: RCard, toast?: string) =>
      run(key, 'combo', async () => {
        const lines = card.lines.map(({ listingId, businessId, businessName, qty, unitPrice, readyDays }) => ({ listingId, businessId, businessName, qty, unitPrice, readyDays }));
        const r = await api.post<{ conversations?: { id: string }[] }>('/api/deals/combo', { requirementId, lines });
        const first = r?.conversations?.[0]?.id;
        if (!first) throw new Error('Could not open the chats. Please try again.');
        nav(`/chat/${first}`, { state: toast ? { toast } : undefined });
      }),
    /** Opens a deal with each card's seller, shows the toast, then lands on the first chat. */
    many: (key: string, cards: RCard[], toast: string, showToast: (t: string) => void) =>
      run(key, 'many', async () => {
        const ids: string[] = [];
        for (const c of cards) ids.push(await open(c.lines[0].businessId, c.lines[0].listingId));
        showToast(toast);
        await new Promise((r) => window.setTimeout(r, 1200));
        nav(`/chat/${ids[0]}`, { state: { toast } });
      }),
  };
}

export type DealActions = ReturnType<typeof useDealActions>;
