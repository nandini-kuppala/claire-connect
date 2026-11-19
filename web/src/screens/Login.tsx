// Phone + OTP sign-in with one-tap demo accounts.
// Signed-out visitors pick the login copy's language on the pill (en / ta / hi), kept in localStorage.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronDown, ChevronRight, Eye, Handshake, Headset, Loader2, Search, ShieldCheck, Truck } from '../icons';
import { api, errorText } from '../lib/api';
import { langNative } from '../lib/format';
import { translate } from '../i18n';
import { isAgent, isOnboarded, useSession, type SessionPayload, type SessionUser } from '../store/session';
import { Avatar, BrandMark, ClaireBot } from '../components/Avatar';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { LoginStrings as S, type LoginKey } from './Login.strings';

const DEMO_OTP = '123456';
const LANG_KEY = 'cc_login_lang';
const DEMO_OPEN_KEY = 'cc_login_demo_open';
const LOGIN_LANGS = ['en', 'ta', 'hi'] as const;
type LoginLang = (typeof LOGIN_LANGS)[number];

interface DemoAccount {
  phone: string;
  name: string | null;
  language: string;
  role: string;
  label?: string;
  business?: { id: string; name: string; city?: string; roleLabel?: string; accent?: string } | null;
}

type VerifyResponse = Required<Pick<SessionPayload, 'token' | 'user' | 'chat'>> & SessionPayload & { isNew?: boolean };

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function initialLang(): LoginLang {
  const saved = readStored(LANG_KEY);
  if (saved && (LOGIN_LANGS as readonly string[]).includes(saved)) return saved as LoginLang;
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
  return nav.startsWith('ta') ? 'ta' : nav.startsWith('hi') ? 'hi' : 'en';
}

