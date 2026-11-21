// Chats inbox (/chats): Claire pinned, CLAIRE Updates when there is news, then deal / support chats.
// Each deal row shows what it is about (garment thumbnail · title · qty) and ONE status pill.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CC_CARD } from '@shared/cards';
import { api, errorText } from '../lib/api';
import { listTime } from '../lib/format';
import { useT } from '../i18n';
import { channelKey, engine, previewText, type ChannelSummary, type ChatMessage } from '../chat/engine';
import { AppShell } from '../components/AppShell';
import { Avatar, ClaireMark, DeskMark, UpdatesMark } from '../components/Avatar';
import { TrustBadge } from '../components/TrustBadge';
import { Sheet } from '../components/Sheet';
import GarmentArt from '../components/GarmentArt';
import { CATEGORY_ART_COLOR, flatArtStyle } from '../cards/Tiles';
import { Check, ChevronRight, Filter, RefreshCw, Search, ShoppingBag, Tag, X } from '../icons';
import { InboxStrings } from './Inbox.strings';

interface Conversation {
  id: string;
  kind: 'deal' | 'combo' | 'support' | string;
  channelId: string;
  title: string;
  counterpart: { id: string | null; name: string; accent?: string | null; city?: string | null; trust?: number | null; language?: string | null } | null;
  side?: 'buyer' | 'seller' | null;
  lastAt?: number | null;
  lastText?: string | null;
  agentUserId?: string | null;
  unread?: number;
  /** An offer in this chat is waiting for an answer (live status from the server). */
  pendingOffer?: boolean;
  product?: { title: string | null; qty: number | null; unit: string | null; category: string | null; art: { shape: string; color?: string; pattern?: string } | null } | null;
  latestOffer?: { id: string; unitPrice: number; unit: string; status: string; counter?: boolean; fromMe: boolean; at: number } | null;
  latestOrder?: { id: string; code: string; status: string; unitPrice: number; at: number } | null;
}

type Side = 'all' | 'buying' | 'selling';
type Only = 'none' | 'unread' | 'offers' | 'orders' | 'support';
type Tone = 'clay' | 'success' | 'primary' | 'neutral' | 'warning' | 'accent' | 'danger';
type S = ReturnType<typeof InboxStrings.use>;

const TONE: Record<Tone, string> = {
  clay: 'bg-clay-tint text-clay',
  success: 'bg-success-tint text-success',
  primary: 'bg-primary-tint text-primary',
  neutral: 'bg-sunken text-ink-2',
  warning: 'bg-note text-warning',
  accent: 'bg-accent-tint text-accent-ink',
  danger: 'bg-danger-tint text-danger',
};

const SHAPE_BY_CAT: Record<string, string> = {
  'garment.tshirt': 'tshirt', 'garment.polo': 'polo', 'garment.trackpants': 'trackpants', 'garment.shorts': 'shorts', 'garment.innerwear': 'brief',
  'garment.vest': 'vest', 'garment.kids': 'kidsset', 'garment.nightwear': 'nightwear', 'garment.leggings': 'leggings', 'garment.hoodie': 'hoodie',
  'fabric.knit': 'fabric', 'yarn.cotton': 'yarn', 'service.stitching': 'sewing', 'service.printing': 'print', 'service.dyeing': 'dye',
};

const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: n < 1000 ? 2 : 0 });

function perUnit(s: S, price: number, unit?: string | null) {
  if (!unit || unit === 'piece') return s('per_pc', { price: money(price) });
  return s('per_unit', { price: money(price), unit: unit === 'kg' ? 'kg' : unit });
}

function qtyText(s: S, n: number | null, unit: string | null) {
  if (n == null) return '';
  const v = n.toLocaleString('en-IN');
  return unit === 'kg' ? s('kg', { n: v }) : unit === 'dozen' ? s('dozen', { n: v }) : s('pcs', { n: v });
}

/** An offer waiting for my answer that is newer than the chat's last order (a new negotiation after an old order). */
function newOfferIn(c: Conversation): boolean {
  const f = c.latestOffer;
  return !!f && f.status === 'pending' && !f.fromMe && (!c.latestOrder || f.at > c.latestOrder.at);
}

