// Visual QA route for every chat card. This is the ONLY place in the app with sample data.
import { useMemo, useState, type ReactNode } from 'react';
import type { CardPayload, HintPayload } from '@shared/cards';
import GarmentArt from '../components/GarmentArt';
import { CardRenderer } from './CardRenderer';
import { HintBubble } from './HintBubble';
import { ReplyBubble } from './ReplyBubble';
import { flatArtStyle } from './Tiles';
import type { CardCtx, ChatMessage } from './types';

const BUYER_BIZ = 'b_amit';
const SELLER_BIZ = 'b_sree';
const DAY = 86_400_000;
const NOW = Date.now();

const SHAPES = ['tshirt', 'polo', 'trackpants', 'shorts', 'brief', 'vest', 'kidsset', 'nightwear', 'leggings', 'hoodie', 'fabric', 'yarn', 'sewing', 'print', 'dye'] as const;
const VARIANTS: { shape: string; color: string; pattern?: string }[] = [
  { shape: 'trackpants', color: '#13203B', pattern: 'stripe' },
  { shape: 'trackpants', color: '#13203B', pattern: 'piping' },
  { shape: 'trackpants', color: '#3F4A2F', pattern: 'pocket' },
  { shape: 'tshirt', color: '#13203B', pattern: 'print' },
  { shape: 'tshirt', color: '#FFFFFF' },
  { shape: 'tshirt', color: '#1F8C73', pattern: 'stripe' },
  { shape: 'polo', color: '#FFFFFF', pattern: 'tipped' },
  { shape: 'polo', color: '#1F8C73' },
  { shape: 'nightwear', color: '#C98E86', pattern: 'dots' },
  { shape: 'kidsset', color: '#E9A23B', pattern: 'print' },
  { shape: 'vest', color: '#FAFAF9' },
  { shape: 'fabric', color: '#D3D7DC' },
];

