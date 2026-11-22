// Deal / support chat: shown like a 1-on-1 with the counterpart business, translated both ways.
// GroupChannel(channelId); after each SDK send the server is told via /api/deals/:id/inbound.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScCardS } from '../cards/ScCards.strings';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Headset,
  Languages,
  LifeBuoy,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Receipt,
  Send,
  Store,
  Tag,
  Truck,
  type LucideIcon,
  Repeat,
  Smile,
} from '../icons';
import { CC_CARD } from '@shared/cards';
import { catById } from '@shared/taxonomy';
import { unitPer, unitQty } from '../cards/format';
import { api, errorText } from '../lib/api';
import { inr, langNative, num } from '../lib/format';
import { roleText, useT } from '../i18n';
import { useSession } from '../store/session';
import { CLAIRE_ID, engine, type Channel } from '../chat/engine';
import { ChatView, type QuickReply, type SendInfo } from '../chat/ChatView';
import { dealT } from '../chat/deal.strings';
import { AppShell } from '../components/AppShell';
import { Avatar, DeskMark } from '../components/Avatar';
import { Button } from '../components/Button';
import { GarmentArt } from '../components/GarmentArt';
import { TrustBadge, type TrustLike } from '../components/TrustBadge';
import { Sheet } from '../components/Sheet';
import { statusLabel, strings } from '../cards/strings';
import { CallButtons } from '../call/CallButtons';
import type { DealInfo } from '../cards/dealCtx';

interface Counterpart {
  id: string | null;
  name: string;
  accent?: string | null;
  city?: string | null;
  language?: string | null;
  role?: string | null;
  trust?: TrustLike;
  replyMinutes?: number | null;
  isDemo?: boolean;
  userIds?: string[];
}

interface OfferRow {
  id: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  status: string;
  mine?: boolean;
  title?: string;
  listing_id?: string | null;
  category?: string | null;
  parent_id?: string | null;
  created_at?: number;
}

interface OrderRow {
  id: string;
  code: string;
  status: string;
  title: string;
  created_at?: number;
}

interface Detail {
  conversation: { id: string; kind: string; channelId?: string; channel_id?: string; title?: string };
  counterpart: Counterpart;
  me: { userId: string; businessId: string | null; side: string | null; language: string };
  requirement: {
    id: string;
    title?: string;
    qty?: number;
    unit?: string;
    budget?: number | null;
    deadline_days?: number | null;
    city?: string | null;
    category?: string | null;
    attrs?: { color?: string } | null;
  } | null;
  /** The seller's product this deal is about: its price is the "listed" price. */
  listing?: { id: string; title?: string; price: number; unit?: string } | null;
  offers: OfferRow[];
  orders: OrderRow[];
  agent: { id: string; name: string; languages?: string[]; languageNames?: string[] } | null;
  ratedOrders?: string[];
}

type SheetKind = 'offer' | 'sample' | 'help' | 'accept';

const OPEN_ORDER = (s: string) => !['closed', 'cancelled'].includes(s);
const SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
const COLOURS: Record<string, string> = {
  white: '#EDE6D8',
  black: '#2A2D2B',
  navy: '#2B3A4A',
  grey: '#8A8A85',
  gray: '#8A8A85',
  red: '#B9502F',
  maroon: '#7A2E2A',
  green: '#1F8C73',
  olive: '#6B6A3A',
  yellow: '#E9A23B',
  mustard: '#C8902E',
  pink: '#C97A8A',
  brown: '#7A5A3E',
  beige: '#D9C9A8',
};

/** Garment colour for the strip thumbnail: a hex from the requirement, a known colour word, else loom green. */
function artColour(raw?: string | null): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const word = Object.keys(COLOURS).find((k) => v.includes(k));
  return word ? COLOURS[word] : '#1F8C73';
}

/** One step under the counterpart's price: ₹92 → ₹91, ₹18.5 → ₹18. */
function stepDown(p: number): number {
  return p >= 20 ? Math.ceil(p) - 1 : Math.round((p - 0.5) * 2) / 2;
}
const roundPrice = (p: number) => (p >= 100 ? Math.round(p) : Math.round(p * 2) / 2);