/** One status per chat, whichever is newer: order stage or offer state; then support. */
function statusOf(c: Conversation, s: S): { label: string; tone: Tone } | null {
  if (c.kind === 'support' || c.agentUserId) return { label: s('st_support'), tone: 'accent' };
  const buyer = c.side === 'buyer';
  // Same rule as the deal header strip: a pending offer made after the last order is what matters now.
  const o = c.latestOffer?.status === 'pending' && c.latestOrder && c.latestOffer.at > c.latestOrder.at ? null : c.latestOrder;
  if (o) {
    switch (o.status) {
      case 'confirmed': return buyer ? { label: s('st_pay_advance'), tone: 'warning' } : { label: s('st_placed'), tone: 'success' };
      case 'advance_paid': return buyer ? { label: s('st_placed'), tone: 'success' } : { label: s('st_ready'), tone: 'primary' };
      case 'in_production': return { label: s('st_production'), tone: 'primary' };
      case 'dispatched': return { label: s('st_dispatched'), tone: 'primary' };
      case 'delivered': return buyer ? { label: s('st_pay_balance'), tone: 'warning' } : { label: s('st_delivered'), tone: 'success' };
      case 'balance_paid':
      case 'closed': return { label: s('st_completed'), tone: 'success' };
      case 'cancelled': return { label: s('st_cancelled'), tone: 'neutral' };
      case 'disputed': return { label: s('st_problem'), tone: 'danger' };
    }
  }
  const f = c.latestOffer;
  if (f) {
    const price = perUnit(s, f.unitPrice, f.unit);
    if (f.status === 'pending' && !f.fromMe) return { label: s(f.counter ? 'st_counter' : 'st_offer_in', { price }), tone: 'clay' };
    if (f.status === 'pending') return { label: s('st_offer_out', { price }), tone: 'neutral' };
    if (f.status === 'accepted') return { label: s('st_confirmed', { price }), tone: 'success' };
    return { label: s('st_negotiating'), tone: 'neutral' };
  }
  if (c.pendingOffer) return { label: s('st_offer_in', { price: '' }).trim(), tone: 'clay' };
  return null;
}

