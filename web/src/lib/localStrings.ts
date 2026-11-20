// Co-located string tables for a screen or component, so features can add copy without editing the
// shared src/i18n.ts. Each table has a namespace: the key under which its strings live in the overlay
// JSON files (src/locales/<lang>.json) that carry te, kn, ml, bn, or, mr and gu. Usage:
//   const S = defineStrings('home', { en: { hi: 'Hi {name}' }, ta: { hi: 'வணக்கம் {name}' }, hi: { hi: 'नमस्ते {name}' } });
//   const s = S.use(); s('hi', { name })
// Lookup: inline table for the language (en / ta / hi) → overlay JSON for the language → English → key.
// After adding or changing English here, run `npm run i18n:extract` so en.json follows.
import { useCallback } from 'react';
import { useSession } from '../store/session';
import { localeString, useLocaleVersion } from '../locales';

type Table<K extends string> = Record<K, string>;

/** Optional inline tables. Usually only ta / hi; a small self-contained namespace (e.g. 'call') may carry
 *  all ten inline, and then `npm run i18n:check` counts those languages as translated for it. */
type InlineLang = 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'or' | 'mr' | 'gu';

export function defineStrings<K extends string>(
  namespace: string,
  tables: { en: Table<K> } & { [L in InlineLang]?: Partial<Table<K>> },
) {
  const get = (lang: string, key: K, vars?: Record<string, string | number>) => {
    const tbl = (tables as Record<string, Partial<Table<K>> | undefined>)[lang];
    let out = tbl?.[key] ?? localeString(lang, namespace, key) ?? tables.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
  return {
    namespace,
    get,
    use() {
      const lang = useSession((st) => st.user?.language || 'en');
      const version = useLocaleVersion(lang);
      return useCallback((key: K, vars?: Record<string, string | number>) => get(lang, key, vars), [lang, version]);
    },
  };
}