export default function DealScreen() {
  const { conversationId = '' } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const myLang = user?.language || 'en';
  const dt = dealT(myLang);
  const gs = ScCardS.use();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [acceptOffer, setAcceptOffer] = useState<OfferRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeAt, setActiveAt] = useState(0);
  const [scrollSignal, setScrollSignal] = useState(0);
  const [quickBusy, setQuickBusy] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api.get<Detail>(`/api/conversations/${conversationId}`));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [conversationId]);

  useEffect(() => {
    setDetail(null);
    void load();
  }, [load]);

  const channelId = detail?.conversation.channelId ?? detail?.conversation.channel_id;
  const channel = useMemo<Channel | null>(() => (channelId ? { type: 'group', targetId: channelId } : null), [channelId]);

  // Refresh the pinned strip when offer / order cards arrive; track counterpart activity.
  useEffect(() => {
    if (!channel) return;
    return engine.onMessage((m) => {
      if (m.channel.type !== 'group' || m.channel.targetId !== channel.targetId) return;
      if (!m.mine && m.senderId !== CLAIRE_ID) setActiveAt(Date.now());
      if (m.type === CC_CARD && ['offer', 'order', 'agent_joined', 'resolved', 'notice', 'rating'].includes(m.content?.kind)) {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => void load(), 700);
      }
    });
  }, [channel, load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const onSend = useCallback(
    (m: SendInfo) => api.post(`/api/deals/${conversationId}/inbound`, { text: m.text, lang: m.lang ?? myLang, messageId: m.messageId }),
    [conversationId, myLang],
  );
  const onChip = useCallback((chipId: string) => api.post(`/api/deals/${conversationId}/chip`, { chipId }), [conversationId]);

  // ── Deal facts derived from the API data ────────────────────────────────
  const side = detail?.me.side ?? null;
  const offers = useMemo(() => detail?.offers ?? [], [detail]);
  const pendingTheirs = useMemo(() => [...offers].reverse().find((o) => !o.mine && o.status === 'pending'), [offers]);
  const latest = offers.at(-1);
  const myLastPrice = useMemo(() => [...offers].reverse().find((o) => o.mine)?.unit_price, [offers]);
  // "Listed" = the seller's listing price for this product (never an offer made in the chat).
  const listedPrice = detail?.listing?.price || undefined;

  // Live offer statuses, my ratings and deal facts for the cards (card payloads keep the status they were posted with).
  const cardExtras = useMemo(() => {
    if (!detail) return undefined;
    const deal: DealInfo = {
      title: detail.requirement?.title ?? detail.offers.at(-1)?.title,
      qty: detail.requirement?.qty ?? detail.offers.at(-1)?.qty,
      unit: detail.requirement?.unit ?? detail.offers.at(-1)?.unit,
      listedPrice,
      side: detail.me.side,
      offers: detail.offers.map((o) => ({ id: o.id, unitPrice: o.unit_price, qty: o.qty, status: o.status, mine: Boolean(o.mine), createdAt: o.created_at, parentId: o.parent_id ?? null })),
    };
    return { offerStatus: Object.fromEntries(detail.offers.map((o) => [o.id, o.status])), ratedOrders: detail.ratedOrders ?? [], deal };
  }, [detail, listedPrice]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/chats'));
  const cp = detail?.counterpart;
  const support = detail?.conversation.kind === 'support';
  // Goods conversation (supply-chain, docs/supply-chain/04 §8.1): movement and dispute cards, no offers or deal tips.
  const goods = detail?.conversation.kind === 'goods';
  const names = useMemo(() => {
    const n: Record<string, string> = { [CLAIRE_ID]: 'Claire' };
    if (detail?.agent) n[detail.agent.id] = `${detail.agent.name} · Trade Desk`;
    return n;
  }, [detail?.agent]);

  const counter = useCallback(
    async (price: number) => {
      if (quickBusy) return;
      setQuickBusy(true);
      try {
        await onChip(`counter:${price}`);
        setToast(dt('counter_sent'));
        setScrollSignal(Date.now());
        void load();
      } catch (e) {
        setToast(errorText(e));
      } finally {
        setQuickBusy(false);
      }
    },
    [quickBusy, onChip, dt, load],
  );

  const openAccept = useCallback((o: OfferRow) => {
    setAcceptOffer(o);
    setSheet('accept');
  }, []);

  // ── Smart replies: derived from where the deal stands ───────────────────
  const quickReplies = useMemo<QuickReply[]>(() => {
    if (!detail || support || goods) return [];
    const out: QuickReply[] = [];
    const accepted = offers.some((o) => o.status === 'accepted') || detail.orders.length > 0;

    if (pendingTheirs) {
      const p = pendingTheirs.unit_price;
      out.push({ id: 'accept', label: dt('accept_price', { price: inr(p, { decimals: true }) }), icon: Check, onTap: () => openAccept(pendingTheirs) });
      if (side === 'buyer') {
        let ask = stepDown(p);
        if (myLastPrice && ask < myLastPrice) ask = myLastPrice;
        if (ask > 0 && ask < p) out.push({ id: 'ask', label: dt('ask_for', { price: inr(ask, { decimals: true }) }), icon: Pencil, onTap: () => void counter(ask) });
      } else if (side === 'seller' && myLastPrice && myLastPrice > p) {
        const mid = roundPrice((p + myLastPrice) / 2);
        if (mid > p && mid < myLastPrice) out.push({ id: 'ask', label: dt('counter_at', { price: inr(mid, { decimals: true }) }), icon: Pencil, onTap: () => void counter(mid) });
      }
      out.push({ id: 'delivery', label: dt('chip_delivery'), icon: Truck, text: dt('msg_delivery') });
    } else if (detail.orders.length > 0 && detail.orders.every((o) => o.status === 'closed' || o.status === 'cancelled')) {
      // Deal finished: nudge a repeat order (buyers) and a thank-you (both sides).
      if (side === 'buyer') out.push({ id: 'reorder', label: dt('chip_reorder'), icon: Repeat, text: dt('msg_reorder') });
      out.push({ id: 'thanks', label: dt('chip_thanks'), icon: Smile, text: dt(side === 'buyer' ? 'msg_thanks_buyer' : 'msg_thanks_seller') });
    } else if (accepted) {
      out.push({ id: 'delivery', label: dt('chip_delivery'), icon: Truck, text: dt('msg_delivery') });
      if (side === 'buyer') out.push({ id: 'invoice', label: dt('chip_invoice'), icon: Receipt, text: dt('msg_invoice') });
    } else if (latest?.mine && latest.status === 'pending') {
      out.push({ id: 'update', label: dt('chip_update'), icon: Clock, text: dt('msg_update') });
    } else if (side === 'seller') {
      out.push({ id: 'sample-offer', label: dt('chip_offer_sample'), icon: Package, text: dt('msg_offer_sample') });
    } else {
      out.push({ id: 'price-list', label: dt('chip_price_list'), icon: Tag, text: dt('msg_price_list') });
      out.push({ id: 'sample', label: t('request_sample'), icon: Package, onTap: () => setSheet('sample') });
    }

    // Quiet deal actions after the suggestions.
    const actions: QuickReply[] = [{ id: 'act-offer', label: t('make_offer'), icon: Tag, tone: 'quiet', onTap: () => setSheet('offer') }];
    if (!out.some((r) => r.id === 'sample')) actions.push({ id: 'act-sample', label: t('request_sample'), icon: Package, tone: 'quiet', onTap: () => setSheet('sample') });
    actions.push({ id: 'act-help', label: detail.orders.length ? t('report_problem') : t('trade_desk'), icon: LifeBuoy, tone: 'quiet', onTap: () => setSheet('help') });
    actions[0].divider = out.length > 0;
    return [...out, ...actions];
  }, [detail, support, offers, pendingTheirs, latest, side, myLastPrice, dt, t, openAccept, counter]);

  if (error && !detail) {
    return (
      <AppShell variant="chat">
        <div className="flex min-h-[60px] items-center px-1.5 pt-[var(--safe-top)]">
          <button type="button" onClick={back} className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-sunken" aria-label={t('back')}>
            <ArrowLeft size={22} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-page px-8 text-center">
          <p className="font-head text-[17px] font-semibold text-ink">{t('not_found')}</p>
          <p className="text-[14px] text-meta">{error}</p>
          <Button variant="tint" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      </AppShell>
    );
  }

  const theirLang = cp?.language || 'auto';
  const active = Date.now() - activeAt < 3 * 60_000;
  const presence = active ? dt('online') : cp?.replyMinutes ? t('replies_in', { n: cp.replyMinutes }) : '';
  const facts = [roleText(t, cp?.role), cp?.city].filter(Boolean).join(' · ');

  const menuItems: { id: string; label: string; icon: LucideIcon; run: () => void }[] = detail
    ? [
        ...(cp?.id && !support ? [{ id: 'store', label: t('view_store'), icon: Store, run: () => navigate(`/store/${cp.id}`) }] : []),
        ...(goods && cp?.id ? [{ id: 'goods', label: gs('open_goods'), icon: Package, run: () => navigate(`/goods/party/b/${cp.id}`) }] : []),
        ...(!support && !goods
          ? [
              { id: 'offer', label: t('make_offer'), icon: Tag, run: () => setSheet('offer') },
              { id: 'sample', label: t('request_sample'), icon: Package, run: () => setSheet('sample') },
            ]
          : []),
        { id: 'help', label: detail.orders.length ? t('report_problem') : t('trade_desk'), icon: LifeBuoy, run: () => setSheet('help') },
      ]
    : [];

  const header = (
    <header className="relative flex min-h-[64px] shrink-0 items-center gap-1 border-b border-line bg-surface px-1.5 pt-[var(--safe-top)]">
      <button type="button" onClick={back} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-sunken" aria-label={t('back')}>
        <ArrowLeft size={22} />
      </button>
      {detail ? (
        <>
          {support ? <DeskMark size={42} /> : <Avatar name={cp?.name} accent={cp?.accent} size={42} online={active} />}
          <button
            type="button"
            className="min-w-0 flex-1 py-1.5 pl-2 text-left"
            onClick={() => cp?.id && !support && navigate(`/store/${cp.id}`)}
            disabled={!cp?.id || support}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="line-clamp-2 break-words font-head text-[16px] leading-tight font-semibold text-ink">{cp?.name ?? detail.conversation.title}</span>
              {!support && <TrustBadge trust={cp?.trust} className="shrink-0" />}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-tight text-meta">
              {theirLang !== 'auto' && theirLang !== myLang && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-1.5 py-0.5 font-medium text-ink-2" title={dt('lang_pair')}>
                  <Languages size={12} aria-hidden />
                  <span lang={myLang}>{langNative(myLang)}</span>
                  <span aria-hidden>→</span>
                  <span lang={theirLang}>{langNative(theirLang)}</span>
                </span>
              )}
              <span className="truncate">
                {presence && <span className={clsx(active && 'font-semibold text-success')}>{presence}</span>}
                {presence && facts ? ' · ' : ''}
                {facts}
              </span>
            </span>
          </button>
          {!support && (
            <CallButtons
              peer={cp?.userIds?.[0] ? { userId: cp.userIds[0], name: cp.name, accent: cp.accent, trust: cp.trust, sub: facts || null } : null}
              context={{ channel, conversationId }}
              className="-mr-1"
            />
          )}
          {menuItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={dt('more_options')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={clsx('flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-sunken', menuOpen && 'bg-sunken')}
            >
              <MoreVertical size={22} />
            </button>
          )}
          {menuOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} />
              <div role="menu" className="absolute top-[calc(100%-4px)] right-2 z-40 w-64 animate-fade-up rounded-[18px] border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
                {menuItems.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        it.run();
                      }}
                      className="flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[15px] text-ink hover:bg-sunken"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                        <Icon size={17} aria-hidden />
                      </span>
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center gap-3 pl-1">
          <span className="shimmer-block size-[42px] rounded-full" />
          <span className="shimmer-block h-4 w-1/2 rounded-full" />
        </div>
      )}
    </header>
  );

  const banner = !detail ? null : goods ? (
    <button className="flex min-h-11 w-full items-center gap-2 border-b border-line bg-surface px-4 py-2 text-left text-[14px] text-ink-2" onClick={() => cp?.id && navigate(`/goods/party/b/${cp.id}`)}>
      <Package size={16} aria-hidden className="text-meta" />
      <span className="min-w-0 flex-1">{gs('goods_strip')}</span>
      <span className="font-semibold text-primary">{gs('open_goods')}</span>
    </button>
  ) : (
    <DealStrip detail={detail} listedPrice={listedPrice} pendingTheirs={pendingTheirs} onStore={cp?.id && !support ? () => navigate(`/store/${cp.id}`) : undefined} />
  );

  return (
    <AppShell variant="chat">
      {channel ? (
        <ChatView
          key={channel.targetId}
          channel={channel}
          conversationId={conversationId}
          counterpartLang={theirLang}
          header={header}
          banner={banner}
          onSend={onSend}
          onChip={onChip}
          echoChips={false}
          names={names}
          cardExtras={cardExtras}
          scrollSignal={scrollSignal}
          quickReplies={quickReplies}
          onRefresh={load}
        />
      ) : (
        <>
          {header}
          <div className="flex flex-1 items-center justify-center bg-page">
            <Loader2 size={24} className="animate-spin text-primary" aria-label={t('loading')} />
          </div>
        </>
      )}

      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-4 bottom-[calc(132px+var(--safe-bottom,0px))] z-40 flex justify-center">
          <span className="rounded-full bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-white shadow-[var(--shadow-float)]">{toast}</span>
        </div>
      )}

      {detail && (
        <>
          <OfferSheet
            open={sheet === 'offer'}
            onClose={() => setSheet(null)}
            detail={detail}
            onDone={() => {
              setSheet(null);
              setToast(t('offer_sent'));
              setScrollSignal(Date.now());
              void load();
            }}
          />
          <SampleSheet
            open={sheet === 'sample'}
            onClose={() => setSheet(null)}
            conversationId={conversationId}
            listingId={detail.offers.at(-1)?.listing_id ?? undefined}
            onDone={() => {
              setSheet(null);
              setToast(t('sample_sent'));
              setScrollSignal(Date.now());
            }}
          />
          <HelpSheet
            open={sheet === 'help'}
            onClose={() => setSheet(null)}
            conversationId={conversationId}
            order={[...detail.orders].reverse().find((o) => OPEN_ORDER(o.status)) ?? null}
            onDone={() => {
              setSheet(null);
              setToast(t('help_sent'));
            }}
          />
          <AcceptSheet
            open={sheet === 'accept'}
            offer={acceptOffer}
            onClose={() => setSheet(null)}
            onDone={() => {
              setSheet(null);
              setToast(dt('accepted_toast'));
              setScrollSignal(Date.now());
              void load();
            }}
          />
        </>
      )}
    </AppShell>
  );
}