const SAMPLES: { label: string; mine: boolean; sender: string; payload: CardPayload }[] = [
  {
    label: 'chips · grid (home)',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'chips',
      text: 'Namaste Amit ji. What do you need today?',
      hint: 'Tap one, or just speak.',
      layout: 'grid',
      chips: [
        { id: 'home:buy', label: 'Buy garments', primary: true },
        { id: 'home:fabric', label: 'Fabric & yarn' },
        { id: 'home:job', label: 'Get job work done' },
        { id: 'home:sell', label: '📷  Sell / add products' },
        { id: 'home:orders', label: 'My orders' },
        { id: 'home:human', label: 'Talk to a person' },
      ],
    },
  },
  {
    label: 'chips · row (quantity)',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'chips',
      text: 'How many pieces?',
      hint: 'Sold in size sets M:L:XL:XXL = 2:2:2:1',
      chips: [300, 500, 1000, 2000, 5000].map((n) => ({ id: `qty:${n}`, label: n.toLocaleString('en-IN') })),
    },
  },
  {
    label: 'tiles',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'tiles',
      text: 'Which product?',
      tiles: [
        { id: 'cat:garment.tshirt', label: 'T-shirts', shape: 'tshirt', color: '#B9502F' },
        { id: 'cat:garment.polo', label: 'Polo T-shirts', shape: 'polo', color: '#1F8C73' },
        { id: 'cat:garment.trackpants', label: 'Track pants', shape: 'trackpants', color: '#13203B' },
        { id: 'cat:garment.shorts', label: 'Shorts', shape: 'shorts', color: '#697077' },
        { id: 'cat:garment.innerwear', label: 'Innerwear', shape: 'brief', color: '#8A5A12' },
        { id: 'cat:garment.vest', label: 'Vests', shape: 'vest', color: '#FFFFFF' },
        { id: 'cat:garment.kids', label: 'Kids wear', shape: 'kidsset', color: '#E9A23B' },
        { id: 'cat:garment.nightwear', label: 'Nightwear', shape: 'nightwear', color: '#C98E86' },
        { id: 'cat:garment.hoodie', label: 'Sweatshirts', shape: 'hoodie', color: '#7A2E22' },
      ],
    },
  },
  {
    label: 'carousel',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'carousel',
      text: 'Here are cotton track pants on CLAIRE. Tap the heart on styles you like.',
      selectable: true,
      doneChip: { id: 'style:done', label: 'Done', primary: true },
      extraChips: [{ id: 'style:any', label: 'Any style' }],
      items: [
        { id: 'l1', businessId: 'b_sree', businessName: 'Sree Textiles', title: 'Cotton loopknit track pants, 240 GSM', price: 168, unit: 'piece', moq: 300, stock: 1200, trust: 86, art: { shape: 'trackpants', color: '#13203B' } },
        { id: 'l2', businessId: 'b_kavin', businessName: 'Kavin Knits', title: 'Cotton track pants, side stripe, 230 GSM', price: 165, unit: 'piece', moq: 200, stock: 600, trust: 81, art: { shape: 'trackpants', color: '#13203B', pattern: 'stripe' } },
        { id: 'l3', businessId: 'b_velan', businessName: 'Sri Velan Garments', title: 'Lycra track pants, slim fit', price: 189, unit: 'piece', moq: 200, stock: 2000, trust: 77, art: { shape: 'trackpants', color: '#13203B', pattern: 'piping' } },
        { id: 'l4', businessId: 'b_sree', businessName: 'Sree Textiles', title: 'Cotton joggers with zip pockets, 260 GSM', price: 196, unit: 'piece', moq: 200, stock: 500, trust: 86, art: { shape: 'trackpants', color: '#3F4A2F', pattern: 'pocket' } },
      ],
    },
  },
  { label: 'summary', mine: false, sender: 'claire', payload: { kind: 'summary', title: 'Your requirement', lines: ['1,000 cotton track pants · ≤ ₹170/pc · Kolkata · in 2 weeks'] } },
  {
    label: 'results',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'results',
      requirementId: 'rq_demo',
      title: '1,000 cotton track pants · ≤ ₹170 · Kolkata',
      band: { p25: 152, median: 168, p75: 189 },
      singles: [
        {
          kind: 'single',
          lines: [{ listingId: 'l1', businessId: 'b_sree', businessName: 'Sree Textiles', qty: 1000, unitPrice: 168, readyDays: 3 }],
          avgPrice: 168, total: 168000, freight: 5000, readyDays: 3, trust: 86, badges: ['GST verified', 'Manufacturer'],
          art: { shape: 'trackpants', color: '#13203B' }, rating: 4.6, onTimePct: 92, stock: 1200,
        },
      ],
      combos: [
        {
          kind: 'combo',
          lines: [
            { listingId: 'l2', businessId: 'b_kavin', businessName: 'Kavin Knits', qty: 600, unitPrice: 165, readyDays: 4 },
            { listingId: 'l5', businessId: 'b_rsg', businessName: 'RS Garments', qty: 400, unitPrice: 172, readyDays: 5 },
          ],
          avgPrice: 167.8, total: 167800, freight: 6500, readyDays: 5, trust: 79, badges: ['GST verified'],
          art: { shape: 'trackpants', color: '#13203B', pattern: 'stripe' },
        },
      ],
      mto: [
        {
          kind: 'mto',
          lines: [{ listingId: 'l6', businessId: 'b_anand', businessName: 'Anand Knitwear', qty: 1000, unitPrice: 158, readyDays: 12 }],
          avgPrice: 158, total: 158000, freight: 5000, readyDays: 12, trust: 74, badges: [], art: { shape: 'trackpants', color: '#3C4247' },
        },
      ],
    },
  },
  {
    label: 'requirement (seller view)',
    mine: false,
    sender: 'u_amit',
    payload: { kind: 'requirement', requirementId: 'rq_demo', title: 'Cotton track pants, 240 GSM', qty: 1000, unit: 'piece', budget: 170, deadlineDays: 14, city: 'Kolkata', buyerName: 'Amit Hosiery', buyerTrust: 78, buyerPaysOnTime: '3/3' },
  },
  {
    label: 'requirement (buyer view)',
    mine: true,
    sender: 'me',
    payload: { kind: 'requirement', requirementId: 'rq_demo', title: 'Cotton track pants, 240 GSM', qty: 1000, unit: 'piece', budget: 170, deadlineDays: 14, city: 'Kolkata', buyerName: 'Amit Hosiery', buyerTrust: 78 },
  },
  {
    label: 'offer (received, pending)',
    mine: false,
    sender: 'u_sree',
    payload: { kind: 'offer', offerId: 'of_1', fromBusinessId: SELLER_BIZ, fromName: 'Sree Textiles', title: 'Cotton loopknit track pants, 240 GSM', qty: 1000, unit: 'piece', unitPrice: 172, total: 172000, dispatchDays: 3, advancePct: 30, creditDays: 0, freight: 'to-pay', status: 'pending' },
  },
  {
    label: 'counter (sent by me, pending)',
    mine: true,
    sender: 'me',
    payload: { kind: 'offer', offerId: 'of_2', fromBusinessId: BUYER_BIZ, fromName: 'Amit Hosiery', title: 'Cotton loopknit track pants, 240 GSM', qty: 1000, unit: 'piece', unitPrice: 165, total: 165000, dispatchDays: 3, advancePct: 30, creditDays: 0, freight: 'to-pay', status: 'pending', parentPrice: 172 },
  },
  {
    label: 'offer (accepted)',
    mine: false,
    sender: 'u_sree',
    payload: { kind: 'offer', offerId: 'of_3', fromBusinessId: SELLER_BIZ, fromName: 'Sree Textiles', title: 'Cotton loopknit track pants, 240 GSM', qty: 1000, unit: 'piece', unitPrice: 168, total: 168000, dispatchDays: 3, advancePct: 30, creditDays: 15, freight: 'paid', status: 'accepted', parentPrice: 165 },
  },
  {
    label: 'order (dispatched)',
    mine: false,
    sender: 'claire_updates',
    payload: {
      kind: 'order', orderId: 'or_1', code: 'CC-24817', title: 'Cotton loopknit track pants, 240 GSM', qty: 1000, unit: 'piece', unitPrice: 168, total: 168000, status: 'dispatched',
      buyerBusinessId: BUYER_BIZ, sellerBusinessId: SELLER_BIZ, buyerName: 'Amit Hosiery', sellerName: 'Sree Textiles', advancePct: 30, creditDays: 15,
      dispatch: { transporter: 'KPN Parcel Service', lr: '55821', bundles: 12 }, balanceDueAt: NOW + 17 * DAY, gstPct: 5, ewayBill: true,
    },
  },
  {
    label: 'order (job work, in production)',
    mine: false,
    sender: 'claire_updates',
    payload: {
      kind: 'order', orderId: 'or_2', code: 'CC-24830', title: 'Stitching job work · track pants', qty: 2000, unit: 'piece', unitPrice: 22, total: 44000, status: 'in_production',
      buyerBusinessId: 'b_ravi', sellerBusinessId: SELLER_BIZ, buyerName: 'Ravi Knit Fashions', sellerName: 'Lakshmi Garments', advancePct: 0, creditDays: 30,
      gstPct: 5, ewayBill: false, kindLabel: 'Job work', qtyDone: 600,
    },
  },
  {
    label: 'rating',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'rating', orderId: 'or_1', direction: 'buyer_to_seller', rateeName: 'Sree Textiles',
      questions: [
        { id: 'quality', label: 'Quality matches sample' },
        { id: 'value', label: 'Value for money' },
        { id: 'on_time', label: 'Delivered on time', auto: 5 },
        { id: 'communication', label: 'Communication' },
      ],
    },
  },
  {
    label: 'orders',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'orders', text: 'Your orders',
      items: [
        { orderId: 'or_1', code: 'CC-24817', title: 'Cotton loopknit track pants', status: 'dispatched', total: 176400, counterpart: 'Sree Textiles', conversationId: 'deal_1' },
        { orderId: 'or_3', code: 'CC-24790', title: 'Plain round-neck tee, 180 GSM', status: 'closed', total: 61950, counterpart: 'Kavin Knits', conversationId: 'deal_2' },
      ],
    },
  },
  { label: 'agent_joined', mine: false, sender: 'trade_desk', payload: { kind: 'agent_joined', agentName: 'Meena', languages: ['ta', 'hi', 'en'], ticketCode: 'TD-1042' } },
  { label: 'resolved', mine: false, sender: 'trade_desk', payload: { kind: 'resolved', ticketCode: 'TD-1042', outcome: 'Seller will send the 40 short pieces by Friday; buyer releases balance on receipt.' } },
  { label: 'notice · info', mine: false, sender: 'claire_updates', payload: { kind: 'notice', text: 'Order CC-24817 was dispatched by KPN Parcel Service.', tone: 'info' } },
  { label: 'notice · warn', mine: false, sender: 'claire_updates', payload: { kind: 'notice', text: 'Balance of ₹1,17,600 is due in 2 days.', tone: 'warn' } },
  { label: 'notice · success', mine: false, sender: 'claire_updates', payload: { kind: 'notice', text: 'Payment confirmed by Sree Textiles.', tone: 'success' } },
  {
    label: 'profile',
    mine: false,
    sender: 'claire',
    payload: { kind: 'profile', name: 'Lakshmi', business: 'Lakshmi Garments', sells: ['Stitching job work', 'Plain tees'], buys: ['Knitted fabric', 'Thread'], city: 'Tiruppur', capacity: '600 pcs / day' },
  },
  {
    label: 'job_split',
    mine: false,
    sender: 'claire',
    payload: {
      kind: 'job_split', requirementId: 'rq_job', title: 'No single unit can finish 5,000 in 10 days. Best split:',
      lines: [
        { listingId: 'j1', businessId: 'b_lakshmi', businessName: 'Lakshmi Garments', qty: 2000, unitPrice: 22, readyDays: 8 },
        { listingId: 'j2', businessId: 'b_raju', businessName: 'Raju Stitching Works', qty: 1800, unitPrice: 21, readyDays: 9 },
        { listingId: 'j3', businessId: 'b_velan', businessName: 'Sri Velan Stitching', qty: 1200, unitPrice: 23, readyDays: 7 },
      ],
      total: 109400, avgPrice: 21.9, readyDays: 9,
    },
  },
];

