// Small shared kit for the non-chat screens (storefront, me, orders, onboarding, desk).
// Holds API normalizers (server rows may be snake_case or camelCase), formatting helpers
// and a few presentational pieces that several screens share.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from '../icons';
import { useSession } from '../store/session';
import { catById } from '../../../shared/taxonomy';

// ── Tokens ────────────────────────────────────────────────────────────────
// Mirrors the "Tiruppur cotton" tokens in index.css (kept as hex so callers can build tints like `${C.primary}33`).
export const C = {
  primary: '#1F8C73',
  primaryHover: '#19775F',
  tint: '#E3EEE8',
  hover: '#C9DFD4',
  soft: '#C9DFD4',
  page: '#FFFFFF',
  surface: '#FFFFFF',
  sunken: '#F3F4F6',
  ink: '#13203B',
  ink2: '#3C4247',
  meta: '#697077',
  faint: '#A2A8AE',
  border: '#E7E9EC',
  line: '#E7E9EC',
  lineStrong: '#D3D7DC',
  chipBorder: '#B9CFC4',
  success: '#2F7A47',
  successTint: '#E2F0E5',
  danger: '#B43A2E',
  dangerTint: '#F8E2DE',
  warning: '#A8650F',
  note: '#FDF4E3',
  accent: '#E9A23B',
  accentTint: '#FDF4E3',
  accentInk: '#8A5A12',
  clay: '#B9502F',
  clayTint: '#F7E4DB',
  plum: '#6D4466',
  plumTint: '#F1E8EF',
  marigold: '#E9A23B',
  teal: '#1F8C73',
} as const;

export const HEAD = 'font-head';

// ── Session access (typed locally so screens do not depend on the store's exact types) ──
export interface MeUser { id: string; name: string | null; phone?: string; language: string; role?: string; business_id?: string | null; businessId?: string | null }
export interface MeBusiness { id: string; name: string; slug?: string; city?: string; accent?: string; role?: string; role_label?: string; sells?: string[]; buys?: string[] }
export interface MeFeatures { nexconn?: boolean; llm?: boolean; sarvam?: boolean; call?: boolean; [k: string]: unknown }

export function useMe() {
  const user = useSession((s: any) => s.user) as MeUser | null;
  const business = useSession((s: any) => s.business) as MeBusiness | null;
  const features = useSession((s: any) => s.features) as MeFeatures | null;
  const token = useSession((s: any) => s.token) as string | null;
  return { user, business, features, token, lang: user?.language || 'en' };
}

/** Merge fields into the session store (via its own setters, so the cached session stays in sync). */
export function patchSession(patch: { user?: Partial<MeUser> & Record<string, unknown>; business?: MeBusiness | null }) {
  const s = useSession.getState();
  if (patch.user) s.setUser(patch.user as Parameters<typeof s.setUser>[0]);
  if (patch.business !== undefined) s.setSession({ business: patch.business as Parameters<typeof s.setSession>[0]['business'] });
}

// ── i18n with fallback ─────────────────────────────────────────────────────
type TFn = (key: any, ...rest: any[]) => any;
/** Translate `key`; if the dictionary has no entry (returns the key / empty), use the English fallback. */
export function tx(t: TFn, key: string, fallback: string, vars?: Record<string, string | number>): string {
  let s: string = fallback;
  try {
    const r = t(key);
    if (typeof r === 'string' && r && r !== key) s = r;
  } catch { /* ignore */ }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// ── Formatting ─────────────────────────────────────────────────────────────
export const inr = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);
export const num = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
export const initials = (name?: string | null) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
export const unitShort = (u?: string | null) => (u === 'kg' ? 'kg' : u === 'dozen' ? 'doz' : 'pc');
export const catName = (id: string | null | undefined, lang: string) => {
  const c = catById(id ?? undefined);
  if (!c) return id ?? '';
  return (c.names as Record<string, string>)[lang] ?? c.names.en;
};
export function ago(ts?: number | string | null) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export const fmtDate = (ts?: number | string | null, lang = 'en') =>
  ts ? new Date(ts).toLocaleDateString(`${lang}-IN`, { day: 'numeric', month: 'short' }) : '';
export const fmtTime = (ts?: number | string | null) =>
  ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong');

/** Unwrap `[...]` or `{[key]: [...]}` list responses. */
export function listOf<T = any>(r: any, ...keys: string[]): T[] {
  if (Array.isArray(r)) return r as T[];
  for (const k of keys) if (r && Array.isArray(r[k])) return r[k] as T[];
  return [];
}
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const toMs = (v: any): number | null => (v == null ? null : typeof v === 'number' ? v : new Date(v).getTime() || null);