// ── Collapsible product / requirement strip ─────────────────────────────────
function DealStrip({
  detail,
  listedPrice,
  pendingTheirs,
  onStore,
}: {
  detail: Detail;
  listedPrice?: number;
  pendingTheirs?: OfferRow;
  onStore?: () => void;
}) {
  const t = useT();
  const lang = detail.me.language || 'en';
  const ct = strings(lang);
  const dt = dealT(lang);
  const [open, setOpen] = useState(false);
  const req = detail.requirement;
  const offer = detail.offers.at(-1);
  const lastOrder = detail.orders.at(-1);
  // Show whichever is newer: a pending offer after an old order is what matters now.
  const order = lastOrder && (!offer || (lastOrder.created_at ?? 0) >= (offer.created_at ?? 0)) ? lastOrder : undefined;
  const unit = req?.unit ?? offer?.unit ?? 'piece';
  const per = unitPer(unit, lang);
  const title = req?.title ?? offer?.title ?? order?.title ?? detail.conversation.title ?? '';
  const qty = req?.qty ?? offer?.qty;
  const shape = catById(req?.category ?? offer?.category)?.shape ?? 'tshirt';

  const summary = [
    qty ? `${num(qty)} ${unitQty(unit, qty, lang)}` : '',
    listedPrice ? dt('listed', { price: inr(listedPrice, { decimals: true }), unit: per }) : req?.budget ? dt('budget_upto', { price: inr(req.budget), unit: per }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  let pill: { label: string; tone: string } | null = null;
  if (order) pill = { label: statusLabel(order.status, ct), tone: order.status === 'disputed' ? 'bg-danger-tint text-danger' : 'bg-primary-tint text-primary' };
  else if (pendingTheirs) pill = { label: `${inr(pendingTheirs.unit_price, { decimals: true })}/${per}`, tone: 'bg-clay-tint text-clay' };
  else if (offer?.status === 'accepted') pill = { label: statusLabel('accepted', ct), tone: 'bg-success-tint text-success' };
  else if (offer?.status === 'pending') pill = { label: `${inr(offer.unit_price, { decimals: true })}/${per}`, tone: 'bg-sunken text-ink-2' };

  const rows: [string, string][] = [];
  if (req?.budget) rows.push([t('budget'), `≤ ${inr(req.budget)} / ${per}`]);
  if (req?.deadline_days) rows.push([ct('deadline'), t('by_days', { n: req.deadline_days })]);
  if (req?.city) rows.push([ct('city'), req.city]);
  if (offer) rows.push([t('latest_offer'), `${inr(offer.unit_price, { decimals: true })}/${per} · ${offer.status === 'pending' ? ct('s_pending') : statusLabel(offer.status, ct)}`]);
  if (lastOrder) rows.push([t('status_order'), `${lastOrder.code} · ${statusLabel(lastOrder.status, ct)}`]);

  const hasCard = Boolean(req || offer || order);
  // The agent's languages, each in its own script for traders (English names only on English screens).
  const agentLangs = lang === 'en' ? (detail.agent?.languageNames ?? []) : (detail.agent?.languages ?? []).map(langNative);
  if (!hasCard && !detail.agent) return null;

  return (
    <div className="shrink-0 border-b border-line bg-surface px-3 pt-1 pb-2.5">
      {detail.agent && (
        <p className="mb-2 flex items-center gap-1.5 rounded-[14px] bg-clay-tint px-3 py-1.5 text-[12px] font-medium text-clay">
          <Headset size={14} aria-hidden className="shrink-0" />
          <span className="min-w-0">
            {t('agent_here', { name: detail.agent.name })}
            {agentLangs.length ? ` · ${agentLangs.join(', ')}` : ''}
          </span>
        </p>
      )}
      {hasCard && (
        <div className="rounded-[18px] border border-line bg-surface">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? dt('hide_details') : dt('show_details')}
            className="flex w-full items-center gap-3 rounded-[18px] p-2 pr-2.5 text-left"
          >
            <span className="size-12 shrink-0 overflow-hidden rounded-[14px] bg-sunken">
              <GarmentArt shape={shape} color={artColour(req?.attrs?.color)} size={48} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-head text-[15px] leading-snug font-semibold text-ink">{title}</span>
              {summary && <span className="block truncate text-[13px] leading-snug text-meta tabular-nums">{summary}</span>}
            </span>
            {pill && <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums', pill.tone)}>{pill.label}</span>}
            <ChevronDown size={20} aria-hidden className={clsx('shrink-0 text-meta transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="border-t border-line px-3.5 pt-2 pb-3">
              <dl className="divide-y divide-line">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]">
                    <dt className="shrink-0 text-meta">{k}</dt>
                    <dd className="min-w-0 text-right font-medium text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {onStore && (
                <button type="button" onClick={onStore} className="mt-1.5 -ml-1 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-1 text-[13px] font-semibold text-primary">
                  <Store size={16} aria-hidden /> {t('view_store')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sheets ──────────────────────────────────────────────────────────────────
const fieldCls =
  'mt-1 h-12 w-full rounded-[16px] border border-transparent bg-sunken px-3.5 text-[16px] text-ink tabular-nums outline-none transition-colors focus:border-line-strong focus:bg-surface';
const areaCls =
  'mt-1 w-full resize-none rounded-[16px] border border-transparent bg-sunken px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-line-strong focus:bg-surface';

function NumberField({ label, value, onChange, prefix, step = 1 }: { label: string; value: string; onChange: (v: string) => void; prefix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3.5 mt-0.5 -translate-y-1/2 text-meta">{prefix}</span>}
        <input
          inputMode="decimal"
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(fieldCls, prefix && 'pl-8')}
        />
      </span>
    </label>
  );
}

function SheetError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-3 rounded-[16px] bg-danger-tint px-3 py-2 text-[14px] text-danger">
      {error}
    </p>
  ) : null;
}

function OfferSheet({ open, onClose, detail, onDone }: { open: boolean; onClose: () => void; detail: Detail; onDone: () => void }) {
  const t = useT();
  const last = detail.offers.at(-1);
  const req = detail.requirement;
  const unit = req?.unit ?? last?.unit ?? 'piece';
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [dispatch, setDispatch] = useState('4');
  const [advance, setAdvance] = useState('30');
  const [credit, setCredit] = useState('0');
  const [freight, setFreight] = useState<'paid' | 'to_pay'>('paid');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrice(String(last?.unit_price ?? req?.budget ?? ''));
    setQty(String(req?.qty ?? last?.qty ?? ''));
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = Number(price);
  const q = Number(qty);
  const total = p > 0 && q > 0 ? p * q : 0;

  async function submit() {
    if (!(p > 0)) return setError(t('offer_price', { unit: unitPer(unit, detail.me.language || 'en') }));
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/offers', {
        conversationId: detail.conversation.id,
        unitPrice: p,
        ...(q > 0 ? { qty: q } : {}),
        dispatchDays: Number(dispatch) || 0,
        advancePct: Math.min(100, Number(advance) || 0),
        creditDays: Number(credit) || 0,
        freight,
        ...(last?.listing_id ? { listingId: last.listing_id } : {}),
        ...(req?.title ? { title: req.title } : {}),
      });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('make_offer')}
      subtitle={req?.title}
      footer={
        <>
          {total > 0 && (
            <p className="mb-2 flex items-baseline justify-between text-[14px]">
              <span className="text-ink-2">{t('total')}</span>
              <span className="font-head text-[18px] font-bold text-ink tabular-nums">{inr(total)}</span>
            </p>
          )}
          <Button block size="lg" icon={Send} loading={busy} disabled={!(p > 0)} onClick={() => void submit()}>
            {t('send_offer')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={t('offer_price', { unit: unitPer(unit, detail.me.language || 'en') })} value={price} onChange={setPrice} prefix="₹" step={0.5} />
        <NumberField label={`${t('quantity')} (${unitQty(unit, 2, detail.me.language || 'en')})`} value={qty} onChange={setQty} />
        <NumberField label={t('dispatch_days')} value={dispatch} onChange={setDispatch} />
        <NumberField label={t('advance')} value={advance} onChange={setAdvance} />
        <NumberField label={t('credit_days')} value={credit} onChange={setCredit} />
        <div>
          <span className="text-[13px] font-medium text-ink-2">{t('freight')}</span>
          <div className="mt-1 grid grid-cols-1 gap-1.5">
            {(['paid', 'to_pay'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFreight(f)}
                aria-pressed={freight === f}
                className={clsx(
                  'min-h-[40px] rounded-full border px-2 text-[13px] font-medium transition-colors',
                  freight === f ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-surface text-ink-2 hover:bg-sunken',
                )}
              >
                {f === 'paid' ? t('freight_paid') : t('freight_topay')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <SheetError error={error} />
    </Sheet>
  );
}

function SampleSheet({ open, onClose, conversationId, listingId, onDone }: { open: boolean; onClose: () => void; conversationId: string; listingId?: string; onDone: () => void }) {
  const t = useT();
  const [sizes, setSizes] = useState<string[]>(['M', 'L', 'XL']);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/samples', { conversationId, sizes, note: note.trim(), ...(listingId ? { listingId } : {}) });
      setNote('');
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('request_sample')}
      footer={
        <Button block size="lg" icon={Send} loading={busy} disabled={!sizes.length} onClick={() => void submit()}>
          {t('send_request')}
        </Button>
      }
    >
      <p className="text-[13px] font-medium text-ink-2">{t('sample_sizes')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SIZES.map((s) => {
          const on = sizes.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setSizes((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
              className={clsx(
                'min-h-[44px] min-w-[56px] rounded-full border px-4 text-[14px] font-semibold transition-colors',
                on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-sunken',
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-ink-2">{t('sample_note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={areaCls} />
      </label>
      <SheetError error={error} />
    </Sheet>
  );
}

function HelpSheet({
  open,
  onClose,
  conversationId,
  order,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  order: OrderRow | null;
  onDone: () => void;
}) {
  const t = useT();
  const reasons = order
    ? (['problem_short', 'problem_damaged', 'problem_colour', 'problem_quality', 'problem_payment', 'problem_other'] as const)
    : (['problem_payment', 'problem_quality', 'problem_other'] as const);
  const [reason, setReason] = useState<string>(reasons[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (order) {
        await api.post(`/api/orders/${order.id}/event`, { type: 'problem', payload: { reason: reason.replace('problem_', ''), note: note.trim(), conversationId } });
      } else {
        // No order yet: hand off to the Trade Desk through Claire's "talk to a person" path.
        await api.post('/api/claire/turn', { chipId: 'home:human' });
      }
      setNote('');
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={order ? t('report_problem') : t('trade_desk')}
      subtitle={order ? `${order.code} · ${order.title}` : undefined}
      footer={
        <Button block size="lg" iconRight={ArrowRight} loading={busy} onClick={() => void submit()}>
          {t('trade_desk')}
        </Button>
      }
    >
      <p className="text-[13px] font-medium text-ink-2">{t('problem_what')}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className={clsx(
              'min-h-[48px] rounded-[16px] border px-3 text-left text-[14px] font-medium transition-colors',
              reason === r ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-surface text-ink-2 hover:bg-sunken',
            )}
          >
            {t(r)}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-ink-2">{t('problem_note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={areaCls} />
      </label>
      <SheetError error={error} />
    </Sheet>
  );
}

/** Confirm step for the "Accept ₹92" smart reply (same endpoint and confirmation as the offer card). */
function AcceptSheet({ open, offer, onClose, onDone }: { open: boolean; offer: OfferRow | null; onClose: () => void; onDone: () => void }) {
  const lang = useSession((s) => s.user?.language || 'en');
  const dt = dealT(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const per = offer ? unitPer(offer.unit, lang) : '';

  async function accept() {
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/offers/${encodeURIComponent(offer.id)}/respond`, { action: 'accept' });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={offer ? dt('accept_title', { price: inr(offer.unit_price, { decimals: true }), unit: per }) : ''}
      subtitle={offer?.title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            {strings(lang)('cancel')}
          </Button>
          <Button size="lg" icon={Check} loading={busy} onClick={() => void accept()}>
            {dt('accept_yes')}
          </Button>
        </div>
      }
    >
      {offer && (
        <div className="rounded-[18px] bg-sunken px-4 py-3">
          <p className="text-ink">
            <span className="font-head text-[28px] leading-none font-bold tabular-nums">{inr(offer.unit_price, { decimals: true })}</span>
            <span className="text-[15px] text-meta"> / {per}</span>
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
            {dt('accept_body', { qty: `${num(offer.qty)} ${unitQty(offer.unit, offer.qty, lang)}`, total: inr(offer.total) })}
          </p>
        </div>
      )}
      <SheetError error={error} />
    </Sheet>
  );
}