/** "Stitching unit" → the role label in the chosen language; unknown labels pass through. */
function roleIn(lang: string, label?: string | null) {
  if (!label) return '';
  const key = `role_${label.trim().toLowerCase().replace(/[^a-z]+/g, '_')}`;
  const v = translate(lang, key);
  return v === key ? label : v;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);
  const setSession = useSession((s) => s.setSession);
  const setUser = useSession((s) => s.setUser);

  const [lang, setLang] = useState<LoginLang>(initialLang);
  const [langPicked, setLangPicked] = useState(() => !!readStored(LANG_KEY));
  const [langOpen, setLangOpen] = useState(false);
  const s = (key: LoginKey) => S.get(lang, key);
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoAccount[] | null>(null);
  const [demoOpen, setDemoOpen] = useState(() => readStored(DEMO_OPEN_KEY) === '1');
  const otpRef = useRef<HTMLInputElement>(null);
  const demoRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api
      .get<{ accounts?: DemoAccount[] } | DemoAccount[]>('/api/demo-accounts')
      .then((r) => setDemo(Array.isArray(r) ? r : (r?.accounts ?? [])))
      .catch(() => setDemo([]));
  }, []);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // `?next=` (storefront "chat with seller", desk sign-in) wins over the page the last session was on.
  // A return path only applies when it suits this user: agents go to the desk, traders never do.
  const next = new URLSearchParams(location.search).get('next');
  const from = next || (location.state as { from?: string } | null)?.from;
  const returnTo = (u: SessionUser) => {
    if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/login')) return null;
    if (isAgent(u)) return from.startsWith('/desk') ? from : null;
    return from.startsWith('/desk') || from === '/me' ? null : from;
  };
  const destination = (u: SessionUser) => (isAgent(u) ? returnTo(u) ?? '/desk' : !isOnboarded(u) ? '/language' : returnTo(u) ?? '/');

  if (token && user) return <Navigate to={destination(user)} replace />;

  const digits = phone.replace(/\D/g, '').slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(digits);

  function pickLang(l: LoginLang) {
    setLang(l);
    setLangPicked(true);
    writeStored(LANG_KEY, l);
    setLangOpen(false);
  }

  function revealDemo() {
    setDemoOpen(true);
    writeStored(DEMO_OPEN_KEY, '1');
    window.setTimeout(() => demoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function requestOtp(e?: FormEvent) {
    e?.preventDefault();
    if (!phoneValid) return setError(s('phone_invalid'));
    setBusy('otp');
    setError(null);
    try {
      await api.post('/api/auth/otp', { phone: digits });
      setStep('otp');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function verify(p = digits, code = otp, key = 'verify') {
    setBusy(key);
    setError(null);
    try {
      const r = await api.post<VerifyResponse>('/api/auth/verify', { phone: p, otp: code });
      setSession({ token: r.token, user: r.user, business: r.business ?? null, chat: r.chat, trust: r.trust ?? null, features: r.features });
      // A brand-new trader who chose a language on this screen starts in it (they still confirm on /language).
      if (langPicked && !isAgent(r.user) && !isOnboarded(r.user) && r.user.language !== lang) {
        try {
          await api.patch('/api/me', { language: lang });
          setUser({ language: lang });
        } catch {
          /* the language screen lets them pick again */
        }
      }
      navigate(destination(r.user), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function demoLogin(a: DemoAccount) {
    setPhone(a.phone);
    setBusy(a.phone);
    try {
      await api.post('/api/auth/otp', { phone: a.phone });
    } catch {
      /* the verify call reports any real problem */
    }
    await verify(a.phone, DEMO_OTP, a.phone);
  }

  const traders = demo?.filter((a) => a.role !== 'agent') ?? [];
  const agents = demo?.filter((a) => a.role === 'agent') ?? [];

  const demoRow = (a: DemoAccount) => (
    <li key={a.phone}>
      <button
        type="button"
        onClick={() => void demoLogin(a)}
        disabled={!!busy}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sunken/60 disabled:opacity-60"
      >
        <Avatar name={a.business?.name ?? a.name} accent={a.business?.accent} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">{a.business?.name ?? a.name ?? a.phone}</span>
          <span className="block truncate text-[13px] text-meta">
            {[...new Set([roleIn(lang, a.label ?? a.business?.roleLabel ?? a.role), a.business?.city, langNative(a.language)].filter(Boolean))].join(' · ')}
          </span>
        </span>
        {busy === a.phone ? <Loader2 size={18} className="animate-spin text-primary" /> : <ChevronRight size={18} className="text-meta" aria-hidden />}
      </button>
    </li>
  );

  return (
    <div className="min-h-dvh bg-page" lang={lang}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(16px+var(--safe-top))] pb-[calc(28px+var(--safe-bottom))] min-[481px]:shadow-[0_0_0_1px_var(--color-line)]">
        {/* Brand row */}
        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BrandMark size={40} />
            <span className="font-head text-[19px] font-bold tracking-tight text-ink">
              CLAIRE <span className="text-brand">Connect</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            aria-label={s('language')}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-3 pl-3.5 text-[15px] font-medium text-ink transition-colors hover:bg-sunken"
          >
            <span lang={lang}>{langNative(lang)}</span>
            <ChevronDown size={16} className="text-meta" aria-hidden />
          </button>
        </div>

        {/* Headline */}
        <div className="mt-8 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-head text-[27px] leading-[1.18] font-bold text-ink">{s('headline')}</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{s('sub')}</p>
          </div>
          <ClaireBot size={92} className="-mr-1 shrink-0" />
        </div>

        {/* Value props */}
        <ul className="mt-6 grid grid-cols-3 divide-x divide-line rounded-[22px] border border-line bg-surface py-4">
          {(
            [
              { icon: Search, key: 'vp_find', tone: 'bg-primary-tint text-primary' },
              { icon: Handshake, key: 'vp_negotiate', tone: 'bg-accent-tint text-accent-ink' },
              { icon: Truck, key: 'vp_orders', tone: 'bg-clay-tint text-clay' },
            ] as const
          ).map(({ icon: Icon, key, tone }) => (
            <li key={key} className="flex flex-col items-center gap-2 px-2 text-center">
              <span className={clsx('flex size-11 items-center justify-center rounded-[14px]', tone)}>
                <Icon size={22} aria-hidden />
              </span>
              <span className="text-[13px] leading-snug font-medium text-ink-2">{s(key)}</span>
            </li>
          ))}
        </ul>

        {/* Phone / OTP card */}
        <section className="mt-5 rounded-[22px] border border-line bg-surface p-4 pt-5">
          {step === 'phone' ? (
            <form onSubmit={requestOtp} noValidate>
              <label htmlFor="phone" className="font-head text-[17px] font-semibold text-ink">
                {s('continue_phone')}
              </label>
              <div className="mt-3 flex min-h-[56px] items-center rounded-[16px] border border-line-strong bg-surface px-4 transition-colors focus-within:border-primary">
                <span className="flex items-center gap-2 border-r border-line pr-3 text-[16px] font-semibold text-ink-2">
                  <IndiaFlag />
                  +91
                </span>
                <input
                  id="phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="90000 00001"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12));
                    if (error) setError(null);
                  }}
                  className="ml-3 h-12 min-w-0 flex-1 bg-transparent text-[18px] tracking-wide text-ink outline-none placeholder:text-faint"
                />
                {phoneValid && <Check size={18} className="text-success" aria-hidden />}
              </div>
              <Button type="submit" size="lg" block className="mt-3" disabled={!phoneValid || !!busy} loading={busy === 'otp'}>
                <span className="inline-flex items-center gap-2">
                  {s('send_otp')}
                  {busy !== 'otp' && <ArrowRight size={18} aria-hidden />}
                </span>
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <h2 className="font-head text-[17px] font-semibold text-ink">{s('otp_title')}</h2>
              <label htmlFor="otp" className="mt-1 block text-[14px] text-meta">
                {t('otp_label', { phone: `+91 ${digits}` })}
              </label>
              <input
                id="otp"
                ref={otpRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(v);
                  if (v.length === 6) void verify(digits, v);
                }}
                className="mt-3 h-[60px] w-full rounded-[16px] border border-line-strong bg-surface text-center font-head text-[28px] tracking-[0.5em] text-ink tabular-nums outline-none focus:border-primary"
                placeholder="••••••"
              />
              <p className="mt-2.5 flex items-center gap-2 rounded-[14px] bg-accent-tint px-3 py-2 text-[13px] text-accent-ink">
                <ShieldCheck size={16} aria-hidden /> {t('otp_hint', { code: DEMO_OTP })}
              </p>
              <Button type="submit" size="lg" block className="mt-3" disabled={otp.length !== 6 || !!busy} loading={busy === 'verify'}>
                {t('verify')}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError(null);
                }}
                className="mt-1 min-h-[44px] w-full rounded-full text-[14px] font-semibold text-primary hover:bg-primary-tint"
              >
                {t('change_number')}
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">
              {error}
            </p>
          )}

          {/* Divider + demo entry */}
          <div className="my-4 flex items-center gap-3 text-[13px] text-meta" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            {s('or')}
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={() => (demoOpen ? demoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : revealDemo())}
            aria-expanded={demoOpen}
            aria-controls="demo-list"
            className="flex min-h-[68px] w-full items-center gap-3 rounded-[18px] bg-primary-tint px-3.5 py-3 text-left transition-colors hover:bg-primary-soft"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
              <Eye size={22} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-head text-[16px] leading-snug font-semibold text-ink">{s('explore')}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{s('explore_sub')}</span>
            </span>
            <ChevronRight size={20} className={clsx('shrink-0 text-primary transition-transform', demoOpen && 'rotate-90')} aria-hidden />
          </button>
        </section>

        {/* Demo accounts */}
        {demoOpen && (
          <section id="demo-list" ref={demoRef} className="mt-6 animate-fade-up scroll-mt-4" aria-labelledby="demo-h">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
              <h2 id="demo-h" className="font-head text-[18px] font-semibold text-ink">
                {s('demo_title')}
              </h2>
              <p className="text-[13px] text-meta">{s('demo_hint')}</p>
            </div>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
              {demo === null &&
                [0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="shimmer-block size-11 rounded-full" />
                    <span className="shimmer-block h-4 flex-1 rounded-full" />
                  </li>
                ))}
              {traders.map(demoRow)}
              {demo?.length === 0 && <li className="px-4 py-4 text-[14px] text-meta">—</li>}
            </ul>

            {agents.length > 0 && (
              <>
                <div className="mt-5 flex items-center gap-2.5 px-1">
                  <span className="flex size-8 items-center justify-center rounded-full bg-clay-tint text-clay">
                    <Headset size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-head text-[15px] font-semibold text-ink">{s('desk_team')}</h3>
                    <p className="text-[12.5px] text-meta">{s('desk_team_sub')}</p>
                  </div>
                </div>
                <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">{agents.map(demoRow)}</ul>
              </>
            )}
          </section>
        )}
      </div>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={s('language')} subtitle={s('login_lang_sub')}>
        <div className="flex flex-col gap-2 pb-2" role="radiogroup" aria-label={s('language')}>
          {LOGIN_LANGS.map((l) => {
            const active = l === lang;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                lang={l}
                onClick={() => pickLang(l)}
                className={clsx(
                  'flex min-h-[60px] items-center gap-3 rounded-[18px] border px-4 text-left transition-colors',
                  active ? 'border-primary bg-primary-tint' : 'border-line bg-surface hover:bg-sunken',
                )}
              >
                <span className="flex-1 font-head text-[20px] font-semibold text-ink">{langNative(l)}</span>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
                    <Check size={14} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

/** Flat brand motif: a marigold thread running through a needle eye. */
function ThreadLine({ className }: { className?: string }) {
  return (
    <svg className={className} width="132" height="14" viewBox="0 0 132 14" fill="none" aria-hidden>
      <path d="M2 8c10-6 18 4 28 0s18-6 28 0 18 4 28 0 16-5 24-2" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="122" cy="7" rx="7" ry="3.2" stroke="var(--color-primary)" strokeWidth="2" />
    </svg>
  );
}

/** Tiny flat tricolour for the +91 prefix. */
function IndiaFlag() {
  return (
    <svg width="22" height="15" viewBox="0 0 22 15" aria-hidden className="shrink-0 overflow-hidden rounded-[4px]">
      <rect width="22" height="5" fill="#E58A33" />
      <rect y="5" width="22" height="5" fill="#FFFFFF" />
      <rect y="10" width="22" height="5" fill="#2F7A47" />
      <circle cx="11" cy="7.5" r="1.7" fill="none" stroke="#3C4247" strokeWidth="0.7" />
    </svg>
  );
}
