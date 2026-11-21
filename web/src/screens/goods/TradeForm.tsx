// Record → Sell · Return to supplier · Give/lend a sample · Buy · Buyer returned · Collect · Move (slice 4.5).
// Outgoing records pick from my stock (one place at a time); incoming ones name the material.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { api, ApiError, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, ChevronRight, Package, Plus, Trash2 } from '../../icons';
import { todayIST } from '@shared/sc/dates';
import { TradeS } from './Trade.strings';
import { RecS } from './Record.strings';
import { JobS } from './Job.strings';
import { PartyPicker } from './PartyPicker';
import { SpecPicker } from './SpecPicker';
import { clientId, qty as fmtQty } from './format';
import type { Party, Place, ResolvedSpec, Spec } from './types';

type Kind = 'sell' | 'return_to_supplier' | 'sample' | 'returnable_sample' | 'buy' | 'buyer_returned' | 'collect' | 'move';
type Grade = 'A' | 'B' | 'rework' | 'reject';
interface StockRow { id: string; spec: Spec | null; dimension: 'mass' | 'count' | 'length'; units: string[]; class: string; lot: string | null; grade: Grade; state: string; place_id: string | null; place: string | null; qty: number; with: { party: { k: 'b' | 'c'; id: string }; name: string } | null }
interface Line { spec: ResolvedSpec | null; holding: StockRow | null; qty: string; unit: string; lot: string; grade: Grade; theySent: string }
const OUT: Kind[] = ['sell', 'return_to_supplier', 'sample', 'returnable_sample', 'move', 'collect'];
const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';
const empty = (): Line => ({ spec: null, holding: null, qty: '', unit: '', lot: '', grade: 'A', theySent: '' });
const holderKey = (r: StockRow) => (r.with ? `${r.with.party.k}:${r.with.party.id}` : `me:${r.place_id ?? ''}`);