// ── Domain types + normalizers ─────────────────────────────────────────────
export interface Trust {
  score: number;
  components: { verification: number; ratings: number; reliability: number; responsiveness: number; disputes: number };
  badges: string[];
  ratingAvg: number | null;
  ratingCount: number;
  onTimePct: number | null;
  paysOnTime: string | null;
  repeatBuyers: number;
  vouchedBy: { name: string; note: string }[];
  isNew: boolean;
}
export function normTrust(t: any): Trust | null {
  if (!t || typeof t !== 'object') return null;
  const c = t.components ?? {};
  return {
    score: Number(t.score ?? 0),
    components: { verification: c.verification ?? 0, ratings: c.ratings ?? 0, reliability: c.reliability ?? 0, responsiveness: c.responsiveness ?? 0, disputes: c.disputes ?? 0 },
    badges: t.badges ?? [],
    ratingAvg: t.ratingAvg ?? t.rating_avg ?? null,
    ratingCount: t.ratingCount ?? t.rating_count ?? 0,
    onTimePct: t.onTimePct ?? t.on_time_pct ?? null,
    paysOnTime: t.paysOnTime ?? t.pays_on_time ?? null,
    repeatBuyers: t.repeatBuyers ?? t.repeat_buyers ?? 0,
    vouchedBy: t.vouchedBy ?? t.vouched_by ?? [],
    isNew: !!(t.isNew ?? t.is_new),
  };
}

export interface Biz {
  id: string; slug: string | null; name: string; ownerName: string | null; language: string | null; city: string | null; state: string | null; area: string | null;
  about: string | null; role: string | null; sells: string[]; buys: string[]; capacity: string | null; gstVerified: boolean; isManufacturer: boolean;
  unitVisited: boolean; replyMinutes: number | null; accent: string; isDemo: boolean; autoReply: string | null; trust: Trust | null;
}
export function normBiz(b: any): Biz | null {
  if (!b) return null;
  return {
    id: b.id, slug: pick(b, 'slug') ?? null, name: b.name ?? '', ownerName: pick(b, 'ownerName', 'owner_name') ?? null, language: b.language ?? null,
    city: b.city ?? null, state: b.state ?? null, area: b.area ?? null, about: b.about ?? null, role: pick(b, 'role', 'role_label') ?? null,
    sells: b.sells ?? [], buys: b.buys ?? [], capacity: pick(b, 'capacity', 'capacity_note') ?? null,
    gstVerified: !!pick(b, 'gstVerified', 'gst_verified'), isManufacturer: !!pick(b, 'isManufacturer', 'is_manufacturer'),
    unitVisited: !!pick(b, 'unitVisited', 'unit_visited'), replyMinutes: pick(b, 'replyMinutes', 'reply_minutes') ?? null,
    accent: b.accent || C.primary, isDemo: !!pick(b, 'isDemo', 'is_seed'), autoReply: pick(b, 'autoReply', 'auto_reply') ?? null, trust: normTrust(b.trust),
  };
}

export interface Listing {
  id: string; businessId: string; category: string; type: string; title: string; attrs: Record<string, any>; images: string[];
  art?: { shape: string; color: string; pattern?: string }; price: number | null; unit: string; moq: number | null; sizeSet: any; stock: number | null;
  capacityPerDay: number | null; leadDays: number | null; active: boolean;
}
export function normListing(r: any): Listing {
  return {
    id: r.id, businessId: pick(r, 'businessId', 'business_id'), category: r.category ?? '', type: r.type ?? 'product', title: r.title ?? '',
    attrs: r.attrs ?? {}, images: r.images ?? (r.image ? [r.image] : []), art: r.art ?? undefined, price: r.price ?? null, unit: r.unit ?? 'piece',
    moq: r.moq ?? null, sizeSet: pick(r, 'sizeSet', 'size_set') ?? null, stock: pick(r, 'stock', 'stock_qty') ?? null,
    capacityPerDay: pick(r, 'capacityPerDay', 'capacity_per_day') ?? null, leadDays: pick(r, 'leadDays', 'lead_days') ?? null,
    active: r.active === undefined ? true : !!r.active,
  };
}
export function sizesText(sizeSet: any): string {
  if (!sizeSet) return '';
  if (Array.isArray(sizeSet)) return sizeSet.join(', ');
  if (typeof sizeSet === 'string') return sizeSet;
  if (typeof sizeSet === 'object') return Object.keys(sizeSet).join(', ');
  return '';
}

