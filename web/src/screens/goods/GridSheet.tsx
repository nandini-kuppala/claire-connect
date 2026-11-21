// Size × colour grid (03 §6.2, slice 3): one style, a few colours, a quantity per size. Each filled cell becomes
// a content-addressed spec and a line; a saved style can add its trims (pieces × per piece × (1 + spare %)).
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Plus, X } from '../../icons';
import { useSession } from '../../store/session';
import { groupIndian } from '@shared/sc/units';
import { WorkS } from './Work.strings';
import type { MaterialType, ResolvedSpec, Spec } from './types';

export interface StyleTrim { spec_id: string; per_piece: number; unit: string; spare_pct: number; resolved: ResolvedSpec | null }
export interface Style { id: string; code: string; name: string | null; size_set: string[]; set_weight_g?: number | null; trims: StyleTrim[] }
export interface GridLine { spec: ResolvedSpec; qty: number; unit: string; lot: string }

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const cellCls = 'h-12 w-full rounded-[12px] border border-line-strong bg-surface px-1 text-center font-head text-[16px] font-bold tabular-nums outline-none focus:border-primary';

/** Trim quantity for a number of pieces: rounded up, never fractional. */
export const trimQty = (pieces: number, t: Pick<StyleTrim, 'per_piece' | 'spare_pct'>) => Math.ceil(pieces * t.per_piece * (1 + t.spare_pct / 100) - 1e-9);

