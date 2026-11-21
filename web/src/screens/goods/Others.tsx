// In my unit → Others' goods (03 S10/S11): goods this unit holds for principals, grouped by whom it works for, never
// mixed with its own. Bulk actions per principal; on desktop a keyboard-first table to record returns in one go (U2).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { ChevronRight } from '../../icons';
import { useSession } from '../../store/session';
import { WorkS } from './Work.strings';
import { RecS } from './Record.strings';
import { Status, type Late } from './Status';
import { clientId, qty as fmtQty, shortDate } from './format';

export interface WorkRow {
  id: string; client: { k: string; id: string }; process_key: string; status: string; since: string; expected_at: string; late: Late; dim: string;
  received: number; receivedBasis: string; outputs: number; ownOutputs: number; returned: number; forwarded: number; outputsHere: number; inputsHere: number;
  ready: boolean; held: string | null; inputLabel: string; parentJobId: string | null; instructions: { id: string; to: { k: string; id: string }; to_name?: string; process_key: string }[];
}
interface Group { client: { k: string; id: string }; name: string; jobs: WorkRow[] }
interface ReadyLine { spec_id: string; grade: string; dim: string; qty: number; label: string }

const unitOf = (dim: string) => (dim === 'mass' ? 'kg' : dim === 'length' ? 'm' : 'pcs');
const toUnit = (base: number, dim: string) => (dim === 'mass' ? base / 1000 : dim === 'length' ? base / 100 : base);

/** Sends back everything done and not yet returned for one job. Returns false if nothing was ready. */
export async function returnReady(jobId: string): Promise<boolean> {
  const r = await api.get<{ lines: ReadyLine[] }>(`/api/sc/jobs/${jobId}/ready-lines`);
  if (!r.lines.length) return false;
  await api.post(`/api/sc/jobs/${jobId}/send-back`, { client_id: clientId(), lines: r.lines.map((l) => ({ spec_id: l.spec_id, grade: l.grade, qty: toUnit(l.qty, l.dim), unit: unitOf(l.dim) })) });
  return true;
}

