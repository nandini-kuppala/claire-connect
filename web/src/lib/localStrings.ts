// Co-located string tables for a screen or component, so features can add en/ta/hi copy
// without editing the shared src/i18n.ts. Usage:
//   const S = defineStrings({ en: { hi: 'Hi {name}' }, ta: { hi: 'வணக்கம் {name}' }, hi: { hi: 'नमस्ते {name}' } });
//   const s = S.use(); s('hi', { name })
import { useCallback } from 'react';
import { useSession } from '../store/session';

type Table<K extends string> = Record<K, string>;

export function defineStrings<K extends string>(tables: { en: Table<K>; ta?: Partial<Table<K>>; hi?: Partial<Table<K>> }) {
  const get = (lang: string, key: K, vars?: Record<string, string | number>) => {
    const tbl = (tables as Record<string, Partial<Table<K>> | undefined>)[lang];
    let out = tbl?.[key] ?? tables.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
  return {
    get,
    use() {
      const lang = useSession((st) => st.user?.language || 'en');
      return useCallback((key: K, vars?: Record<string, string | number>) => get(lang, key, vars), [lang]);
    },
  };
}
