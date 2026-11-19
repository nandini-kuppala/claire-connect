// Language picker: big native-script rows. Saves to the profile and switches the UI at once.
// English, Tamil and Hindi have full screens; the others are chat languages (Claire translates).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LANGS } from '@shared/taxonomy';
import { ArrowLeft, Check, Loader2 } from '../icons';
import { api, errorText } from '../lib/api';
import { translate, useT } from '../i18n';
import { isOnboarded, useSession } from '../store/session';
import { BrandMark } from '../components/Avatar';
import { LanguageStrings } from './Language.strings';

const FULL_UI = new Set(['en', 'hi', 'ta']);

export default function Language() {
  const navigate = useNavigate();
  const t = useT();
  const s = LanguageStrings.use();
  const user = useSession((st) => st.user);
  const setUser = useSession((st) => st.setUser);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = user?.language ?? 'en';
  const onboarding = !isOnboarded(user);

  async function choose(code: string) {
    setSaving(code);
    setError(null);
    try {
      await api.patch('/api/me', { language: code });
      setUser({ language: code });
      if (onboarding) navigate('/onboarding', { replace: true });
      else if (window.history.length > 1) navigate(-1);
      else navigate('/', { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(null);
    }
  }

  const full = LANGS.filter((l) => FULL_UI.has(l.code));
  const chatOnly = LANGS.filter((l) => !FULL_UI.has(l.code));

  const mark = (code: string, active: boolean, size: 'lg' | 'sm') =>
    saving === code ? (
      <Loader2 size={size === 'lg' ? 22 : 18} className="shrink-0 animate-spin text-primary" aria-hidden />
    ) : active ? (
      <span className={clsx('flex shrink-0 items-center justify-center rounded-full bg-primary text-white', size === 'lg' ? 'size-7' : 'size-6')}>
        <Check size={size === 'lg' ? 16 : 14} aria-hidden />
      </span>
    ) : (
      <span className={clsx('shrink-0 rounded-full border-2 border-line-strong', size === 'lg' ? 'size-7' : 'size-6')} aria-hidden />
    );

  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(12px+var(--safe-top))] pb-[calc(28px+var(--safe-bottom))] min-[481px]:shadow-[0_0_0_1px_var(--color-line)]">
        <div className="flex min-h-[52px] items-center gap-2.5">
          {onboarding ? (
            <>
              <BrandMark size={36} />
              <span className="font-head text-[18px] font-bold tracking-tight text-ink">
                CLAIRE <span className="text-brand">Connect</span>
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="-ml-1 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken"
              aria-label={t('back')}
            >
              <ArrowLeft size={22} />
            </button>
          )}
        </div>

        <h1 className="mt-5 font-head text-[28px] leading-tight font-bold text-ink">{t('choose_language')}</h1>
        {/* Show the prompt in Tamil and Hindi too: the user may not read English. */}
        <p className="mt-1.5 text-[16px] leading-relaxed text-ink-2">
          {(['en', 'ta', 'hi'] as const)
            .filter((l) => l !== current)
            .map((l) => translate(l, 'choose_language'))
            .join(' · ')}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-meta">{t('language_sub')}</p>

        <div role="radiogroup" aria-label={t('choose_language')} className="mt-6">
          <h2 className="px-1 text-[13px] font-semibold text-meta">{s('full_app')}</h2>
          <div className="mt-2 flex flex-col gap-2.5">
            {full.map((l) => {
              const active = l.code === current;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  lang={l.code}
                  disabled={!!saving}
                  onClick={() => void choose(l.code)}
                  className={clsx(
                    'flex min-h-[76px] items-center gap-4 rounded-[22px] border-2 px-5 text-left transition-colors disabled:opacity-70',
                    active ? 'border-primary bg-primary-tint' : 'border-line bg-surface hover:border-line-strong hover:bg-sunken/50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-head text-[24px] leading-tight font-bold text-ink">{l.native}</span>
                    {l.native !== l.english && <span className="mt-0.5 block text-[13px] text-meta" lang="en">{l.english}</span>}
                  </span>
                  {mark(l.code, active, 'lg')}
                </button>
              );
            })}
          </div>

          <h2 className="mt-7 px-1 text-[13px] font-semibold text-meta">{s('chat_too')}</h2>
          <p className="mt-0.5 px-1 text-[12.5px] leading-snug text-faint">{s('chat_too_sub')}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {chatOnly.map((l) => {
              const active = l.code === current;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  lang={l.code}
                  disabled={!!saving}
                  onClick={() => void choose(l.code)}
                  className={clsx(
                    'flex min-h-[64px] items-center gap-2 rounded-[18px] border-2 px-4 text-left transition-colors disabled:opacity-70',
                    active ? 'border-primary bg-primary-tint' : 'border-line bg-surface hover:border-line-strong hover:bg-sunken/50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-head text-[19px] leading-tight font-semibold text-ink">{l.native}</span>
                    <span className="block truncate text-[12px] text-meta" lang="en">{l.english}</span>
                  </span>
                  {mark(l.code, active, 'sm')}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
