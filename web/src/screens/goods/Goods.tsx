// Goods tab (docs/supply-chain/03-product-ux.md S1 / S10 / S1c). Slice 0: the tab, its segments and the first-run guide.
// Lists fill in from slice 1 onwards. Lazy-loaded so it adds nothing to the first load.
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { Settings } from '../../icons';
import { SetupS } from './Setup.strings';
import { GoodsS } from './Goods.strings';

type Tab = 'out' | 'in' | 'coming';
interface Home {
  chips: { late: number; toConfirm: number; disputes: number };
}

const TAB_KEY = 'cc_goods_tab';
const readTab = (): Tab => {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return t === 'in' || t === 'coming' ? t : 'out';
  } catch {
    return 'out';
  }
};

export default function Goods() {
  const s = GoodsS.use();
  const ss = SetupS.use();
  const nav = useNavigate();
  const [tab, setTabState] = useState<Tab>(readTab);
  const [home, setHome] = useState<Home | null>(null);
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* per-viewer convenience only */
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      const [h, g] = await Promise.all([api.get<Home>('/api/sc/home'), api.get<{ rows: unknown[] }>(`/api/sc/goods?tab=${tab}`)]);
      setHome(h);
      setRows(g.rows);
    } catch (e) {
      setError(errorText(e));
      setRows([]);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = home?.chips;
  const empty = { out: ['empty_out', 'empty_out_hint'], in: ['empty_in', 'empty_in_hint'], coming: ['empty_coming', 'empty_coming_hint'] } as const;

  return (
    <div className="pb-6">
      <header className="px-4 pb-1 pt-[max(18px,var(--safe-top))]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-head text-[28px] font-bold leading-tight text-ink">{s('title')}</h1>
          <button className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-sunken" onClick={() => nav('/goods/setup')}>
            <Settings size={18} aria-hidden />
            {ss('open')}
          </button>
        </div>

        {chips && (chips.late > 0 || chips.toConfirm > 0 || chips.disputes > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.late > 0 && <span className="rounded-full bg-danger-tint px-3 py-1.5 text-[14px] font-semibold text-danger">{s('chip_late', { n: chips.late })}</span>}
            {chips.toConfirm > 0 && <span className="rounded-full bg-accent-tint px-3 py-1.5 text-[14px] font-semibold text-accent-ink">{s('chip_confirm', { n: chips.toConfirm })}</span>}
            {chips.disputes > 0 && <span className="rounded-full bg-danger-tint px-3 py-1.5 text-[14px] font-semibold text-danger">{s('chip_dispute', { n: chips.disputes })}</span>}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-sunken p-1" role="tablist">
          {(['out', 'in', 'coming'] as Tab[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={clsx(
                'flex min-h-11 items-center justify-center rounded-full px-2 py-1 text-center text-[14px] font-semibold leading-tight transition-colors',
                tab === k ? 'bg-surface text-primary shadow-[0_0_0_1px_var(--color-line)]' : 'text-ink-2',
              )}
            >
              {s(`tab_${k}` as 'tab_out')}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 rounded-[16px] bg-danger-tint px-4 py-3 text-[14px] text-danger">
          {s('error')}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void load()}>
            {s('retry')}
          </Button>
        </div>
      )}

      {rows === null ? (
        <div className="mx-4 mt-4 space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-[18px] bg-sunken" />
          ))}
        </div>
      ) : rows.length === 0 && !error ? (
        <section className="mx-4 mt-5">
          <p className="font-head text-[18px] font-semibold text-ink">{s(empty[tab][0])}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s(empty[tab][1])}</p>

          <div className="mt-6 rounded-[18px] border border-line bg-surface px-4 py-4">
            <h2 className="font-head text-[16px] font-semibold text-ink">{s('guide_title')}</h2>
            <ol className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-2">
              {(['guide_1', 'guide_2', 'guide_3'] as const).map((k, i) => (
                <li key={k} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[13px] font-semibold text-ink-2 tabular-nums">{i + 1}</span>
                  <span>{s(k)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-meta">{s('soon')}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
