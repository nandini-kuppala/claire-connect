// Home: where signed-in traders land. Claire greets, one big "tell me what you need" field,
// three quick actions, example asks and recent searches. Sellers also get a small business strip.
//
// Contracts with the Claire screen (/chat/claire, location.state):
//   { send: text }      → Claire sends `text` once as the user's message
//   { voice: true }     → Claire opens the voice recorder
//   { chip: 'home:buy' } → Claire taps its "browse / buy" chip
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { catById } from '@shared/taxonomy';
import { ArrowRight, Camera, ChevronDown, ChevronRight, FileText, History, LayoutGrid, MessagesSquare, Mic, Search, Store } from '../icons';
import { api } from '../lib/api';
import { firstName, langNative, num } from '../lib/format';
import { useSession } from '../store/session';
import { AppShell } from '../components/AppShell';
import { BrandMark, ClaireMark } from '../components/Avatar';
import { GarmentArt } from '../components/GarmentArt';
import { Sheet } from '../components/Sheet';
import { CatalogSheet } from '../components/CatalogSheet';
import { HomeStrings, type HomeKey } from './Home.strings';

interface RecentRequirement {
  id: string;
  title: string;
  categoryId?: string | null;
  qty?: number | null;
  unit?: string | null;
  budget?: number | null;
  deadlineDays?: number | null;
  city?: string | null;
  createdAt?: number | string;
  matchCount?: number | null;
}

interface InboxRow {
  side?: 'buyer' | 'seller' | null;
  kind?: string;
  pendingOffer?: boolean;
}

// Flat thumbnail tints + garment colours from the cotton palette.
const THUMB = {
  green: { color: '#1F8C73', bg: '#E3EEE8' },
  clay: { color: '#B9502F', bg: '#F7E4DB' },
  gold: { color: '#E9A23B', bg: '#FDF4E3' },
  ink: { color: '#3C4247', bg: '#F3F4F6' },
  plum: { color: '#6D4466', bg: '#F1E8EF' },
} as const;
type Tone = keyof typeof THUMB;

const TEMPLATES: { key: HomeKey; sentence: HomeKey; shape: string; tone: Tone }[] = [
  { key: 't_tee', sentence: 't_tee_s', shape: 'tshirt', tone: 'green' },
  { key: 't_polo', sentence: 't_polo_s', shape: 'polo', tone: 'clay' },
  { key: 't_track', sentence: 't_track_s', shape: 'trackpants', tone: 'ink' },
  { key: 't_kids', sentence: 't_kids_s', shape: 'kidsset', tone: 'gold' },
  { key: 't_inner', sentence: 't_inner_s', shape: 'brief', tone: 'plum' },
  { key: 't_fabric', sentence: 't_fabric_s', shape: 'fabric', tone: 'green' },
];

const EXAMPLES_BUYER: { key: HomeKey; shape: string; tone: Tone }[] = [
  { key: 'ex1', shape: 'tshirt', tone: 'green' },
  { key: 'ex2', shape: 'trackpants', tone: 'ink' },
  { key: 'ex3', shape: 'polo', tone: 'clay' },
];
const EXAMPLES_SELLER: { key: HomeKey; shape: string; tone: Tone }[] = [
  { key: 'exs1', shape: 'fabric', tone: 'green' },
  { key: 'exs2', shape: 'sewing', tone: 'clay' },
  { key: 'exs3', shape: 'print', tone: 'gold' },
];

const RECENT_TONES: Tone[] = ['green', 'clay', 'gold', 'ink', 'plum'];

function Thumb({ shape, tone, size, className }: { shape: string; tone: Tone; size: number; className?: string }) {
  const th = THUMB[tone];
  return <GarmentArt shape={shape} color={th.color} size={size} className={clsx('shrink-0 rounded-[12px]', className)} style={{ background: th.bg }} />;
}

