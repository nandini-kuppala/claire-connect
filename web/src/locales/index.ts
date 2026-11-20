// Overlay locales: one JSON file per language, shaped { "<namespace>": { "<key>": "<text>" } }.
// en.json is GENERATED from the inline English tables (npm run i18n:extract); never edit it by hand.
// te/kn/ml/bn/or/mr/gu.json are filled by translators (see docs/TRANSLATING.md).
//
// Lookup order used by every string table in the app:
//   inline table for the language (existing ta / hi) → overlay JSON for the language → inline English → key.
//
// The JSON files are loaded lazily (one small chunk per language, fetched only when that language is
// used), so the main bundle stays light. Hooks re-render through `useLocaleVersion` once a file arrives.
import { useEffect } from 'react';
import { create } from 'zustand';

export type LocaleTable = Record<string, Record<string, string>>;

/** Languages whose screens come from overlay JSON (Tamil and Hindi live in the inline tables). */
export const OVERLAY_LANGS = ['te', 'kn', 'ml', 'bn', 'or', 'mr', 'gu'] as const;

const loaders = import.meta.glob<LocaleTable>('./*.json', { import: 'default' });
const loaded: Record<string, LocaleTable> = {};
const pending = new Map<string, Promise<void>>();
const useLocaleStore = create<{ version: number }>(() => ({ version: 0 }));

/** Starts (or reuses) the download of a language's overlay file. Resolves when it is usable. */
export function ensureLocale(lang: string | null | undefined): Promise<void> {
  if (!lang || loaded[lang]) return Promise.resolve();
  const existing = pending.get(lang);
  if (existing) return existing;
  const loader = loaders[`./${lang}.json`];
  if (!loader) return Promise.resolve();
  const p = loader()
    .then((table) => {
      loaded[lang] = table && typeof table === 'object' ? table : {};
      useLocaleStore.setState((s) => ({ version: s.version + 1 }));
    })
    .catch((err) => {
      console.warn(`[i18n] could not load ${lang}.json`, err);
      pending.delete(lang); // allow a retry on the next lookup
    });
  pending.set(lang, p);
  return p;
}

/**
 * Overlay text for `lang` / `ns` / `key`, or undefined when the language file has no (non-empty) entry
 * or has not arrived yet (the lookup then kicks off the download).
 */
export function localeString(lang: string, ns: string, key: string): string | undefined {
  const table = loaded[lang];
  if (!table) {
    void ensureLocale(lang);
    return undefined;
  }
  const v = table[ns]?.[key];
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/** Subscribe a component to overlay loads; returns a number that changes whenever a file arrives. */
export function useLocaleVersion(lang: string | null | undefined): number {
  const version = useLocaleStore((s) => s.version);
  useEffect(() => {
    void ensureLocale(lang);
  }, [lang]);
  return version;
}

// Warm the cache with the language of the last session (read before the session store hydrates),
// so a returning Telugu user does not see English for a moment on reload.
try {
  const cached = JSON.parse(localStorage.getItem('cc_session') || 'null') as { user?: { language?: string } } | null;
  const lang = cached?.user?.language || localStorage.getItem('cc_login_lang');
  if (lang && (OVERLAY_LANGS as readonly string[]).includes(lang)) void ensureLocale(lang);
} catch {
  /* private mode / no storage */
}