export default function Inbox() {
  const t = useT();
  const s = InboxStrings.use();
  const navigate = useNavigate();

  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ChannelSummary>>({});
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [side, setSide] = useState<Side>('all');
  const [only, setOnly] = useState<Only>('none');
  const [sheet, setSheet] = useState(false);
  const convsRef = useRef<Conversation[] | null>(null);
  convsRef.current = convs;
  const searchRef = useRef<HTMLInputElement>(null);

  const loadConvs = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get<Conversation[] | { conversations?: Conversation[] }>('/api/conversations');
      setConvs(Array.isArray(r) ? r : (r?.conversations ?? []));
    } catch (e) {
      setError(errorText(e));
      setConvs((cur) => cur ?? []);
    }
  }, []);

  const loadSummaries = useCallback(async () => {
    try {
      const list = await engine.listChannels();
      setSummaries(Object.fromEntries(list.map((x) => [channelKey(x.channel), x])));
    } catch {
      /* previews fall back to the server's last text */
    }
  }, []);

  useEffect(() => {
    void loadConvs();
    void loadSummaries();
  }, [loadConvs, loadSummaries]);

  // Live previews + unread counts; offers / orders moving refresh the status pills.
  useEffect(() => {
    return engine.onMessage((m) => {
      const k = channelKey(m.channel);
      setSummaries((cur) => {
        const prev = cur[k];
        if (prev?.latest && prev.latest.sentAt > m.sentAt) return cur;
        return { ...cur, [k]: { channel: m.channel, latest: m, unread: (prev?.unread ?? 0) + (m.mine ? 0 : 1), updatedAt: m.sentAt } };
      });
      const known = convsRef.current;
      const unknownChat = m.channel.type === 'group' && known && !known.some((c) => c.channelId === m.channel.targetId);
      const dealMoved = m.type === CC_CARD && ['offer', 'order', 'notice'].includes(m.content?.kind);
      if (unknownChat || dealMoved) void loadConvs();
    });
  }, [loadConvs]);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const preview = (m: ChatMessage | null | undefined, fallback?: string | null) => {
    if (!m) return fallback ?? '';
    const text = previewText(m, { voice: t('voice_note'), card: t('card_msg') });
    return m.mine ? `${t('you')}: ${text}` : text;
  };

  const claireSum = summaries['direct:claire'];
  const updatesSum = summaries['system:claire_updates'];

  const enriched = useMemo(
    () =>
      (convs ?? []).map((c) => {
        const sum = summaries[`group:${c.channelId}`];
        const at = Math.max(sum?.latest?.sentAt ?? 0, c.lastAt ?? 0);
        const unread = sum?.unread ?? c.unread ?? 0;
        return { c, sum, at, unread, status: statusOf(c, s), newOffer: newOfferIn(c) };
      }),
    [convs, summaries, s],
  );

  const counts = useMemo(
    () => ({
      all: enriched.length,
      buying: enriched.filter((r) => r.c.side === 'buyer').length,
      selling: enriched.filter((r) => r.c.side === 'seller').length,
    }),
    [enriched],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched
      .filter(({ c, sum, unread, status, newOffer }) => {
        if (side === 'buying' && c.side !== 'buyer') return false;
        if (side === 'selling' && c.side !== 'seller') return false;
        if (only === 'unread' && !unread && !newOffer) return false;
        if (only === 'offers' && !(c.pendingOffer || c.latestOffer?.status === 'pending')) return false;
        if (only === 'orders' && !c.latestOrder) return false;
        if (only === 'support' && !(c.kind === 'support' || c.agentUserId)) return false;
        if (!q) return true;
        const hay = [c.title, c.counterpart?.name, c.counterpart?.city, c.product?.title, status?.label, sum?.latest ? previewText(sum.latest) : c.lastText]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.at - a.at);
  }, [enriched, query, side, only]);

  const totalUnread = Object.values(summaries).reduce((n, x) => n + (x.unread || 0), 0);
  const updatesUnread = updatesSum?.unread ?? 0;
  const narrowed = !!query.trim() || side !== 'all' || only !== 'none';
  const showPinned = !query.trim() && only === 'none';

  const tabs: { id: Side; label: string; icon?: ReactNode }[] = [
    { id: 'all', label: s('tab_all', { n: counts.all }) },
    { id: 'buying', label: s('tab_buying', { n: counts.buying }), icon: <ShoppingBag size={16} aria-hidden /> },
    { id: 'selling', label: s('tab_selling', { n: counts.selling }), icon: <Tag size={16} aria-hidden /> },
  ];
  const onlyOptions: { id: Only; label: string }[] = [
    { id: 'none', label: s('f_all') },
    { id: 'unread', label: s('f_unread') },
    { id: 'offers', label: s('f_offers') },
    { id: 'orders', label: s('f_orders') },
    { id: 'support', label: s('f_support') },
  ];

  return (
    <AppShell unread={totalUnread}>
      <header className="sticky top-0 z-20 bg-page pt-[var(--safe-top)]">
        <div className="flex min-h-[64px] items-center gap-2 px-4 pt-3">
          <h1 className="font-head text-[28px] leading-tight font-bold tracking-tight text-ink">{s('title')}</h1>
          {totalUnread > 0 && (
            <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-clay-tint px-2.5 text-[13px] font-semibold text-clay tabular-nums">
              {s('new_n', { n: totalUnread > 99 ? '99+' : totalUnread })}
            </span>
          )}
          <span className="flex-1" />
          <IconButton
            label={s('search')}
            active={searching}
            onClick={() => {
              if (searching) setQuery('');
              setSearching((v) => !v);
            }}
          >
            {searching ? <X size={20} /> : <Search size={20} />}
          </IconButton>
          <IconButton label={s('filter')} active={only !== 'none'} dot={only !== 'none'} onClick={() => setSheet(true)}>
            <Filter size={20} />
          </IconButton>
        </div>

        {searching && (
          <div className="px-4 pt-2">
            <label className="flex min-h-[48px] items-center gap-2 rounded-[16px] border border-line bg-surface px-4 focus-within:border-primary">
              <Search size={18} className="shrink-0 text-meta" aria-hidden />
              <span className="sr-only">{s('search')}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={s('search')}
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              />
            </label>
          </div>
        )}

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3 pb-3" role="tablist" aria-label={s('title')}>
          {tabs.map((tab) => {
            const on = side === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSide(tab.id)}
                className={clsx(
                  'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold tabular-nums transition-colors',
                  on ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-2 hover:bg-sunken',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
        {only !== 'none' && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary-tint pr-1 pl-3.5 text-[13px] font-semibold text-primary">
              {onlyOptions.find((o) => o.id === only)?.label}
              <button
                type="button"
                onClick={() => setOnly('none')}
                className="flex size-8 items-center justify-center rounded-full hover:bg-primary-soft"
                aria-label={s('clear')}
              >
                <X size={14} />
              </button>
            </span>
          </div>
        )}
      </header>

      <div className="space-y-3 px-4 pb-6">
        {showPinned && (
          <>
            <Link
              to="/chat/claire"
              className="flex min-h-[84px] items-center gap-3 rounded-[22px] bg-accent-tint px-4 py-3.5 transition-colors hover:bg-[#F7E6C6] active:bg-[#F7E6C6]"
            >
              <ClaireMark size={52} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-head text-[17px] font-semibold text-ink">
                    Claire <span className="ml-0.5 rounded-full bg-accent px-1.5 py-px align-[2px] text-[11px] font-bold text-ink">AI</span>
                  </span>
                  {claireSum?.latest && <span className="shrink-0 text-[12px] text-accent-ink">{listTime(claireSum.latest.sentAt, t('yesterday'))}</span>}
                </span>
                <span className="mt-0.5 flex items-start gap-2">
                  <span className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-[1.45] text-ink-2">{preview(claireSum?.latest) || s('claire_line')}</span>
                  <UnreadBadge n={claireSum?.unread} />
                </span>
              </span>
            </Link>

            {updatesUnread > 0 ? (
              <Link
                to="/updates"
                className="flex min-h-[72px] items-center gap-3 rounded-[22px] border border-line bg-surface px-4 py-3 transition-colors hover:bg-sunken"
              >
                <UpdatesMark size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-head text-[16px] font-semibold text-ink">{s('updates_link')}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-clay">{listTime(updatesSum?.latest?.sentAt, t('yesterday'))}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{preview(updatesSum?.latest) || s('updates_quiet')}</span>
                    <UnreadBadge n={updatesUnread} />
                  </span>
                </span>
              </Link>
            ) : (
              <Link to="/updates" className="flex min-h-[44px] items-center gap-2 rounded-full px-1 text-[14px] text-meta hover:text-ink-2">
                <UpdatesMark size={28} />
                <span className="font-semibold text-ink-2">{s('updates_link')}</span>
                <span className="min-w-0 flex-1 truncate">· {s('updates_quiet')}</span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-faint" />
              </Link>
            )}
          </>
        )}

        {convs === null && (
          <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 px-4 py-4">
                <span className="shimmer-block size-12 shrink-0 rounded-full" />
                <span className="flex-1 space-y-2.5">
                  <span className="shimmer-block block h-4 w-2/5 rounded-full" />
                  <span className="flex gap-2.5">
                    <span className="shimmer-block size-11 rounded-[14px]" />
                    <span className="flex-1 space-y-2">
                      <span className="shimmer-block block h-3 w-3/5 rounded-full" />
                      <span className="shimmer-block block h-5 w-2/5 rounded-full" />
                    </span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface" aria-label={t('nav_chats')}>
            {rows.map(({ c, sum, at, unread, status, newOffer }) => (
              <li key={c.id}>
                <ConversationRow c={c} s={s} time={listTime(at, t('yesterday'))} unread={unread} newOffer={newOffer} status={status} previewLine={preview(sum?.latest, c.lastText)} />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-[18px] bg-danger-tint px-4 py-3 text-[14px] text-danger" role="alert">
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => void loadConvs()} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 font-semibold">
              <RefreshCw size={16} aria-hidden /> {s('retry')}
            </button>
          </div>
        )}

        {convs !== null && rows.length === 0 && !error && (
          <div className="flex flex-col items-center rounded-[22px] border border-line bg-surface px-6 py-9 text-center">
            {narrowed ? (
              <>
                <p className="font-head text-[17px] font-semibold text-ink">{s('none_match')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSide('all');
                    setOnly('none');
                  }}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-primary-tint px-5 text-[15px] font-semibold text-primary hover:bg-primary-soft"
                >
                  {s('clear')}
                </button>
              </>
            ) : (
              <>
                <p className="font-head text-[18px] font-semibold text-ink">{s('empty_title')}</p>
                <p className="mt-1 max-w-[300px] text-[14px] leading-[1.5] text-meta">{s('empty_sub')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mt-5 inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-primary py-2 pr-6 pl-2.5 text-left text-[15px] font-semibold text-white hover:bg-primary-hover"
                >
                  <ClaireMark size={34} className="ring-2 ring-white/25" />
                  {s('empty_cta')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={s('filter_title')}>
        <div role="radiogroup" aria-label={s('filter_title')} className="space-y-1 pb-2">
          {onlyOptions.map((o) => {
            const on = only === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setOnly(o.id);
                  setSheet(false);
                }}
                className={clsx(
                  'flex min-h-[52px] w-full items-center gap-3 rounded-[16px] px-4 text-left text-[16px] transition-colors',
                  on ? 'bg-primary-tint font-semibold text-primary' : 'text-ink hover:bg-sunken',
                )}
              >
                <span className="flex-1">{o.label}</span>
                {on && <Check size={18} aria-hidden />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </AppShell>
  );
}

function IconButton({ label, onClick, children, active, dot }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; dot?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      className={clsx(
        'relative flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors',
        active ? 'border-primary-soft bg-primary-tint text-primary' : 'border-line bg-surface text-ink-2 hover:bg-sunken',
      )}
    >
      {children}
      {dot && <span className="absolute top-2 right-2 size-2 rounded-full bg-clay ring-2 ring-surface" aria-hidden />}
    </button>
  );
}

function UnreadBadge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-clay px-1.5 text-[12px] font-bold text-white tabular-nums">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function ConversationRow({
  c,
  s,
  time,
  unread,
  newOffer,
  status,
  previewLine,
}: {
  c: Conversation;
  s: S;
  time: string;
  unread: number;
  /** An offer is waiting for my answer: marked even when the chat itself has no unread count. */
  newOffer?: boolean;
  status: { label: string; tone: Tone } | null;
  previewLine: string;
}) {
  const cp = c.counterpart;
  const support = c.kind === 'support';
  const name = c.title || cp?.name || '';
  const p = c.product;
  const shape = p?.art?.shape ?? (p?.category ? SHAPE_BY_CAT[p.category] : undefined);
  const productLine = p?.title ? [p.title, qtyText(s, p.qty, p.unit)].filter(Boolean).join(' · ') : '';

  return (
    <Link to={`/chat/${c.id}`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-page active:bg-sunken">
      {support ? <DeskMark size={48} /> : <Avatar name={cp?.name ?? name} accent={cp?.accent} size={48} />}
      <span className="min-w-0 flex-1">
        <span className="flex min-h-[26px] items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate font-head text-[16px] font-semibold text-ink">{name}</span>
            {!support && cp?.trust != null && <TrustBadge trust={cp.trust} />}
          </span>
          <span className={clsx('shrink-0 text-[12px] tabular-nums', unread ? 'font-semibold text-clay' : 'text-meta')}>{time}</span>
        </span>

        <span className="mt-1.5 flex items-center gap-2.5">
          {shape && (
            <span className="block size-11 shrink-0 overflow-hidden rounded-[14px] border border-line">
              <GarmentArt shape={shape} color={p?.art?.color ?? (p?.category ? CATEGORY_ART_COLOR[p.category] : undefined) ?? '#3C4247'} pattern={p?.art?.pattern} style={flatArtStyle} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className={clsx('block truncate text-[14px] leading-[1.45]', unread && !productLine ? 'font-medium text-ink' : 'text-ink-2')}>
              {productLine || previewLine || [cp?.city].filter(Boolean).join(' · ')}
            </span>
            {status ? (
              <span className={clsx('mt-1 inline-flex max-w-full min-h-[26px] items-center rounded-full px-2.5 py-0.5 text-[12.5px] leading-[1.35] font-semibold', TONE[status.tone])}>
                <span className="min-w-0">{status.label}</span>
              </span>
            ) : productLine && previewLine ? (
              <span className={clsx('mt-0.5 block truncate text-[13px]', unread ? 'font-medium text-ink' : 'text-meta')}>{previewLine}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 self-center">
            <UnreadBadge n={unread} />
            {newOffer && !unread && (
              <span className="flex h-6 shrink-0 items-center rounded-full bg-clay px-2 text-[12px] font-bold text-white">{s('new_offer')}</span>
            )}
            <ChevronRight size={18} aria-hidden className="text-faint" />
          </span>
        </span>
      </span>
    </Link>
  );
}