const HINT: HintPayload = { text: 'Market median for this spec is ₹168. Your last 3 orders were at ₹170.', action: { label: 'Counter at ₹165', chipId: 'counter:165' } };

function msg(i: number, mine: boolean, sender: string, type: string, content: unknown): ChatMessage {
  return { id: `demo_${i}`, channel: { type: 'group', targetId: 'deal_demo' }, senderId: mine ? 'me' : sender, type, content, sentAt: NOW - (100 - i) * 1000, mine };
}

export default function CardGallery() {
  const [lang, setLang] = useState('en');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 6));

  const ctx = useMemo<CardCtx>(() => {
    const fake = <T,>(method: string, path: string, body?: unknown) =>
      new Promise<T>((resolve) => {
        push(`${method} ${path}${body ? ' ' + JSON.stringify(body).slice(0, 120) : ''}`);
        window.setTimeout(() => resolve((path === '/api/conversations' ? [] : path === '/api/deals/combo' ? { conversations: [] } : { conversation: { id: 'deal_demo' } }) as T), 500);
      });
    return {
      me: { id: 'me', businessId: role === 'buyer' ? BUYER_BIZ : SELLER_BIZ, language: lang },
      lang,
      chip: (id, label) => push(`chip ${id} "${label}"`),
      openStorefront: (id) => push(`openStorefront ${id}`),
      openDeal: (id, opts) => push(`openDeal ${id} ${JSON.stringify(opts ?? {})}`),
      openConversation: (id) => push(`openConversation ${id}`),
      api: {
        get: (p) => fake('GET', p),
        post: (p, b) => fake('POST', p, b),
        patch: (p, b) => fake('PATCH', p, b),
      },
      refresh: () => push('refresh()'),
    };
  }, [lang, role]);

  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="font-head text-[18px] font-semibold">Card gallery</h1>
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-11 rounded-[16px] border border-line bg-surface px-3 text-[14px]" aria-label="Language">
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="ta">தமிழ்</option>
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value as 'buyer' | 'seller')} className="h-11 rounded-[16px] border border-line bg-surface px-3 text-[14px]" aria-label="Viewer">
            <option value="buyer">Viewer: buyer</option>
            <option value="seller">Viewer: seller</option>
          </select>
          <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-meta" aria-live="polite">
            {log[0] ?? 'Interact with a card to see the call it makes.'}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-[960px] gap-8 px-4 py-6 lg:grid-cols-[420px_1fr]">
        <section className="min-w-0 space-y-6">
          {SAMPLES.map((s, i) => (
            <Item key={`${s.label}-${lang}-${role}`} label={s.label}>
              <CardRenderer message={msg(i, s.mine, s.sender, 'CC:Card', s.payload)} payload={s.payload} ctx={ctx} />
            </Item>
          ))}
          <Item label="hint (CC:Hint)">
            <HintBubble message={msg(90, false, 'claire', 'CC:Hint', HINT)} payload={HINT} ctx={ctx} />
          </Item>
          <Item label="reply (CC:Reply)">
            <ReplyBubble message={msg(91, true, 'me', 'CC:Reply', {})} payload={{ chipId: 'qty:1000', label: '1,000' }} />
          </Item>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 font-head text-[15px] font-semibold">Garment art</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {SHAPES.map((shape) => (
              <figure key={shape} className="overflow-hidden rounded-[18px] border border-line bg-surface">
                <GarmentArt shape={shape} color="#13203B" className="aspect-square" style={flatArtStyle} />
                <figcaption className="px-2 py-1.5 text-center text-[12px] text-ink-2">{shape}</figcaption>
              </figure>
            ))}
          </div>
          <h2 className="mb-3 mt-6 font-head text-[15px] font-semibold">Colours and patterns</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {VARIANTS.map((v, i) => (
              <figure key={i} className="overflow-hidden rounded-[18px] border border-line bg-surface">
                <GarmentArt shape={v.shape} color={v.color} pattern={v.pattern} className="aspect-[4/5]" style={flatArtStyle} />
                <figcaption className="px-2 py-1.5 text-center text-[12px] text-ink-2">
                  {v.shape}
                  {v.pattern ? ` · ${v.pattern}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
          <h2 className="mb-2 mt-6 font-head text-[15px] font-semibold">Call log</h2>
          <ul className="space-y-1 font-mono text-[12px] text-ink-2">
            {log.map((l, i) => (
              <li key={i} className="truncate">
                {l}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-meta">{label}</p>
      {children}
    </div>
  );
}
