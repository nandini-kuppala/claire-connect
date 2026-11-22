// S18: "What work does your unit do?" — a one-time card on the Goods home for owners (also asked in onboarding).
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { OrderGoodsS } from './OrderGoods.strings';

export function WorkCard() {
  const t = OrderGoodsS.use();
  const [keys, setKeys] = useState<string[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    void api.get<{ work: unknown; keys: string[] }>('/api/sc/profile/work').then((r) => { if (!r.work) setKeys(r.keys); }).catch(() => undefined);
  }, []);
  if (!keys || done) return null;
  const save = async (skipped: boolean) => {
    setBusy(true); setError(null);
    try { await api.post('/api/sc/profile/work', { processes: skipped ? [] : sel, skipped }); setDone(true); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <section className="mx-4 mt-4 rounded-[18px] border border-line bg-surface px-4 py-4">
      <h2 className="font-head text-[17px] font-semibold text-ink">{t('work_q')}</h2>
      <p className="mt-1 text-[13.5px] text-ink-2">{t('work_hint')}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <button key={k} aria-pressed={sel.includes(k)} onClick={() => toggle(k)}
            className={clsx('min-h-10 rounded-full border px-3 text-[14px] font-semibold', sel.includes(k) ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{t(`w_${k}` as 'w_dyeing')}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button loading={busy} disabled={!sel.length} onClick={() => void save(false)}>{t('save')}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>{t('skip')}</Button>
      </div>
    </section>
  );
}
