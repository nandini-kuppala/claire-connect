// Goods home notices for slice 6: link requests to approve (recorder), "businesses have records with your number"
// (a business that just joined), and "I returned some" from statement links (recorder). Each hides when empty.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { LinkS } from './Link.strings';
import { qty as fmtQty } from './format';

interface Req { contact_id: string; contact_name: string; business: { id: string; name: string; sub: string } }
interface Prop { id: string; job_id: string; name: string; qty: number; dim: string; label: string }

export function LinkBanners({ owner, onChange }: { owner: boolean; onChange?: () => void }) {
  const s = LinkS.use();
  const nav = useNavigate();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [sugg, setSugg] = useState<{ count: number; pending: number } | null>(null);
  const [props, setProps] = useState<Prop[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, g, p] = await Promise.all([
      api.get<{ requests: Req[] }>('/api/sc/linking/requests').catch(() => ({ requests: [] })),
      api.get<{ count: number; pending: number }>('/api/sc/linking/suggestions').catch(() => null),
      api.get<{ proposals: Prop[] }>('/api/sc/links/proposals').catch(() => ({ proposals: [] })),
    ]);
    setReqs(r.requests);
    setSugg(g);
    setProps(p.proposals);
  }, []);
  useEffect(() => void load(), [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) setMsg(done);
      await load();
      onChange?.();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!owner) return null;
  const box = 'mx-4 mt-3 rounded-[16px] border border-line bg-surface px-4 py-3';
  return (
    <>
      {msg && <p role="status" className="mx-4 mt-3 rounded-[14px] bg-success-tint px-3 py-2 text-[14px] text-success">{msg}</p>}
      {reqs.map((r) => (
        <div key={r.contact_id} className={box}>
          <p className="text-[15px] font-semibold text-ink">{s('asks_link', { biz: r.business.name, contact: r.contact_name })}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{[r.business.sub, s('asks_hint')].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === r.contact_id} onClick={() => void act(r.contact_id, () => api.post(`/api/sc/linking/${r.contact_id}/approve`), s('approved', { biz: r.business.name }))}>{s('approve')}</Button>
            <Button size="sm" variant="ghost" onClick={() => void act(`d${r.contact_id}`, () => api.post(`/api/sc/linking/${r.contact_id}/decline`))}>{s('decline')}</Button>
          </div>
        </div>
      ))}
      {sugg && sugg.count > 0 && (
        <div className={box}>
          <p className="text-[15px] font-semibold text-ink">{s('suggest', { n: sugg.count })}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{s('suggest_hint')}</p>
          <Button size="sm" className="mt-2" loading={busy === 'ask'} onClick={() => void act('ask', () => api.post('/api/sc/linking/request'), s('asked'))}>{s('ask')}</Button>
        </div>
      )}
      {props.map((p) => (
        <div key={p.id} className={box}>
          <p className="text-[15px] font-semibold text-ink">{s('returned_some', { name: p.name, qty: `${fmtQty(p.qty, p.dim)} ${p.label}` })}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{s('returned_hint')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === p.id} onClick={() => void act(p.id, async () => {
              try {
                await api.post(`/api/sc/links/proposals/${p.id}/accept`);
              } catch (e) {
                // Nothing came back on this job before: say what came back in the Got back form.
                if (e instanceof ApiError && (e.body as { code?: string })?.code === 'pick') { nav(`/goods/job/${p.job_id}/return`); return; }
                throw e;
              }
            })}>{s('accept')}</Button>
            <Button size="sm" variant="ghost" onClick={() => void act(`d${p.id}`, () => api.post(`/api/sc/links/proposals/${p.id}/decline`))}>{s('decline')}</Button>
          </div>
        </div>
      ))}
    </>
  );
}