export function Others({ onCount }: { onCount?: (n: number) => void }) {
  const w = WorkS.use();
  const r = RecS.use();
  const nav = useNavigate();
  const lang = useSession((st) => st.user?.language || 'en');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [returns, setReturns] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const d = await api.get<{ groups: Group[] }>('/api/sc/goods/others');
    setGroups(d.groups);
    onCount?.(d.groups.reduce((n, g) => n + g.jobs.length, 0));
  }, [onCount]);
  useEffect(() => void load().catch((e) => setMsg(errorText(e))), [load]);

  const bulk = async (g: Group, kind: 'ready' | 'return') => {
    setBusy(`${kind}:${g.client.id}`);
    setMsg(null);
    try {
      let any = false;
      for (const j of g.jobs) {
        if (kind === 'ready' && !j.ready) { await api.post(`/api/sc/jobs/${j.id}/ready`, { ready: true }); any = true; }
        if (kind === 'return' && j.outputsHere > 0) any = (await returnReady(j.id)) || any;
      }
      setMsg(any ? w('saved') : w('nothing_ready'));
      await load();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  // Desktop: one quantity per row, saved together. Applies to the first finished material not yet sent back.
  const saveReturns = async () => {
    setBusy('desk');
    setMsg(null);
    try {
      for (const [jobId, v] of Object.entries(returns)) {
        const n = Number(v);
        if (!(n > 0)) continue;
        const rl = await api.get<{ lines: ReadyLine[] }>(`/api/sc/jobs/${jobId}/ready-lines`);
        const first = rl.lines[0];
        if (!first) continue;
        await api.post(`/api/sc/jobs/${jobId}/send-back`, { client_id: clientId(), lines: [{ spec_id: first.spec_id, grade: first.grade, qty: n, unit: unitOf(first.dim) }] });
      }
      setReturns({});
      setMsg(w('saved'));
      await load();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!groups) return <div className="mx-4 mt-4 h-24 animate-pulse rounded-[18px] bg-sunken" />;
  if (!groups.length) return <p className="mx-4 mt-5 text-[15px] text-ink-2">{w('no_others')}</p>;

  const status = (j: WorkRow) =>
    j.held ? <span className="inline-flex rounded-full bg-accent-tint px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink">{w('held')}</span>
    : j.ready ? <span className="inline-flex rounded-full bg-primary-tint px-2.5 py-1 text-[12.5px] font-semibold text-primary">{w('ready')}</span>
    : <Status late={j.late} />;

  return (
    <div className="mt-2">
      {msg && <p className="mx-4 mt-3 rounded-[14px] bg-sunken px-3 py-2 text-[14px] text-ink-2">{msg}</p>}
      {groups.map((g) => (
        <section key={g.client.id} className="mx-4 mt-5 lg:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-[17px] font-semibold text-ink">{w('for_name', { name: g.name })}</h2>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" loading={busy === `ready:${g.client.id}`} onClick={() => void bulk(g, 'ready')}>{w('mark_all_ready')}</Button>
              <Button size="sm" variant="tint" loading={busy === `return:${g.client.id}`} onClick={() => void bulk(g, 'return')}>{w('return_ready')}</Button>
            </div>
          </div>
          {/* Phone: one row per job */}
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface lg:hidden">
            {g.jobs.map((j) => (
              <li key={j.id}>
                <button className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-sunken" onClick={() => nav(`/goods/work/${j.id}`)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-semibold text-ink">{j.inputLabel}</span>
                    <span className="mt-1 block">{status(j)}</span>
                    <span className="mt-1.5 block text-[14.5px] text-ink">
                      <span className="font-head font-bold tabular-nums">{fmtQty(j.received, j.dim)}</span> {w('received').toLowerCase()}
                      {j.receivedBasis === 'their_record' && <span className="text-meta"> ({w('their_record')})</span>}
                    </span>
                    <span className="block text-[13px] text-meta">
                      {[j.outputs ? `${w('done')} ${fmtQty(j.outputs, j.dim)}` : null, j.returned ? `${w('sent_back')} ${fmtQty(j.returned, j.dim)}` : null, j.forwarded ? `${w('forwarded')} ${fmtQty(j.forwarded, j.dim)}` : null, r('since', { date: shortDate(j.since, lang) })].filter(Boolean).join(' · ')}
                    </span>
                    {j.instructions.length > 0 && <span className="mt-1 block text-[13px] font-semibold text-primary">{w('send_on', { to: j.instructions[0].to_name ?? '' })}</span>}
                  </span>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-meta" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {/* Desktop: table with a return quantity per row (keyboard-first) */}
          <div className="mt-2 hidden overflow-hidden rounded-[18px] border border-line bg-surface lg:block">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-line-strong text-left text-[12px] font-semibold text-meta">
                  <th className="px-3 py-2.5">{r('what')}</th><th className="px-3 py-2.5 text-right">{w('received')}</th><th className="px-3 py-2.5 text-right">{w('done')}</th>
                  <th className="px-3 py-2.5 text-right">{w('sent_back')}</th><th className="px-3 py-2.5 text-right">{w('here_done')}</th><th className="px-3 py-2.5">{r('expected_on', { date: '' }).trim()}</th>
                  <th className="px-3 py-2.5" /><th className="px-3 py-2.5 text-right">{w('return_qty')}</th>
                </tr>
              </thead>
              <tbody>
                {g.jobs.map((j) => (
                  <tr key={j.id} className="border-b border-line last:border-0 hover:bg-sunken/60">
                    <td className="px-3 py-2.5"><button className="text-left font-semibold text-ink hover:underline" onClick={() => nav(`/goods/work/${j.id}`)}>{j.inputLabel}</button><div className="text-[12.5px] text-meta">{r('since', { date: shortDate(j.since, lang) })}</div></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(j.received, j.dim)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(j.outputs, j.dim)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(j.returned, j.dim)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmtQty(j.outputsHere, j.dim)}</td>
                    <td className="px-3 py-2.5">{shortDate(j.expected_at, lang)}</td>
                    <td className="px-3 py-2.5">{status(j)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input className={clsx('h-10 w-24 rounded-[12px] border border-line-strong bg-surface px-2 text-right tabular-nums outline-none focus:border-primary', !j.outputsHere && 'opacity-50')}
                        disabled={!j.outputsHere} inputMode="decimal" value={returns[j.id] ?? ''} onChange={(e) => setReturns((x) => ({ ...x, [j.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                        onKeyDown={(e) => e.key === 'Enter' && void saveReturns()} aria-label={`${w('return_qty')} ${j.inputLabel}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <div className="mx-4 mt-3 hidden items-center gap-3 lg:mx-0 lg:flex">
        <Button loading={busy === 'desk'} disabled={!Object.values(returns).some((v) => Number(v) > 0)} onClick={() => void saveReturns()}>{w('save_returns')}</Button>
        <span className="text-[13px] text-meta">{w('desk_hint')}</span>
      </div>
    </div>
  );
}