export interface Order {
  id: string; code: string; kind: string; title: string; qty: number; unit: string; unitPrice: number; total: number; status: string;
  buyerBusinessId: string; sellerBusinessId: string; buyerName: string | null; sellerName: string | null; counterpartName: string | null;
  conversationId: string | null; createdAt: number | null; balanceDueAt: number | null; advancePct: number; creditDays: number;
  category: string | null; side: 'buyer' | 'seller' | null;
}
export function normOrder(o: any): Order {
  return {
    id: o.id, code: o.code ?? '', kind: o.kind ?? 'purchase', title: o.title ?? '', qty: Number(o.qty ?? 0), unit: o.unit ?? 'piece',
    unitPrice: Number(pick(o, 'unitPrice', 'unit_price') ?? 0), total: Number(o.total ?? 0), status: o.status ?? 'confirmed',
    buyerBusinessId: pick(o, 'buyerBusinessId', 'buyer_business_id') ?? '', sellerBusinessId: pick(o, 'sellerBusinessId', 'seller_business_id') ?? '',
    buyerName: pick(o, 'buyerName', 'buyer_name') ?? o.buyer?.name ?? null, sellerName: pick(o, 'sellerName', 'seller_name') ?? o.seller?.name ?? null,
    counterpartName: (typeof o.counterpart === 'string' ? o.counterpart : o.counterpart?.name) ?? null,
    conversationId: pick(o, 'conversationId', 'conversation_id') ?? null, createdAt: toMs(pick(o, 'createdAt', 'created_at')),
    balanceDueAt: toMs(pick(o, 'balanceDueAt', 'balance_due_at')), advancePct: Number(pick(o, 'advancePct', 'advance_pct') ?? 0),
    creditDays: Number(pick(o, 'creditDays', 'credit_days') ?? 0),
    category: o.category ?? null, side: o.side === 'buyer' || o.side === 'seller' ? o.side : null,
  };
}

export interface Ticket {
  id: string; code: string; type: string; typeLabel: string; slaOverdue: boolean; autoTranslate: boolean; priority: 'P1' | 'P2' | 'P3' | string; status: string; languages: string[]; businessIds: string[];
  parties: { id: string; name: string; role?: string; language?: string; accent?: string; city?: string }[]; orderId: string | null; conversationId: string | null; channelId: string | null;
  trigger: string | null; description: string | null; summary: string | null; nextStep: string | null; suggestedReplies: string[];
  agentId: string | null; agentName: string | null; slaDueAt: number | null; createdAt: number | null; firstResponseAt: number | null; resolvedAt: number | null;
}
function summaryText(s: any, lang: string): string | null {
  if (!s) return null;
  if (typeof s === 'string') return s;
  if (typeof s === 'object') {
    if (s.lang === lang && typeof s.local === 'string' && s.local) return s.local;
    return s[lang] ?? s.en ?? s.local ?? (Object.values(s).find((v) => typeof v === 'string') as string | undefined) ?? null;
  }
  return null;
}
export function normTicket(t: any, lang = 'en'): Ticket {
  const partiesRaw = t.parties ?? t.businesses ?? [];
  const replies = pick(t, 'suggestedReplies', 'suggested_replies', 'whispers') ?? [];
  return {
    id: t.id, code: t.code ?? t.id, type: t.type ?? 'help', typeLabel: pick(t, 'typeLabel', 'type_label') ?? String(t.type ?? 'help').replace(/_/g, ' '),
    slaOverdue: !!pick(t, 'slaOverdue', 'sla_breached'), autoTranslate: !!pick(t, 'autoTranslate', 'auto_translate'), priority: t.priority ?? 'P3', status: t.status ?? 'new',
    languages: pick(t, 'languages', 'language_needed', 'languageNeeded') ?? [], businessIds: pick(t, 'businessIds', 'business_ids') ?? [],
    parties: (Array.isArray(partiesRaw) ? partiesRaw : []).map((p: any) => ({ id: p.id, name: p.name ?? '', role: p.side ?? p.role, language: p.language, accent: p.accent, city: p.city })),
    orderId: pick(t, 'orderId', 'order_id') ?? null, conversationId: pick(t, 'conversationId', 'conversation_id') ?? null,
    channelId: pick(t, 'channelId', 'channel_id') ?? t.conversation?.channel_id ?? t.conversation?.channelId ?? null,
    trigger: t.trigger ?? null, description: t.description ?? null,
    summary: summaryText(pick(t, 'aiSummary', 'ai_summary', 'summary'), lang), nextStep: summaryText(pick(t, 'suggestedNextStep', 'suggested_next_step', 'nextStep'), lang),
    suggestedReplies: (Array.isArray(replies) ? replies : []).map((r: any) => (typeof r === 'string' ? r : r?.text ?? r?.label ?? '')).filter(Boolean),
    agentId: pick(t, 'agentId', 'assigned_agent_id', 'assignedAgentId', 'agent_user_id') ?? null,
    agentName: pick(t, 'agentName', 'agent_name') ?? t.agent?.name ?? null,
    slaDueAt: toMs(pick(t, 'slaDueAt', 'sla_due_at')), createdAt: toMs(pick(t, 'createdAt', 'created_at')),
    firstResponseAt: toMs(pick(t, 'firstResponseAt', 'first_response_at')), resolvedAt: toMs(pick(t, 'resolvedAt', 'resolved_at')),
  };
}