export function GridSheet({ open, onClose, onAdd, noTrims = false }: { open: boolean; onClose: () => void; onAdd: (lines: GridLine[]) => void; noTrims?: boolean }) {
  const w = WorkS.use();
  const lang = useSession((st) => st.user?.language || 'en');
  const [types, setTypes] = useState<MaterialType[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [mt, setMt] = useState<MaterialType | null>(null);
  const [code, setCode] = useState('');
  const [sizes, setSizes] = useState<string[]>(DEFAULT_SIZES);
  const [extraSize, setExtraSize] = useState('');
  const [colours, setColours] = useState<{ name: string; lot: string; q: Record<string, string> }[]>([]);
  const [colourDraft, setColourDraft] = useState('');
  const [withTrims, setWithTrims] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.get<{ materials: MaterialType[] }>('/api/sc/templates').then((r) => {
      const sized = r.materials.filter((m) => m.base_dimension === 'count' && m.attributes.some((a) => a.key === 'size') && m.attributes.some((a) => a.key === 'style'));
      setTypes(sized);
      setMt((cur) => cur ?? sized[0] ?? null);
    }).catch(() => undefined);
    void api.get<{ styles: Style[] }>('/api/sc/styles').then((r) => setStyles(r.styles)).catch(() => undefined);
  }, [open]);

  const style = useMemo(() => styles.find((s) => s.code === code.trim().toUpperCase()) ?? null, [styles, code]);
  const unit = mt?.allowed_units.includes('pcs') ? 'pcs' : mt?.allowed_units[0] ?? 'pcs';
  const n = (v: string | undefined) => (Number(v) > 0 ? Math.floor(Number(v)) : 0);
  const rowTotal = (c: (typeof colours)[number]) => sizes.reduce((a, z) => a + n(c.q[z]), 0);
  const total = colours.reduce((a, c) => a + rowTotal(c), 0);
  const trims = style && withTrims && !noTrims && total > 0 ? style.trims.filter((t) => t.resolved) : [];

  const pickStyle = (s: Style) => {
    setCode(s.code);
    if (s.size_set.length) setSizes(s.size_set);
  };
  const addColour = () => {
    const name = colourDraft.trim().toLowerCase();
    if (!name || colours.some((c) => c.name === name) || colours.length >= 8) return;
    setColours((cs) => [...cs, { name, lot: '', q: {} }]);
    setColourDraft('');
  };
  const toggleSize = (z: string) => setSizes((zs) => (zs.includes(z) ? zs.filter((x) => x !== z) : [...zs, z]));
  const addSize = () => {
    const z = extraSize.trim().toUpperCase();
    if (z && !sizes.includes(z) && sizes.length < 12) setSizes((zs) => [...zs, z]);
    setExtraSize('');
  };

  const submit = async () => {
    if (!mt || !code.trim() || total === 0) return;
    setBusy(true);
    setError(null);
    try {
      const used = sizes.filter((z) => colours.some((c) => n(c.q[z]) > 0));
      const filled = colours.filter((c) => rowTotal(c) > 0);
      const r = await api.post<{ cells: Record<string, Record<string, Spec>>; dimension: ResolvedSpec['dimension']; units: string[]; class: string }>('/api/sc/specs/resolve-grid', {
        material_type_id: mt.id, base: { style: code.trim() }, colours: filled.map((c) => c.name), sizes: used,
      });
      const lines: GridLine[] = [];
      for (const c of filled)
        for (const z of used)
          if (n(c.q[z]) > 0) lines.push({ spec: { spec: r.cells[c.name][z], dimension: r.dimension, units: r.units, class: r.class }, qty: n(c.q[z]), unit, lot: c.lot.trim() });
      for (const t of trims) lines.push({ spec: t.resolved!, qty: trimQty(total, t), unit: t.unit, lot: '' });
      onAdd(lines);
      setColours([]);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const allSizes = [...new Set([...(style?.size_set ?? DEFAULT_SIZES), ...sizes])];

  return (
    <Sheet open={open} onClose={onClose} title={w('grid_title')}
      footer={<Button block size="lg" loading={busy} disabled={!mt || !code.trim() || total === 0} onClick={() => void submit()}>{total > 0 ? `${w('add_lines')} · ${groupIndian(total)} ${unit}` : w('add_lines')}</Button>}>
      <div className="space-y-4 pb-2">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{w('kind')}</p>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button key={t.id} onClick={() => setMt(t)} className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', mt?.id === t.id ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>{t.labels[lang] ?? t.labels.en}</button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{w('style')}</span>
          <input className="min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] uppercase outline-none focus:border-primary" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RKF-P22" />
        </label>
        {styles.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {styles.map((s) => (
              <button key={s.id} onClick={() => pickStyle(s)} className={clsx('min-h-10 rounded-full border px-3 text-[13px] font-semibold', style?.id === s.id ? 'border-primary text-primary' : 'border-line text-ink-2')}>{s.code}</button>
            ))}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{w('sizes')}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {allSizes.map((z) => (
              <button key={z} role="checkbox" aria-checked={sizes.includes(z)} onClick={() => toggleSize(z)} className={clsx('min-h-11 min-w-11 rounded-full border px-3 text-[14px] font-semibold', sizes.includes(z) ? 'border-primary bg-primary-tint text-primary' : 'border-line-strong bg-surface text-meta')}>{z}</button>
            ))}
            <input className="h-11 w-36 rounded-full border border-line-strong bg-surface px-3 text-[14px] uppercase placeholder:normal-case outline-none focus:border-primary" value={extraSize} placeholder={w('size_add')} aria-label={w('size_add')}
              onChange={(e) => setExtraSize(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSize()} onBlur={addSize} />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{w('colours')}</p>
          <div className="space-y-3">
            {colours.map((c, ci) => (
              <div key={c.name} className="rounded-[16px] border border-line bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold capitalize text-ink">{c.name}</span>
                  <input className="h-10 w-28 rounded-[12px] border border-line-strong px-2.5 text-[14px] outline-none focus:border-primary" placeholder="lot" aria-label={`${c.name} lot`} value={c.lot}
                    onChange={(e) => setColours((cs) => cs.map((x, j) => (j === ci ? { ...x, lot: e.target.value } : x)))} />
                  <span className="ml-auto text-[13px] tabular-nums text-ink-2">{w('total')} {groupIndian(rowTotal(c))}</span>
                  <button className="flex size-10 items-center justify-center rounded-full text-meta hover:bg-sunken" aria-label={`Remove ${c.name}`} onClick={() => setColours((cs) => cs.filter((_, j) => j !== ci))}><X size={16} /></button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
                  {sizes.map((z) => (
                    <label key={z} className="block text-center">
                      <span className="mb-0.5 block text-[12px] font-semibold text-meta">{z}</span>
                      <input className={cellCls} inputMode="numeric" aria-label={`${c.name} ${z}`} value={c.q[z] ?? ''}
                        onChange={(e) => setColours((cs) => cs.map((x, j) => (j === ci ? { ...x, q: { ...x.q, [z]: e.target.value.replace(/\D/g, '').slice(0, 6) } } : x)))} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input className="min-h-12 flex-1 rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary" value={colourDraft} placeholder="navy" aria-label={w('add_colour')}
                onChange={(e) => setColourDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addColour()} />
              <Button variant="secondary" icon={Plus} disabled={!colourDraft.trim()} onClick={addColour}>{w('add_colour')}</Button>
            </div>
          </div>
        </div>

        {style && style.trims.length > 0 && !noTrims && (
          <div className="rounded-[16px] bg-sunken p-3">
            <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
              <input type="checkbox" className="size-5" checked={withTrims} onChange={(e) => setWithTrims(e.target.checked)} />
              {w('with_trims')}
            </label>
            {trims.length > 0 && (
              <ul className="mt-1 space-y-1 pl-8 text-[14px] text-ink-2">
                {trims.map((t) => (
                  <li key={t.spec_id} className="flex justify-between gap-3">
                    <span>{t.resolved!.spec.label_en}</span>
                    <span className="font-semibold tabular-nums text-ink">{groupIndian(trimQty(total, t))} {t.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Sizes that would mix two lots (shade may differ), from the lines on a form. */
export function lotMixSizes(lines: { spec: ResolvedSpec | null; lot: string }[]): string[] {
  const lots = new Map<string, Set<string>>();
  for (const l of lines) {
    if (!l.spec || !l.lot.trim()) continue;
    const a = l.spec.spec.attrs ?? {};
    if (a.size == null) continue;
    const k = `${a.style ?? ''}|${a.colour ?? ''}|${a.size}`;
    if (!lots.has(k)) lots.set(k, new Set());
    lots.get(k)!.add(l.lot.trim().toUpperCase());
  }
  return [...new Set([...lots].filter(([, v]) => v.size > 1).map(([k]) => k.split('|')[2]))];
}
