// Seller storefront. In-app at /store/:businessId (auth) and public at /s/:slug (no auth, shared on WhatsApp).
// The owner sees their own store with the bottom nav, "Add products" (CatalogSheet) and quick price / stock edits.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Clock, Factory, ImagePlus, Languages, MapPin, MessageCircle, Pencil, Share2, ShieldCheck, Star } from '../icons';
import { scriptLang, translateItems } from '../chat/translate';
import { api } from '../lib/api';
import { roleText, useT } from '../i18n';
import { AppShell } from '../components/AppShell';
import { Avatar, ClaireMark } from '../components/Avatar';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { TrustBadge } from '../components/TrustBadge';
import { GarmentArt } from '../components/GarmentArt';
import { CatalogSheet } from '../components/CatalogSheet';
import { badgeLabel, strings } from '../cards/strings';
import {
  ErrorBar, Spinner, TrustBreakdown, catName, copyText, errMsg, fmtDate, initials, inr, listOf, normBiz, normListing, sizesText, useMe,
  whatsappShare, type Biz, type Listing,
} from '../desk/kit';
import { StoreS } from './Storefront.strings';

type S = ReturnType<typeof StoreS.use>;
interface Review { rater: string; scores: Record<string, number>; comment: string | null; at: number | null }

function normReview(r: any): Review {
  const rater = typeof r.rater === 'string' ? r.rater : r.rater?.name ?? r.rater_name ?? '';
  return { rater, scores: r.scores ?? {}, comment: r.comment ?? null, at: r.at ?? r.created_at ?? null };
}
const avgOf = (sc: Record<string, number>) => {
  const v = Object.values(sc).filter((x) => typeof x === 'number');
  return v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0;
};

// Flat cover colours (palette tokens), picked per business so stores feel distinct.
// Light tints so the business avatar (a deep dye colour) stands out on top of the band.
const COVERS = ['var(--color-primary-tint)', 'var(--color-clay-tint)', 'var(--color-accent-tint)', 'var(--color-sunken)'];
function coverFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[h % COVERS.length];
}