export default function TradeForm() {
  const t = TradeS.use();
  const r = RecS.use();
  const jb = JobS.use();
  const nav = useNavigate();
  const kind = (useParams().kind ?? 'sell') as Kind;
  const [party, setParty] = useState<Party | null>(null);
  const [pickParty, setPickParty] = useState(false);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [stockOpen, setStockOpen] = useState(false);
  const [specFor, setSpecFor] = useState<number | null>(null);
  const [inPlace, setInPlace] = useState(false);
  const [toPlace, setToPlace] = useState<string>('');
  const [until, setUntil] = useState('');
  const [rate, setRate] = useState('');
  const [dc, setDc] = useState('');
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [short, setShort] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cid, setCid] = useState(clientId);
  const outgoing = OUT.includes(kind);

  useEffect(() => {
    void api.get<{ rows: StockRow[] }>('/api/sc/stock').then((x) => setStock(x.rows)).catch(() => undefined);
    void api.get<{ places: Place[] }>('/api/sc/places').then((x) => setPlaces(x.places)).catch(() => undefined);
    void api.get<{ role: 'owner' | 'staff' }>('/api/sc/home').then((h) => setRole(h.role)).catch(() => undefined);
    setLines(outgoing ? [] : [empty()]);
  }, [kind, outgoing]);

  // What can be picked: collect → my goods with that party; move → at my unit; others → my unit or my goods with others.
  const choices = useMemo(() => stock.filter((x) => x.spec && (kind === 'collect' ? !!party && x.with?.party.id === party.ref.id : kind === 'move' ? !x.with : true)), [stock, kind, party]);
  const holder = lines.find((l) => l.holding)?.holding ?? null;
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const needsParty = kind !== 'move';
  const ready = (!needsParty || !!party) && lines.length > 0 && lines.every((l) => (l.spec || l.holding) && Number(l.qty) > 0 && l.unit) && (kind !== 'move' || !!toPlace);

  const save = async (untracked?: string) => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        kind, client_id: cid, business_date: todayIST(),
        ...(party ? { party: party.ref } : {}),
        ...(holder?.with ? { from_party: holder.with.party } : {}),
        ...(holder && !holder.with && holder.place_id ? { from_place_id: holder.place_id } : {}),
        ...(toPlace ? { to_place_id: toPlace } : {}),
        ...(inPlace ? { in_place: true } : {}),
        ...(kind === 'returnable_sample' && until ? { returnable_until: until } : {}),
        ...(dc.trim() ? { dc_no: dc.trim() } : {}),
        ...(role === 'owner' && Number(rate) > 0 ? { rate_paise: Math.round(Number(rate) * 100) } : {}),
        ...(untracked ? { allow_untracked: true, untracked_reason: untracked } : {}),
        lines: lines.map((l) => ({
          spec_id: (l.holding?.spec?.id ?? l.spec!.spec.id), qty: Number(l.qty), unit: l.unit, grade: l.holding?.grade ?? l.grade,
          ...(l.holding ? { holding_id: l.holding.id, lot: l.holding.lot ?? undefined } : { lot: l.lot.trim() || undefined }),
          ...(Number(l.theySent) > 0 ? { they_sent: Number(l.theySent) } : {}),
        })),
      };
      const res = await api.post<{ movement: { id: string }; undo_until: number | null }>('/api/sc/movements/trade', body);
      nav(res.undo_until ? `/goods?saved=${res.movement.id}&until=${res.undo_until}` : '/goods', { replace: true });
    } catch (e) {
      const b = (e as ApiError).body as { code?: string; lines?: { available: number; needed: number; dim: string }[] } | undefined;
      if (e instanceof ApiError && b?.code === 'negative' && b.lines?.length) setShort(jb('from_stock_short', { have: fmtQty(b.lines[0].available, b.lines[0].dim), need: fmtQty(b.lines[0].needed, b.lines[0].dim) }));
      else if (e instanceof ApiError && b?.code === 'they_record') setError(t('they_record', { name: party?.name ?? '' }));
      else setError(errorText(e));
      setCid(clientId());
    } finally {
      setBusy(false);
    }
  };

  const partyLabel = kind === 'sell' ? t('to_buyer') : kind === 'return_to_supplier' ? t('to_supplier') : kind === 'buy' ? t('from_supplier') : kind === 'buyer_returned' ? t('from_buyer') : kind === 'collect' ? t('from_whom') : t('to_whom');
  const where = (x: StockRow) => (x.with ? t('with_name', { name: x.with.name }) : x.place ?? t('at_unit'));

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="font-head text-[20px] font-bold text-ink">{t(`t_${kind}` as 't_sell')}</h1>
      </header>

      <div className="space-y-5 px-4 pt-4">
        {needsParty && (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{partyLabel}</span>
            <button className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-line-strong bg-surface px-3.5 text-left" onClick={() => setPickParty(true)}>
              <span className={clsx('min-w-0 flex-1 text-[16px]', party ? 'font-semibold text-ink' : 'text-meta')}>{party?.name ?? r('pick_party')}</span>
              <ChevronRight size={18} className="text-meta" aria-hidden />
            </button>
          </div>
        )}

        {(kind === 'buy' || kind === 'sell') && (
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
            <input type="checkbox" className="size-5" checked={inPlace} onChange={(e) => setInPlace(e.target.checked)} />
            {kind === 'buy' ? t('kept_at_seller') : t('kept_for_buyer')}
          </label>
        )}

        <section>
          <h2 className="mb-2 font-head text-[17px] font-semibold text-ink">{r('what')}</h2>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="rounded-[18px] border border-line bg-surface p-3.5">
                <div className="flex items-start gap-2">
                  {l.holding ? (
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">{l.holding.spec?.label_en}{l.holding.grade !== 'A' ? ` · ${jb(`g_${l.holding.grade}` as 'g_A')}` : ''}</p>
                      <p className="text-[13px] text-meta">{[l.holding.lot, where(l.holding), t('have', { qty: fmtQty(l.holding.qty, l.holding.dimension) })].filter(Boolean).join(' · ')}</p>
                    </div>
                  ) : (
                    <button className="min-h-12 flex-1 rounded-[14px] bg-sunken px-3 text-left text-[15px] font-semibold text-ink" onClick={() => setSpecFor(i)}>
                      {l.spec?.spec.label_en ?? <span className="font-normal text-meta">{r('material')} · {r('pick')}</span>}
                    </button>
                  )}
                  <button className="flex size-12 shrink-0 items-center justify-center rounded-full text-meta hover:bg-sunken" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
                </div>
                {(l.spec || l.holding) && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="w-28">
                      <span className="mb-1 block text-[13px] font-semibold text-ink-2">{r('qty')}</span>
                      <input className={inputCls + ' text-right font-head font-bold tabular-nums'} inputMode="decimal" value={l.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
                    </label>
                    <div className="flex flex-wrap gap-1.5 pb-0.5">
                      {(l.holding?.units ?? l.spec?.units ?? []).filter((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)).map((u) => (
                        <button key={u} onClick={() => set(i, { unit: u })} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', l.unit === u ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{u}</button>
                      ))}
                    </div>
                    {!l.holding && (
                      <>
                        <label className="w-32"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{r('lot')}</span><input className={inputCls} value={l.lot} onChange={(e) => set(i, { lot: e.target.value })} /></label>
                        <div className="flex w-full flex-wrap gap-1.5" role="radiogroup" aria-label={t('grade')}>
                          {(['A', 'B', 'rework', 'reject'] as Grade[]).map((g) => (
                            <button key={g} role="radio" aria-checked={l.grade === g} onClick={() => set(i, { grade: g })} className={clsx('min-h-10 rounded-full border px-3 text-[13.5px] font-semibold', l.grade === g ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{jb(`g_${g}` as 'g_A')}</button>
                          ))}
                        </div>
                      </>
                    )}
                    {kind === 'buy' && !inPlace && (
                      <label className="w-40"><span className="mb-1 block text-[13px] font-semibold text-ink-2">{t('they_say')} <span className="font-normal text-meta">{t('they_say_hint')}</span></span><input className={inputCls + ' tabular-nums'} inputMode="decimal" value={l.theySent} onChange={(e) => set(i, { theySent: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {outgoing && <Button variant="ghost" icon={Package} onClick={() => setStockOpen(true)}>{t('pick_stock')}</Button>}
              {!outgoing && <Button variant="ghost" icon={Plus} onClick={() => setLines((ls) => [...ls, empty()])}>{r('material')}</Button>}
              {outgoing && kind !== 'collect' && kind !== 'move' && role === 'owner' && <Button variant="ghost" icon={Plus} onClick={() => { setLines((ls) => [...ls, empty()]); setSpecFor(lines.length); }}>{t('other_material')}</Button>}
            </div>
          </div>
        </section>

        {(kind === 'move' || kind === 'buy' || kind === 'buyer_returned' || kind === 'collect') && !inPlace && places.length > 0 && (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{t('to_place')}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {places.filter((p) => kind !== 'move' || p.id !== holder?.place_id).map((p) => (
                <button key={p.id} role="radio" aria-checked={toPlace === p.id} onClick={() => setToPlace(p.id)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', toPlace === p.id ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{p.name}</button>
              ))}
            </div>
          </div>
        )}

        {kind === 'returnable_sample' && (
          <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{t('return_by')}</span><input type="date" className={inputCls} min={todayIST()} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        )}
        {kind !== 'move' && !inPlace && (
          <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{r('dc')}</span><input className={inputCls} value={dc} onChange={(e) => setDc(e.target.value)} /></label>
        )}
        {role === 'owner' && (kind === 'sell' || kind === 'buy') && (
          <label className="block">
            <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold text-ink-2"><span>{t('rate')}</span><span className="font-normal text-meta">{t('rate_hint')}</span></span>
            <span className="flex items-center gap-2"><span className="text-[16px] font-semibold text-ink-2">₹</span><input className={inputCls + ' w-32 tabular-nums'} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} /><span className="text-[14px] text-meta">{r('per', { unit: lines[0]?.unit || 'kg' })}</span></span>
          </label>
        )}

        {short && (
          <div className="rounded-[16px] bg-accent-tint p-3.5">
            <p className="text-[15px] font-semibold text-accent-ink">{short}</p>
            {role === 'owner' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input className={inputCls + ' flex-1'} placeholder={r('reason_ph')} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={jb('reason')} />
                <Button disabled={reason.trim().length < 3} loading={busy} onClick={() => void save(reason.trim())}>{jb('record_anyway')}</Button>
              </div>
            ) : <p className="mt-1 text-[14px] text-ink-2">{r('owner_only_override')}</p>}
          </div>
        )}
        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface px-4 py-3 pb-[calc(12px+var(--safe-bottom))]">
        <Button block size="lg" loading={busy} disabled={!ready} onClick={() => void save()}>{r('save')}</Button>
      </div>

      <PartyPicker open={pickParty} onClose={() => setPickParty(false)} onPick={(p) => { setParty(p); if (kind === 'collect') setLines([]); }} />
      <SpecPicker open={specFor !== null} onClose={() => setSpecFor(null)} onPick={(x) => { if (specFor === null) return; setLines((ls) => { const n = [...ls]; while (n.length <= specFor) n.push(empty()); n[specFor] = { ...n[specFor], spec: x, unit: x.units[0] ?? '' }; return n; }); }} />
      <Sheet open={stockOpen} onClose={() => setStockOpen(false)} title={t('pick_stock')}>
        <div className="pb-2">
          {choices.length === 0 ? <p className="text-[14.5px] text-ink-2">{t('nothing')}</p> : (
            <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
              {choices.map((x) => {
                const taken = lines.some((l) => l.holding?.id === x.id);
                const other = !!holder && holderKey(holder) !== holderKey(x);
                return (
                  <li key={x.id}>
                    <button disabled={taken} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken disabled:opacity-50"
                      onClick={() => {
                        if (other) { setError(t('one_holder')); setStockOpen(false); return; }
                        setLines((ls) => [...ls.filter((l) => l.spec || l.holding), { ...empty(), holding: x, unit: x.units.find((u) => !['rolls', 'cones', 'bundles', 'bags', 'boxes'].includes(u)) ?? '' }]);
                        setStockOpen(false);
                      }}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{x.spec?.label_en}{x.grade !== 'A' ? ` · ${jb(`g_${x.grade}` as 'g_A')}` : ''}</span>
                        <span className="block text-[13px] text-meta">{[x.lot, where(x)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="shrink-0 font-head font-bold tabular-nums text-ink">{fmtQty(x.qty, x.dimension)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  );
}