export default function Home() {
  const s = HomeStrings.use();
  const navigate = useNavigate();
  const user = useSession((st) => st.user);
  const business = useSession((st) => st.business);
  const lang = user?.language || 'en';
  const sells = (business?.sells?.length ?? 0) > 0;

  const [text, setText] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [recent, setRecent] = useState<RecentRequirement[] | null>(null);
  const [enquiries, setEnquiries] = useState<{ open: number; offers: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ requirements?: RecentRequirement[] }>('/api/requirements?limit=6')
      .then((r) => alive && setRecent(Array.isArray(r?.requirements) ? r.requirements.slice(0, 6) : []))
      .catch(() => alive && setRecent([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!sells) return;
    let alive = true;
    api
      .get<InboxRow[] | { conversations?: InboxRow[] }>('/api/conversations')
      .then((r) => {
        const rows = (Array.isArray(r) ? r : (r?.conversations ?? [])).filter((c) => c.side === 'seller' && c.kind !== 'support');
        if (alive) setEnquiries({ open: rows.length, offers: rows.filter((c) => c.pendingOffer).length });
      })
      .catch(() => alive && setEnquiries(null));
    return () => {
      alive = false;
    };
  }, [sells]);

  const ask = (value: string) => {
    const v = value.trim();
    if (v) navigate('/chat/claire', { state: { send: v } });
  };
  const speak = () => navigate('/chat/claire', { state: { voice: true } });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) ask(text);
    else inputRef.current?.focus();
  }

  const name = firstName(user?.name);
  const examples = sells ? EXAMPLES_SELLER : EXAMPLES_BUYER;
  const unitText = (u?: string | null) => (u === 'kg' ? s('u_kg') : u === 'dozen' ? s('u_dozen') : s('u_piece'));

  const quick = [
    sells
      ? { id: 'upload', icon: Camera, label: s('qa_upload'), tone: 'bg-clay-tint text-clay', onClick: () => setCatalogOpen(true) }
      : { id: 'browse', icon: LayoutGrid, label: s('qa_browse'), tone: 'bg-clay-tint text-clay', onClick: () => navigate('/chat/claire', { state: { chip: 'home:buy' } }) },
    { id: 'speak', icon: Mic, label: s('qa_speak'), tone: 'bg-primary-tint text-primary', onClick: speak },
    { id: 'template', icon: FileText, label: s('qa_template'), sub: s('qa_template_sub'), tone: 'bg-accent-tint text-accent-ink', onClick: () => setTemplatesOpen(true) },
  ];

  return (
    <AppShell>
      <div className="px-4 pt-[calc(12px+var(--safe-top))] pb-6">
        {/* Header */}
        <header className="flex min-h-[52px] items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={38} />
            <span className="font-head text-[18px] font-bold tracking-tight text-ink">
              CLAIRE <span className="text-brand">Connect</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/language')}
            aria-label={s('change_language')}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-3 pl-3.5 text-[15px] font-medium text-ink transition-colors hover:bg-sunken"
          >
            <span lang={lang}>{langNative(lang)}</span>
            <ChevronDown size={16} className="text-meta" aria-hidden />
          </button>
        </header>

        {/* Greeting */}
        <section className="mt-6 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-head text-[28px] leading-[1.15] font-bold text-ink">{name ? s('hi_name', { name }) : s('hi')}</h1>
            <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{sells ? s('purpose_seller') : s('purpose')}</p>
          </div>
          <ClaireMark size={60} className="mt-1" />
        </section>

        {/* Search */}
        <form
          onSubmit={onSubmit}
          role="search"
          className="mt-5 flex min-h-[64px] items-center gap-2 rounded-[22px] border border-line-strong bg-surface py-2 pr-2 pl-4 transition-colors focus-within:border-primary"
        >
          <Search size={22} className="shrink-0 text-meta" aria-hidden />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={s('search_ph')}
            aria-label={s('search_ph')}
            enterKeyHint="send"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-meta"
          />
          {text.trim() ? (
            <button type="submit" aria-label={s('send')} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover active:scale-95">
              <ArrowRight size={22} aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={speak} aria-label={s('speak')} className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover active:scale-95">
              <Mic size={22} aria-hidden />
            </button>
          )}
        </form>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {quick.map(({ id, icon: Icon, label, sub, tone, onClick }) => (
            <button
              key={id}
              type="button"
              onClick={onClick}
              className="flex min-h-[118px] flex-col items-center gap-2 rounded-[22px] border border-line bg-surface px-2 pt-3.5 pb-3 text-center transition-colors hover:bg-sunken/60 active:scale-[0.98]"
            >
              <span className={clsx('flex size-11 items-center justify-center rounded-[14px]', tone)}>
                <Icon size={22} aria-hidden />
              </span>
              <span className="text-[13.5px] leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{label}</span>
              {sub && <span className="-mt-1 text-[11.5px] leading-snug text-meta [overflow-wrap:anywhere]">{sub}</span>}
            </button>
          ))}
        </div>

        {/* Seller strip */}
        {sells && business && (
          <section className="mt-6" aria-labelledby="biz-h">
            <h2 id="biz-h" className="px-1 font-head text-[17px] font-semibold text-ink">
              {s('seller_title')}
            </h2>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/chats')}
                className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-sunken/60"
              >
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                  <MessagesSquare size={20} aria-hidden />
                  {!!enquiries?.offers && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-clay ring-2 ring-surface" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug font-semibold text-ink">{s('seller_requests')}</span>
                  <span className={clsx('block text-[12.5px] leading-snug', enquiries?.offers ? 'font-medium text-clay' : 'text-meta')}>
                    {enquiries == null
                      ? '…'
                      : enquiries.offers
                        ? s('seller_offers_n', { n: num(enquiries.offers) })
                        : enquiries.open
                          ? s('seller_requests_n', { n: num(enquiries.open) })
                          : s('seller_requests_none')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/store/${business.id}`)}
                className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-sunken/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                  <Store size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug font-semibold text-ink">{s('seller_store')}</span>
                  <span className="block text-[12.5px] leading-snug text-meta">{s('seller_store_sub')}</span>
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Try asking like this */}
        <section className="mt-6" aria-labelledby="try-h">
          <div className="flex items-center gap-2 px-1">
            <ClaireMark size={22} />
            <h2 id="try-h" className="font-head text-[17px] font-semibold text-ink">
              {s('try_title')}
            </h2>
          </div>
          <ul className="mt-2.5 flex flex-col gap-2">
            {examples.map((ex) => (
              <li key={ex.key}>
                <button
                  type="button"
                  onClick={() => ask(s(ex.key))}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-[18px] border border-line bg-surface py-2 pr-3 pl-2 text-left transition-colors hover:bg-sunken/60 active:scale-[0.99]"
                >
                  <Thumb shape={ex.shape} tone={ex.tone} size={40} />
                  <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">“{s(ex.key)}”</span>
                  <ArrowRight size={18} className="shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent searches (hidden until the endpoint answers with something) */}
        {!!recent?.length && (
          <section className="mt-6" aria-labelledby="recent-h">
            <div className="flex items-center gap-2 px-1">
              <History size={18} className="text-meta" aria-hidden />
              <h2 id="recent-h" className="font-head text-[17px] font-semibold text-ink">
                {s('recent_title')}
              </h2>
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {recent.map((r, i) => {
                const cat = catById(r.categoryId);
                const facts = [r.qty ? `${num(r.qty)} ${unitText(r.unit ?? cat?.unit)}` : null, r.city].filter(Boolean).join(' · ');
                return (
                  <li key={r.id} className="max-w-full">
                    <button
                      type="button"
                      onClick={() => navigate('/results/' + r.id)}
                      className="flex min-h-[48px] max-w-full items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-4 pl-1 text-left transition-colors hover:bg-sunken/60"
                    >
                      <Thumb shape={cat?.shape ?? 'tshirt'} tone={RECENT_TONES[i % RECENT_TONES.length]} size={38} className="rounded-full" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] leading-tight font-semibold text-ink">{r.title}</span>
                        {(facts || r.matchCount) && (
                          <span className="block truncate text-[12px] leading-tight text-meta">
                            {[facts, r.matchCount ? s('matches_n', { n: r.matchCount }) : null].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-faint" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Templates */}
      <Sheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} title={s('tpl_title')} subtitle={s('tpl_sub')}>
        <ul className="flex flex-col gap-2 pb-2">
          {TEMPLATES.map((tp) => (
            <li key={tp.key}>
              <button
                type="button"
                onClick={() => {
                  setTemplatesOpen(false);
                  ask(s(tp.sentence));
                }}
                className="flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border border-line bg-surface p-2 pr-3 text-left transition-colors hover:bg-sunken/60"
              >
                <Thumb shape={tp.shape} tone={tp.tone} size={52} className="rounded-[14px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] leading-snug font-semibold text-ink">{s(tp.key)}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-meta">{s(tp.sentence)}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {sells && <CatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} />}
    </AppShell>
  );
}