export default function Storefront() {
  const { businessId, slug } = useParams();
  const isPublic = !businessId && !!slug;
  const s = StoreS.use();
  const t = useT();
  const nav = useNavigate();
  const { lang, token, business: myBiz } = useMe();
  const [biz, setBiz] = useState<Biz | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'trust' | 'reviews' | null>(null);
  const [detail, setDetail] = useState<Listing | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutTr, setAboutTr] = useState<string | null>(null);
  const [aboutOriginal, setAboutOriginal] = useState(false);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = (await api.get(isPublic ? `/api/public/s/${encodeURIComponent(slug!)}` : `/api/businesses/${encodeURIComponent(businessId!)}`)) as any;
      setBiz(normBiz(r.business));
      setListings(listOf(r.listings).map(normListing).filter((l) => l.active));
      setReviews(listOf(r.reviews).map(normReview));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [isPublic, slug, businessId]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const isMine = !!myBiz && !!biz && myBiz.id === biz.id;
  const ownerView = isMine && !isPublic;
  const loggedIn = !!token;

  // About text in the viewer's language (skipped when it is already in it, or on my own store).
  const aboutText = biz?.about?.trim() ?? '';
  const bizId = biz?.id;
  useEffect(() => {
    setAboutTr(null);
    setAboutOriginal(false);
    if (!aboutText || !bizId || isMine || !loggedIn) return;
    const src = scriptLang(aboutText);
    if (src === lang || (!src && lang === 'en')) return;
    let live = true;
    const key = `about:${bizId}`;
    translateItems([{ id: key, text: aboutText, from: src ?? undefined, kind: 'text' }], lang)
      .then((m) => {
        const tr = m.get(key);
        if (live && tr) setAboutTr(tr);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [aboutText, bizId, lang, isMine, loggedIn]);

  const shareUrl = biz?.slug ? `${window.location.origin}/s/${biz.slug}` : window.location.href;
  const next = encodeURIComponent(biz ? `/store/${biz.id}` : window.location.pathname);

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 1800);
  }

  async function chat(listingId?: string) {
    if (!biz) return;
    if (!loggedIn) {
      nav(`/login?next=${next}`);
      return;
    }
    setOpening(true);
    try {
      // Already talking to this business (e.g. a buyer's page)? Reopen that chat instead of starting a deal.
      if (!listingId) {
        const convs = listOf<{ id: string; counterpart?: { id?: string } }>(await api.get('/api/conversations'), 'conversations');
        const existing = convs.find((c) => c.counterpart?.id === biz.id);
        if (existing) {
          nav(`/chat/${existing.id}`);
          return;
        }
      }
      const r = (await api.post('/api/deals/open', { sellerBusinessId: biz.id, ...(listingId ? { listingId } : {}) })) as { conversation: { id: string } };
      nav(`/chat/${r.conversation.id}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setOpening(false);
    }
  }

  async function share() {
    const text = `${biz?.name ?? ''} · CLAIRE Connect`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url: shareUrl });
        return;
      } catch { /* fall through to copy */ }
    }
    if (await copyText(shareUrl)) flash(s('copied'));
  }

  async function saveListing(l: Listing, patch: { price?: number; stock?: number; moq?: number }) {
    const body: Record<string, number> = {};
    if (patch.price != null && patch.price !== l.price) body.price = patch.price;
    if (patch.stock != null && patch.stock !== l.stock) body.stock_qty = patch.stock;
    if (patch.moq != null && patch.moq !== l.moq) body.moq = patch.moq;
    setEditing(null);
    if (!Object.keys(body).length) return;
    const prev = listings;
    setListings((ls) => ls.map((x) => (x.id === l.id ? { ...x, price: patch.price ?? x.price, stock: patch.stock ?? x.stock, moq: patch.moq ?? x.moq } : x)));
    try {
      await api.patch(`/api/listings/${encodeURIComponent(l.id)}`, body);
      flash(s('saved'));
    } catch (e) {
      setListings(prev);
      setError(errMsg(e));
    }
  }

  const ratingStats = useMemo(() => {
    const per = reviews.map((r) => avgOf(r.scores)).filter((x) => x > 0);
    return per.length ? { avg: per.reduce((a, c) => a + c, 0) / per.length, n: per.length } : null;
  }, [reviews]);

  if (loading)
    return (
      <Frame owner={ownerView}>
        <div className="flex min-h-[70dvh] items-center justify-center"><Spinner size={28} /></div>
      </Frame>
    );
  if (!biz)
    return (
      <Frame owner={ownerView}>
        <div className="flex h-14 items-center px-2 pt-[var(--safe-top)]">
          <button className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-sunken" onClick={() => nav(-1)} aria-label={s('back')}>
            <ArrowLeft size={20} />
          </button>
        </div>
        {error && <ErrorBar message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={s('retry')} />}
      </Frame>
    );

  const trust = biz.trust;
  const ratingAvg = trust?.ratingAvg ?? (ratingStats ? Math.round(ratingStats.avg * 10) / 10 : null);
  const ratingCount = trust?.ratingCount || ratingStats?.n || 0;
  const roleLine = [roleText(t, biz.role), biz.city].filter(Boolean).join(' · ');
  const badges: { key: string; icon?: ReactNode; label: string }[] = [];
  if (biz.gstVerified) badges.push({ key: 'gst', icon: <BadgeCheck size={14} />, label: s('gst') });
  if (biz.isManufacturer) badges.push({ key: 'mfr', icon: <Factory size={14} />, label: s('mfr') });
  if (biz.unitVisited) badges.push({ key: 'visit', icon: <ShieldCheck size={14} />, label: s('visited') });
  for (const b of trust?.badges ?? []) if (!/GST|Manufacturer|Unit visited/.test(b)) badges.push({ key: b, label: badgeLabel(b, strings(lang)) });
  const cover = coverFor(biz.name);
  const ctaLabel = biz.sells.length ? s('chat_seller') : s('open_chat');

  return (
    <Frame owner={ownerView}>
      <div className={ownerView ? '' : 'pb-[calc(96px+var(--safe-bottom))]'}>
        {/* Cover band: flat colour with a stitched thread line */}
        <div className="relative h-[124px] overflow-hidden rounded-b-[28px]" style={{ background: cover }}>
          <svg className="absolute inset-0 size-full" viewBox="0 0 480 124" preserveAspectRatio="none" aria-hidden>
            <path d="M-10 92 C 90 60, 180 118, 290 82 S 440 50, 500 70" fill="none" stroke="#13203B" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="7 7" strokeLinecap="round" />
            <path d="M-10 108 C 110 80, 210 128, 320 98 S 450 74, 500 88" fill="none" stroke="#13203B" strokeOpacity="0.08" strokeWidth="2" strokeDasharray="7 7" strokeLinecap="round" />
          </svg>
          <div className="relative flex items-center justify-between px-3 pt-[max(10px,var(--safe-top))]">
            {!isPublic ? (
              ownerView ? <span /> : (
                <button className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)]" onClick={() => nav(-1)} aria-label={s('back')}>
                  <ArrowLeft size={20} />
                </button>
              )
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface pl-1.5 pr-3.5">
                <ClaireMark size={28} />
                <span className="font-head text-[14px] font-bold text-ink">CLAIRE <span className="text-brand">Connect</span></span>
              </span>
            )}
            <button className="flex size-11 items-center justify-center rounded-full bg-surface text-ink" onClick={share} aria-label={s('share')}>
              <Share2 size={19} />
            </button>
          </div>
        </div>

        {/* Identity */}
        <div className="px-4">
          <div className="-mt-10 inline-flex rounded-full bg-page p-1">
            <Avatar name={biz.name} accent={biz.accent} size={76} />
          </div>
          <h1 className="mt-1.5 font-head text-[24px] font-bold leading-tight text-ink">{biz.name}</h1>
          {roleLine && (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-meta">
              <MapPin size={15} className="shrink-0" aria-hidden /> {roleLine}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {trust && <TrustBadge trust={trust.isNew ? { isNew: true } : trust.score} size="md" />}
            {ratingAvg != null && (
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink">
                <Star size={16} className="text-accent" aria-hidden /> {ratingAvg.toFixed(1)}
                <span className="font-normal text-meta">{s('ratings_n', { n: ratingCount })}</span>
              </span>
            )}
            {biz.replyMinutes != null && (
              <span className="inline-flex items-center gap-1 text-[14px] text-ink-2">
                <Clock size={15} className="text-meta" aria-hidden /> {s('replies_in', { n: biz.replyMinutes })}
              </span>
            )}
          </div>
          {trust && (
            <button className="mt-1 -ml-1 min-h-11 rounded-full px-1 text-[14px] font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setSheet('trust')}>
              {s('why')}
            </button>
          )}
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {badges.slice(0, 3).map((b) => (
                <span key={b.key} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-success-tint px-3 text-[13px] font-semibold text-success">
                  {b.icon}
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {trust && trust.vouchedBy.length > 0 && (
            <p className="mt-2.5 text-[14px] text-ink-2">{s('vouched', { names: trust.vouchedBy.map((v) => v.name).join(', ') })}</p>
          )}
        </div>

        {/* Owner tools */}
        {ownerView && (
          <section className="mx-4 mt-5 rounded-[22px] bg-accent-tint p-4">
            <p className="text-[14px] font-medium text-accent-ink">{s('your_store')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button icon={ImagePlus} onClick={() => setCatalogOpen(true)}>{s('add_products')}</Button>
              <a
                href={whatsappShare(`${s('share_msg')}: ${shareUrl}`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-center text-[15px] font-semibold leading-tight text-ink hover:bg-sunken"
              >
                <Share2 size={18} className="shrink-0" aria-hidden /> {s('share_whatsapp')}
              </a>
            </div>
          </section>
        )}

        {/* About (translated for the viewer through the chat translation path) */}
        {biz.about && (
          <section className="mx-4 mt-5 rounded-[22px] border border-line bg-surface p-4">
            <h2 className="font-head text-[17px] font-semibold text-ink">{s('about')}</h2>
            <p className={`mt-1.5 text-[15px] leading-relaxed text-ink-2 ${aboutOpen ? '' : 'line-clamp-3'}`}>{aboutTr && !aboutOriginal ? aboutTr : biz.about}</p>
            {aboutTr && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-meta">
                <Languages size={13} aria-hidden className="shrink-0" />
                <span>{aboutOriginal ? t('original') : t('translated')}</span>
                <span aria-hidden className="text-faint">·</span>
                <button type="button" className="min-h-11 font-semibold text-primary" onClick={() => setAboutOriginal((v) => !v)}>
                  {aboutOriginal ? t('show_translation') : t('show_original')}
                </button>
              </p>
            )}
            {biz.about.length > 140 && (
              <button className="mt-1 min-h-10 text-[14px] font-semibold text-primary" onClick={() => setAboutOpen((v) => !v)}>
                {aboutOpen ? s('less') : s('more')}
              </button>
            )}
          </section>
        )}

        {error && <ErrorBar message={error} retryLabel={s('retry')} />}

        {/* Products */}
        <section className="mt-6 px-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-head text-[18px] font-semibold text-ink">
              {s('products')} <span className="font-normal text-meta">{listings.length || ''}</span>
            </h2>
          </div>
          {ownerView && listings.length > 0 && <p className="mt-0.5 text-[13px] text-meta">{s('tap_edit')}</p>}
          {listings.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {listings.map((l) => (
                <ProductCard key={l.id} l={l} s={s} owner={ownerView} onClick={() => (ownerView ? setEditing(l) : setDetail(l))} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[22px] border border-line bg-surface px-5 py-8 text-center">
              <p className="font-head text-[16px] font-semibold text-ink">{s('no_products')}</p>
              {ownerView && (
                <>
                  <p className="mx-auto mt-1 max-w-[280px] text-[14px] leading-relaxed text-meta">{s('no_products_owner')}</p>
                  <Button className="mt-4" icon={ImagePlus} onClick={() => setCatalogOpen(true)}>{s('add_products')}</Button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Reviews (first two; the rest in a sheet) */}
        {reviews.length > 0 && (
          <section className="mt-7 px-4 pb-6">
            <div className="flex items-center justify-between">
              <h2 className="font-head text-[18px] font-semibold text-ink">{s('reviews')} <span className="font-normal text-meta">{reviews.length}</span></h2>
              {reviews.length > 2 && (
                <button className="min-h-11 rounded-full px-2 text-[14px] font-semibold text-primary" onClick={() => setSheet('reviews')}>{s('see_all')}</button>
              )}
            </div>
            <ul className="mt-2 space-y-2">
              {reviews.slice(0, 2).map((r, i) => <ReviewItem key={i} r={r} s={s} lang={lang} />)}
            </ul>
          </section>
        )}
      </div>

      {/* Sticky CTA (buyers / visitors) */}
      {!ownerView && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 pt-3 pb-[max(12px,var(--safe-bottom))]">
          {isMine ? (
            <a
              href={whatsappShare(`${s('share_msg')}: ${shareUrl}`)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-[16px] font-semibold text-white hover:bg-primary-hover"
            >
              <Share2 size={18} aria-hidden /> {s('share_whatsapp')}
            </a>
          ) : (
            <Button block size="lg" icon={MessageCircle} loading={opening} onClick={() => void chat()}>
              {ctaLabel}
            </Button>
          )}
        </div>
      )}

      {notice && (
        <div
          className={`fixed inset-x-0 z-40 mx-auto w-fit rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-surface shadow-[var(--shadow-float)] ${ownerView ? 'bottom-[calc(92px+var(--safe-bottom))]' : 'bottom-[calc(96px+var(--safe-bottom))]'}`}
          role="status"
        >
          {notice}
        </div>
      )}

      {/* Trust sheet */}
      {trust && (
        <Sheet open={sheet === 'trust'} onClose={() => setSheet(null)} title={s('trust_title')} subtitle={trust.isNew ? s('trust_new') : s('trust_how')}>
          <p className="font-head text-[40px] font-bold leading-none tabular-nums text-plum">
            {Math.round(trust.score)}<span className="text-[16px] font-semibold text-meta">/100</span>
          </p>
          <div className="mt-5">
            <TrustBreakdown
              trust={trust}
              showTips
              labels={{
                verification: { label: s('t_verification'), tip: s('t_verification_tip') },
                ratings: { label: s('t_ratings'), tip: s('t_ratings_tip') },
                reliability: { label: s('t_reliability'), tip: s('t_reliability_tip') },
                responsiveness: { label: s('t_responsiveness'), tip: s('t_responsiveness_tip') },
                disputes: { label: s('t_disputes'), tip: s('t_disputes_tip') },
              }}
            />
          </div>
          {(trust.paysOnTime || trust.onTimePct != null || trust.repeatBuyers > 0) && (
            <dl className="mt-5 divide-y divide-line rounded-[18px] border border-line">
              {trust.paysOnTime && <Fact label={s('pays_on_time')} value={trust.paysOnTime} />}
              {trust.onTimePct != null && <Fact label={s('on_time')} value={`${trust.onTimePct}%`} />}
              {trust.repeatBuyers > 0 && <Fact label={s('repeat')} value={String(trust.repeatBuyers)} />}
            </dl>
          )}
          <div className="h-3" />
        </Sheet>
      )}

      {/* All reviews */}
      <Sheet open={sheet === 'reviews'} onClose={() => setSheet(null)} title={s('reviews')}>
        <ul className="space-y-2 pb-3">
          {reviews.map((r, i) => <ReviewItem key={i} r={r} s={s} lang={lang} />)}
        </ul>
      </Sheet>

      {/* Product detail (buyers) */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        footer={
          detail && !isMine ? (
            <Button block size="lg" icon={MessageCircle} loading={opening} onClick={() => void chat(detail.id)}>
              {s('enquire')}
            </Button>
          ) : undefined
        }
      >
        {detail && (
          <div className="pb-3">
            <div className="overflow-hidden rounded-[18px] bg-sunken">
              <ProductArt l={detail} big />
            </div>
            <p className="mt-4 font-head text-[26px] font-bold tabular-nums text-ink">
              {inr(detail.price)}
              <span className="text-[15px] font-normal text-meta">{s('per', { u: unitWord(detail.unit, s) })}</span>
            </p>
            <dl className="mt-3 divide-y divide-line rounded-[18px] border border-line">
              <Fact label={s('category')} value={catName(detail.category, lang)} />
              {detail.moq != null && <Fact label={s('min_order')} value={`${detail.moq.toLocaleString('en-IN')} ${unitWord(detail.unit, s)}`} />}
              {detail.type === 'service'
                ? detail.capacityPerDay ? <Fact label={s('capacity_day')} value={detail.capacityPerDay.toLocaleString('en-IN')} /> : null
                : <Fact label={s('stock')} value={detail.stock ? detail.stock.toLocaleString('en-IN') : s('made_to_order')} />}
              {sizesText(detail.sizeSet) && <Fact label={s('sizes')} value={sizesText(detail.sizeSet)} />}
              {detail.leadDays != null && <Fact label={s('dispatch')} value={s('n_days', { n: detail.leadDays })} />}
            </dl>
          </div>
        )}
      </Sheet>

      {/* Quick edit (owner) */}
      {editing && <EditSheet l={editing} s={s} onClose={() => setEditing(null)} onSave={(p) => void saveListing(editing, p)} />}

      {ownerView && <CatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} onPublished={() => void load()} />}
    </Frame>
  );
}

/** Owner sees their store inside the app shell (bottom nav); everyone else gets a plain column with a sticky CTA. */
function Frame({ owner, children }: { owner: boolean; children: ReactNode }) {
  if (owner) return <AppShell>{children}</AppShell>;
  return (
    <div className="min-h-dvh bg-page">
      <div className="relative mx-auto min-h-dvh w-full max-w-[480px] bg-page min-[481px]:shadow-[0_0_0_1px_var(--color-line)]">{children}</div>
    </div>
  );
}

const unitWord = (u: string, s: S) => (u === 'kg' ? s('kg') : u === 'dozen' ? s('dozen') : s('pc'));

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-4 py-3 text-[15px]">
      <dt className="w-[120px] shrink-0 text-meta">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{value}</dd>
    </div>
  );
}

function ReviewItem({ r, s, lang }: { r: Review; s: S; lang: string }) {
  return (
    <li className="rounded-[22px] border border-line bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint font-head text-[13px] font-semibold text-primary">{initials(r.rater)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{r.rater || s('buyer')}</span>
          {r.at && <span className="block text-[12px] text-meta">{fmtDate(r.at, lang)}</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-[14px] font-semibold tabular-nums text-ink">
          <Star size={15} className="text-accent" aria-hidden /> {avgOf(r.scores).toFixed(1)}
        </span>
      </div>
      {r.comment && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{r.comment}</p>}
    </li>
  );
}

function ProductArt({ l, big }: { l: Listing; big?: boolean }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center">
      {l.images[0] ? (
        <img src={l.images[0]} alt={l.title} className="size-full object-cover" loading="lazy" />
      ) : (
        <GarmentArt shape={l.art?.shape ?? 'tshirt'} color={l.art?.color ?? '#1F8C73'} pattern={l.art?.pattern} size={big ? 240 : 140} />
      )}
    </div>
  );
}

function ProductCard({ l, s, owner, onClick }: { l: Listing; s: S; owner: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface p-2 text-left transition-colors hover:border-line-strong active:bg-page">
      <div className="relative overflow-hidden rounded-[16px] bg-sunken">
        <ProductArt l={l} />
        {owner && (
          <span className="absolute right-2 top-2 inline-flex h-8 items-center gap-1 rounded-full bg-surface px-2.5 text-[12px] font-semibold text-ink">
            <Pencil size={13} aria-hidden /> {s('edit')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-2.5">
        <p className="line-clamp-2 text-[14px] font-medium leading-[1.4] text-ink">{l.title}</p>
        <p className="mt-auto pt-1.5 font-head text-[18px] font-bold tabular-nums text-ink">
          {inr(l.price)}
          <span className="text-[13px] font-normal text-meta">{s('per', { u: unitWord(l.unit, s) })}</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-meta">
          {l.moq != null && s('moq', { n: l.moq.toLocaleString('en-IN') })}
          {l.type !== 'service' && (
            <>
              {l.moq != null && ' · '}
              {l.stock ? <span className="font-medium text-success">{s('ready', { n: l.stock.toLocaleString('en-IN') })}</span> : s('made_to_order')}
            </>
          )}
        </p>
      </div>
    </button>
  );
}

function EditSheet({ l, s, onClose, onSave }: { l: Listing; s: S; onClose: () => void; onSave: (p: { price?: number; stock?: number; moq?: number }) => void }) {
  const [price, setPrice] = useState(l.price != null ? String(l.price) : '');
  const [stock, setStock] = useState(String(l.stock ?? 0));
  const [moq, setMoq] = useState(l.moq != null ? String(l.moq) : '');
  const digits = (v: string) => v.replace(/[^\d]/g, '');
  const priceN = Number(price);
  const valid = priceN > 0;
  const submit = () => {
    if (!valid) return;
    onSave({
      price: priceN,
      ...(l.type !== 'service' ? { stock: Number(stock || 0) } : {}),
      ...(moq ? { moq: Number(moq) } : {}),
    });
  };
  const field = 'mt-1.5 h-13 w-full rounded-[16px] border border-line bg-surface px-4 font-head text-[18px] font-bold tabular-nums text-ink outline-none focus:border-primary';
  return (
    <Sheet
      open
      onClose={onClose}
      title={l.title}
      footer={<Button block size="lg" disabled={!valid} onClick={submit}>{s('save')}</Button>}
    >
      <form className="space-y-4 pb-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="flex items-center gap-3">
          <span className="size-16 shrink-0 overflow-hidden rounded-[16px] bg-sunken">
            {l.images[0] ? <img src={l.images[0]} alt="" className="size-full object-cover" /> : <GarmentArt shape={l.art?.shape ?? 'tshirt'} color={l.art?.color ?? '#1F8C73'} pattern={l.art?.pattern} size={64} />}
          </span>
          <p className="min-w-0 flex-1 text-[14px] text-meta">{s('tap_edit')}</p>
        </div>
        <label className="block text-[14px] font-medium text-ink-2">
          {s('price', { u: unitWord(l.unit, s) })}
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 font-head text-[18px] font-bold text-meta">₹</span>
            <input autoFocus inputMode="numeric" value={price} onChange={(e) => setPrice(digits(e.target.value))} className={`${field} pl-9`} />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {l.type !== 'service' && (
            <label className="block text-[14px] font-medium text-ink-2">
              {s('stock')}
              <input inputMode="numeric" value={stock} onChange={(e) => setStock(digits(e.target.value))} className={field} />
            </label>
          )}
          <label className="block text-[14px] font-medium text-ink-2">
            {s('min_order')}
            <input inputMode="numeric" value={moq} onChange={(e) => setMoq(digits(e.target.value))} className={field} />
          </label>
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