// ── Hooks ──────────────────────────────────────────────────────────────────
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const whatsappShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ── Presentational pieces ─────────────────────────────────────────────────
export const trustTier = (s: number) => (s >= 80 ? C.success : s >= 60 ? C.primary : C.accentInk);

export function TrustRing({ score, size = 44, stroke = 4, isNew = false }: { score: number; size?: number; stroke?: number; isNew?: boolean }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = isNew ? C.meta : trustTier(score);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-label={`Trust score ${score}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.sunken} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, score)) / 100)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <span className="absolute font-head font-bold tabular-nums" style={{ fontSize: size * 0.32, color: C.ink }}>{score}</span>
    </span>
  );
}

/** The five trust components, their weight (max points) and a plain-language tip. Plum is reserved for this breakdown. */
export const TRUST_PARTS: { key: keyof Trust['components']; label: string; max: number; color: string; tip: string }[] = [
  { key: 'verification', label: 'Verification', max: 20, color: C.plum, tip: 'Phone, GST, Udyam, unit visit' },
  { key: 'ratings', label: 'Ratings', max: 40, color: C.plum, tip: 'Ratings from trading partners' },
  { key: 'reliability', label: 'Reliability', max: 25, color: C.plum, tip: 'On-time dispatch and payment' },
  { key: 'responsiveness', label: 'Responsiveness', max: 10, color: C.plum, tip: 'How fast you reply' },
  { key: 'disputes', label: 'Disputes', max: 5, color: C.plum, tip: 'No upheld disputes' },
];

/** One slim flat bar per component (track sunken, fill plum). Labels can be overridden for translation. */
export function TrustBreakdown({ trust, showTips = false, labels }: { trust: Trust; showTips?: boolean; labels?: Partial<Record<keyof Trust['components'], { label: string; tip?: string }>> }) {
  return (
    <ul className="space-y-3">
      {TRUST_PARTS.map((p) => {
        const v = Math.max(0, Math.min(p.max, Number(trust.components[p.key]) || 0));
        const l = labels?.[p.key];
        return (
          <li key={p.key}>
            <div className="flex items-baseline gap-2 text-[14px]">
              <span className="min-w-0 flex-1" style={{ color: C.ink }}>
                {l?.label ?? p.label}
                {showTips && <span className="block text-[12px] leading-snug" style={{ color: C.meta }}>{l?.tip ?? p.tip}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: C.ink }}>{v}<span className="font-normal" style={{ color: C.meta }}>/{p.max}</span></span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: C.sunken }}>
              <div className="h-full rounded-full" style={{ width: `${(v / p.max) * 100}%`, background: p.color, transition: 'width 600ms ease' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: C.tint, fg: C.primary, label: 'Confirmed' },
  advance_paid: { bg: C.tint, fg: C.primary, label: 'Advance paid' },
  payment_confirmed: { bg: C.tint, fg: C.primary, label: 'Payment confirmed' },
  in_production: { bg: C.accentTint, fg: C.accentInk, label: 'In production' },
  dispatched: { bg: C.tint, fg: C.primary, label: 'Dispatched' },
  delivered: { bg: C.successTint, fg: C.success, label: 'Delivered' },
  balance_paid: { bg: C.successTint, fg: C.success, label: 'Paid' },
  closed: { bg: C.sunken, fg: C.ink2, label: 'Completed' },
  cancelled: { bg: C.sunken, fg: C.meta, label: 'Cancelled' },
  disputed: { bg: C.dangerTint, fg: C.danger, label: 'Disputed' },
  problem: { bg: C.dangerTint, fg: C.danger, label: 'Problem' },
};
export const statusStyle = (status: string) => STATUS_STYLE[status] ?? { bg: C.sunken, fg: C.ink2, label: status.replace(/_/g, ' ') };
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const s = statusStyle(status);
  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      {label ?? s.label}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: 'neutral' | 'success' | 'primary' | 'warn'; icon?: ReactNode }) {
  const map = { neutral: [C.sunken, C.ink2], success: [C.successTint, C.success], primary: [C.tint, C.primary], warn: [C.accentTint, C.accentInk] } as const;
  const [bg, fg] = map[tone];
  return (
    <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold" style={{ background: bg, color: fg }}>
      {icon}
      {children}
    </span>
  );
}

export function LangChip({ code }: { code: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-semibold tracking-[0.06em]" style={{ background: C.sunken, color: C.ink2 }}>
      {code.toUpperCase()}
    </span>
  );
}

export function Spinner({ size = 20, color = C.primary }: { size?: number; color?: string }) {
  return (
    <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-solid" style={{ width: size, height: size, borderColor: `${color}33`, borderTopColor: color }} aria-label="Loading" />
  );
}

export function Empty({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      {icon && <div className="mb-3 flex size-14 items-center justify-center rounded-full" style={{ background: C.tint, color: C.primary }}>{icon}</div>}
      <p className="font-head text-[17px] font-semibold" style={{ color: C.ink }}>{title}</p>
      {sub && <p className="mt-1 max-w-[300px] text-[14px] leading-relaxed" style={{ color: C.meta }}>{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBar({ message, onRetry, retryLabel = 'Retry' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="mx-4 my-3 flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-[14px]" style={{ background: C.dangerTint, color: C.danger }} role="alert">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button className="min-h-11 shrink-0 rounded-full px-3 font-semibold underline underline-offset-2" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

/** Lightweight bottom sheet used by onboarding (scrim + slide-up panel, max 480px wide). New code should use components/Sheet. */
export function BottomSheet({ open, onClose, title, children, tall = false }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 transition-opacity duration-200" style={{ opacity: shown ? 1 : 0, background: 'rgb(42 33 22 / 0.42)' }} onClick={onClose} />
      <div
        className={`relative flex w-full max-w-[480px] flex-col rounded-t-[26px] bg-surface shadow-[var(--shadow-float)] transition-transform duration-200 ease-out ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
        style={{ transform: shown ? 'translateY(0)' : 'translateY(100%)' }}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full" style={{ background: C.lineStrong }} />
          <div className="flex-1 pt-2 font-head text-[18px] font-semibold" style={{ color: C.ink }}>{title}</div>
          <button className="mt-1 -mr-2 flex size-11 items-center justify-center rounded-full hover:bg-sunken" onClick={onClose} aria-label="Close">
            <X size={20} color={C.ink2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/** Mic recorder shared by onboarding and the catalog price sentence. */
export interface Recording { blob: Blob; durationMs: number; mime: string }
export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
export const extFor = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const resolver = useRef<((r: Recording | null) => void) | null>(null);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  };
  useEffect(() => () => cleanup(), []);

  async function start() {
    if (rec.current) return;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    stream.current = s;
    const mime = pickMime();
    const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const type = r.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks.current, { type });
      const durationMs = Date.now() - started.current;
      cleanup();
      rec.current = null;
      setRecording(false);
      resolver.current?.(blob.size ? { blob, durationMs, mime: type } : null);
      resolver.current = null;
    };
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      audioCtx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* level meter is optional */ }
    rec.current = r;
    started.current = Date.now();
    r.start(250);
    setRecording(true);
  }

  function stop(): Promise<Recording | null> {
    return new Promise((resolve) => {
      if (!rec.current || rec.current.state === 'inactive') return resolve(null);
      resolver.current = resolve;
      rec.current.stop();
    });
  }

  function cancel() {
    resolver.current = null;
    if (rec.current && rec.current.state !== 'inactive') {
      rec.current.onstop = null;
      rec.current.stop();
    }
    rec.current = null;
    cleanup();
    setRecording(false);
  }

  return { recording, level, start, stop, cancel };
}
