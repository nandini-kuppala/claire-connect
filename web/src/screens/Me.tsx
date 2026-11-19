// Profile tab: business header, trust score explained simply, badges, settings (language, auto-reply, store, help, log out).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Globe, Headset, LogOut, Star, Store } from '../icons';
import { api } from '../lib/api';
import { roleText, useT } from '../i18n';
import { useSession } from '../store/session';
import { Avatar, ClaireMark } from '../components/Avatar';
import { TrustBadge } from '../components/TrustBadge';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { badgeLabel, strings } from '../cards/strings';
import { LANGS } from '../../../shared/taxonomy';
import { ErrorBar, Spinner, TrustBreakdown, errMsg, listOf, normBiz, normTrust, patchSession, useMe, type Biz, type Trust } from '../desk/kit';
import { MeS } from './Me.strings';

type AutoMode = 'off' | 'suggest' | 'auto';
type S = ReturnType<typeof MeS.use>;

export default function Me() {
  const s = MeS.use();
  const t = useT();
  const nav = useNavigate();
  const { user, lang } = useMe();
  const logout = useSession((st: any) => st.logout) as (() => void) | undefined;
  const [biz, setBiz] = useState<Biz | null>(null);
  const [trust, setTrust] = useState<Trust | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'lang' | 'auto' | 'help' | null>(null);
  const [autoMode, setAutoMode] = useState<AutoMode>('suggest');
  const [savingAuto, setSavingAuto] = useState(false);
  const [helping, setHelping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = (await api.get('/api/me')) as any;
      const b = normBiz(me.business);
      setBiz(b);
      setTrust(normTrust(me.trust) ?? b?.trust ?? null);
      if (b?.autoReply === 'off' || b?.autoReply === 'suggest' || b?.autoReply === 'auto') setAutoMode(b.autoReply);
      const autoUser = me.user?.auto_reply ?? me.user?.autoReply;
      if (autoUser === 'off' || autoUser === 'suggest' || autoUser === 'auto') setAutoMode(autoUser);
      if (b) {
        const ls = await api.get(`/api/listings?business=${encodeURIComponent(b.id)}&all=1`);
        setProductCount(listOf(ls, 'listings').length);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 1600);
  }

  async function setLanguage(code: string) {
    setSheet(null);
    const prev = lang;
    patchSession({ user: { language: code } });
    try {
      await api.patch('/api/me', { language: code });
    } catch (e) {
      patchSession({ user: { language: prev } });
      setError(errMsg(e));
    }
  }

  async function setAuto(mode: AutoMode) {
    if (mode === autoMode) return;
    const prev = autoMode;
    setAutoMode(mode);
    setSavingAuto(true);
    try {
      await api.patch('/api/me', { autoReply: mode });
      flash(s('saved'));
    } catch (e) {
      setAutoMode(prev);
      setError(errMsg(e));
    } finally {
      setSavingAuto(false);
    }
  }

  async function askTradeDesk() {
    setHelping(true);
    try {
      // Same path as Claire's "talk to a person" chip: Claire opens a Trade Desk ticket and the agent joins the Claire chat.
      await api.post('/api/claire/turn', { chipId: 'home:human' });
      setSheet(null);
      nav('/chat/claire');
    } catch (e) {
      setError(errMsg(e));
      setSheet(null);
    } finally {
      setHelping(false);
    }
  }

  const currentLang = LANGS.find((l) => l.code === lang);
  const autoLabel = autoMode === 'off' ? s('ar_off') : autoMode === 'suggest' ? s('ar_suggest') : s('ar_auto');
  const name = biz?.name ?? user?.name ?? '—';
  const roleLine = [roleText(t, biz?.role), biz?.city].filter(Boolean).join(' · ');

  if (loading)
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );

  return (
    <div className="pb-6">
      <header className="px-4 pb-2 pt-[max(18px,var(--safe-top))]">
        <h1 className="font-head text-[28px] font-bold leading-tight text-ink">{s('title')}</h1>
      </header>
      {error && <ErrorBar message={error} onRetry={load} retryLabel={s('retry')} />}

      {/* Profile header */}
      <section className="mx-4 mt-2 flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4">
        <Avatar name={name} accent={biz?.accent} size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-head text-[20px] font-bold leading-tight text-ink">{name}</p>
          {roleLine && <p className="mt-0.5 text-[14px] text-meta">{roleLine}</p>}
          {(trust || user?.phone) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {trust && <TrustBadge trust={trust.isNew ? { isNew: true } : trust.score} size="md" />}
              {user?.phone && <span className="text-[13px] tabular-nums text-meta">+91 {user.phone}</span>}
            </div>
          )}
        </div>
      </section>

      {/* Trust explained */}
      {trust && <TrustCard trust={trust} s={s} lang={lang} />}

      {/* Settings */}
      <h2 className="mx-5 mt-6 mb-2 font-head text-[17px] font-semibold text-ink">{s('settings')}</h2>
      <Group>
        <Row icon={<IconTile tone="primary"><Globe size={19} /></IconTile>} label={s('language')} value={currentLang?.native ?? lang} onClick={() => setSheet('lang')} />
        <Row icon={<ClaireMark size={38} />} label={s('auto_reply')} value={autoLabel} onClick={() => setSheet('auto')} />
      </Group>

      {biz && (
        <Group>
          <Row
            icon={<IconTile tone="accent"><Store size={19} /></IconTile>}
            label={s('my_store')}
            sub={productCount ? s('n_products', { n: productCount }) : s('no_products')}
            onClick={() => nav(`/store/${biz.id}`)}
          />
        </Group>
      )}

      <Group>
        <Row icon={<IconTile tone="clay"><Headset size={19} /></IconTile>} label={s('help')} sub={s('help_sub')} onClick={() => setSheet('help')} />
        <Row
          icon={<IconTile tone="danger"><LogOut size={19} /></IconTile>}
          label={s('logout')}
          danger
          onClick={() => { nav('/login', { replace: true, state: null }); logout?.(); }}
        />
      </Group>

      {notice && (
        <div className="fixed inset-x-0 bottom-[calc(92px+var(--safe-bottom))] z-40 mx-auto w-fit rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-surface shadow-[var(--shadow-float)]" role="status">
          {notice}
        </div>
      )}

      {/* Language */}
      <Sheet open={sheet === 'lang'} onClose={() => setSheet(null)} title={s('language')}>
        <div className="grid grid-cols-2 gap-2 pb-2">
          {LANGS.map((l) => {
            const on = l.code === lang;
            return (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                aria-pressed={on}
                className={`flex min-h-16 items-center gap-2 rounded-[18px] border px-4 text-left transition-colors ${on ? 'border-primary bg-primary-tint' : 'border-line bg-surface hover:bg-sunken'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold text-ink">{l.native}</span>
                  <span className="block text-[12px] text-meta">{l.english}</span>
                </span>
                {on && <Check size={18} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* Auto-reply */}
      <Sheet open={sheet === 'auto'} onClose={() => setSheet(null)} title={s('auto_reply')}>
        <div className="space-y-2 pb-2" role="radiogroup" aria-label={s('auto_reply')}>
          {(['off', 'suggest', 'auto'] as AutoMode[]).map((m) => {
            const on = autoMode === m;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={on}
                onClick={() => void setAuto(m)}
                disabled={savingAuto}
                className={`flex w-full items-start gap-3 rounded-[18px] border p-4 text-left transition-colors ${on ? 'border-primary bg-primary-tint' : 'border-line bg-surface hover:bg-sunken'}`}
              >
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-primary bg-primary' : 'border-line-strong'}`}>
                  {on && <span className="size-2 rounded-full bg-surface" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink">{m === 'off' ? s('ar_off') : m === 'suggest' ? s('ar_suggest') : s('ar_auto')}</span>
                  <span className="mt-0.5 block text-[14px] leading-[1.45] text-ink-2">{m === 'off' ? s('ar_off_sub') : m === 'suggest' ? s('ar_suggest_sub') : s('ar_auto_sub')}</span>
                </span>
                {on && savingAuto && <Spinner size={16} />}
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* Help */}
      <Sheet
        open={sheet === 'help'}
        onClose={() => setSheet(null)}
        title={s('help')}
        footer={
          <Button block size="lg" icon={Headset} loading={helping} onClick={() => void askTradeDesk()}>
            {s('help_cta')}
          </Button>
        }
      >
        <p className="pb-2 text-[15px] leading-relaxed text-ink-2">{s('help_body')}</p>
      </Sheet>
    </div>
  );
}

function TrustCard({ trust, s, lang }: { trust: Trust; s: S; lang: string }) {
  const c = trust.components;
  const tips: string[] = [];
  if (c.verification < 12) tips.push(s('tip_gst'));
  if (c.verification < 20) tips.push(s('tip_visit'));
  if (c.responsiveness < 8) tips.push(s('tip_reply'));
  if (c.reliability < 20) tips.push(s('tip_reliable'));

  const facts: { value: ReactNode; label: string }[] = [];
  if (trust.ratingAvg != null)
    facts.push({
      value: (
        <span className="inline-flex items-center gap-1">
          <Star size={16} className="text-accent" /> {Number(trust.ratingAvg).toFixed(1)}
        </span>
      ),
      label: s('ratings_n', { n: trust.ratingCount }),
    });
  if (trust.paysOnTime) facts.push({ value: trust.paysOnTime, label: s('pays_on_time') });
  if (trust.onTimePct != null) facts.push({ value: `${trust.onTimePct}%`, label: s('on_time') });
  if (facts.length < 3 && trust.repeatBuyers > 0) facts.push({ value: trust.repeatBuyers, label: s('repeat') });

  const labels = {
    verification: { label: s('t_verification'), tip: s('t_verification_tip') },
    ratings: { label: s('t_ratings'), tip: s('t_ratings_tip') },
    reliability: { label: s('t_reliability'), tip: s('t_reliability_tip') },
    responsiveness: { label: s('t_responsiveness'), tip: s('t_responsiveness_tip') },
    disputes: { label: s('t_disputes'), tip: s('t_disputes_tip') },
  };

  return (
    <section className="mx-4 mt-3 rounded-[22px] border border-line bg-surface p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-head text-[17px] font-semibold text-ink">{s('trust_title')}</h2>
          <p className="mt-0.5 text-[14px] leading-[1.45] text-meta">{trust.isNew ? s('trust_new') : s('trust_sub')}</p>
        </div>
        <p className="shrink-0 font-head text-[34px] font-bold leading-none tabular-nums text-plum">
          {Math.round(trust.score)}
          <span className="text-[15px] font-semibold text-meta">/100</span>
        </p>
      </div>

      <div className="mt-4">
        <TrustBreakdown trust={trust} labels={labels} />
      </div>

      {facts.length > 0 && (
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(3, facts.length)}, minmax(0, 1fr))` }}>
          {facts.slice(0, 3).map((f, i) => (
            <div key={i} className="rounded-[16px] bg-page px-3 py-2.5">
              <p className="font-head text-[17px] font-bold tabular-nums text-ink">{f.value}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-meta">{f.label}</p>
            </div>
          ))}
        </div>
      )}
      {trust.ratingAvg == null && !trust.isNew && <p className="mt-3 text-[13px] text-meta">{s('no_ratings')}</p>}

      {trust.badges.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-ink-2">{s('badges')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trust.badges.map((b) => (
              <span key={b} className="inline-flex h-8 items-center gap-1 rounded-full bg-success-tint px-3 text-[13px] font-semibold text-success">
                <Check size={14} aria-hidden /> {badgeLabel(b, strings(lang))}
              </span>
            ))}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <div className="mt-4 rounded-[18px] bg-accent-tint px-4 py-3">
          <p className="text-[13px] font-semibold text-accent-ink">{s('raise')}</p>
          <ul className="mt-1 space-y-0.5 text-[14px] leading-[1.45] text-ink-2">
            {tips.slice(0, 2).map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="mx-4 mt-3 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">{children}</div>;
}

function IconTile({ tone, children }: { tone: 'primary' | 'accent' | 'clay' | 'danger'; children: ReactNode }) {
  const cls = {
    primary: 'bg-primary-tint text-primary',
    accent: 'bg-accent-tint text-accent-ink',
    clay: 'bg-clay-tint text-clay',
    danger: 'bg-danger-tint text-danger',
  }[tone];
  return <span className={`flex size-[38px] shrink-0 items-center justify-center rounded-[12px] ${cls}`}>{children}</span>;
}

function Row({ icon, label, sub, value, danger, onClick }: { icon: ReactNode; label: string; sub?: string; value?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-page active:bg-sunken" onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-medium ${danger ? 'text-danger' : 'text-ink'}`}>{label}</span>
        {sub && <span className="block text-[13px] leading-snug text-meta">{sub}</span>}
      </span>
      {value && <span className="shrink-0 text-[14px] text-meta">{value}</span>}
      {!danger && <ChevronRight size={18} className="shrink-0 text-faint" aria-hidden />}
    </button>
  );
}
