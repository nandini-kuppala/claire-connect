// Material (spec) picker sheet: your names and recent materials first, then "New material" → kind → details.
// Specs are content-addressed on the server, so the same fabric typed twice is one material (model §3.2).
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { ChevronLeft, ChevronRight, Plus, Search } from '../../icons';
import { useSession } from '../../store/session';
import { SetupS } from './Setup.strings';
import type { MaterialType, ResolvedSpec, Spec } from './types';

type Step = 'list' | 'type' | 'attrs';

export function SpecPicker({ open, onClose, onPick, createOnly = false }: { open: boolean; onClose: () => void; onPick: (r: ResolvedSpec) => void; createOnly?: boolean }) {
  const s = SetupS.use();
  const lang = useSession((st) => st.user?.language || 'en');
  const [step, setStep] = useState<Step>(createOnly ? 'type' : 'list');
  const [q, setQ] = useState('');
  const [list, setList] = useState<{ aliases: { alias: string; spec: Spec }[]; recent: Spec[] } | null>(null);
  const [types, setTypes] = useState<MaterialType[]>([]);
  const [mt, setMt] = useState<MaterialType | null>(null);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(createOnly ? 'type' : 'list');
    setMt(null);
    setAttrs({});
    setAlias('');
    setError(null);
    void api.get<{ materials: MaterialType[] }>('/api/sc/templates').then((r) => setTypes(r.materials)).catch(() => setTypes([]));
  }, [open, createOnly]);

  useEffect(() => {
    if (!open || step !== 'list') return;
    const t = setTimeout(() => {
      void api.get<{ aliases: { alias: string; spec: Spec }[]; recent: Spec[] }>(`/api/sc/specs?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList({ aliases: [], recent: [] }));
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, step]);

  const label = (m: MaterialType) => m.labels[lang] ?? m.labels.en;
  const specAttrs = useMemo(() => (mt ? [...mt.attributes.filter((a) => a.role === 'spec')].sort((a, b) => Number(!!b.required) - Number(!!a.required)) : []), [mt]);

  const resolve = async (body: { material_type_id: string; attrs: Record<string, unknown>; alias?: string }) => {
    setSaving(true);
    setError(null);
    try {
      const r = await api.post<ResolvedSpec>('/api/sc/specs/resolve', body);
      onPick(r);
      onClose();
    } catch (e) {
      const missing = ((e as { body?: { missing?: string[] } }).body?.missing ?? []).map((k) => s(`a_${k}` as 'a_state'));
      setError(missing.length ? s('missing', { fields: missing.join(', ') }) : errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const pickExisting = (sp: Spec) => void resolve({ material_type_id: sp.material_type_id, attrs: sp.attrs });

  const title = step === 'list' ? s('pick_material') : step === 'type' ? s('what_kind') : mt ? label(mt) : '';
  const back = step === 'attrs' ? () => setStep('type') : step === 'type' && !createOnly ? () => setStep('list') : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-1">
          {back && (
            <button className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={back} aria-label={s('back')}>
              <ChevronLeft size={20} />
            </button>
          )}
          {title}
        </span>
      }
      footer={
        step === 'attrs' ? (
          <Button block size="lg" loading={saving} onClick={() => mt && void resolve({ material_type_id: mt.id, attrs, alias: alias.trim() || undefined })}>
            {s('use')}
          </Button>
        ) : undefined
      }
    >
      {step === 'list' && (
        <div className="space-y-4 pb-2">
          <label className="flex min-h-12 items-center gap-2 rounded-[16px] border border-line-strong bg-surface px-3.5">
            <Search size={18} className="text-meta" aria-hidden />
            <input className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" placeholder={s('search_ph')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {!!list?.aliases.length && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{s('your_names')}</h3>
              <div className="flex flex-wrap gap-2">
                {list.aliases.map((a) => (
                  <button key={a.alias} className="min-h-11 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-sunken" onClick={() => pickExisting(a.spec)}>
                    {a.alias}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!list?.recent.length && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-2">{s('recent')}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
                {list.recent.map((sp) => (
                  <li key={sp.id}>
                    <button className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink hover:bg-sunken" onClick={() => pickExisting(sp)}>
                      <span className="min-w-0 flex-1">{sp.label_en}</span>
                      <ChevronRight size={18} className="text-meta" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Button variant="secondary" block icon={Plus} onClick={() => setStep('type')}>
            {s('new_material')}
          </Button>
        </div>
      )}

      {step === 'type' && (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {types.map((m) => (
            <li key={m.id}>
              <button
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink hover:bg-sunken"
                onClick={() => {
                  setMt(m);
                  setAttrs({});
                  setStep('attrs');
                }}
              >
                <span className="min-w-0 flex-1 font-semibold">{label(m)}</span>
                <span className="text-[13px] text-meta">{m.allowed_units.slice(0, 2).join(' · ')}</span>
                <ChevronRight size={18} className="text-meta" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 'attrs' && mt && (
        <div className="space-y-4 pb-2">
          {specAttrs.map((a) => (
            <div key={a.key}>
              <label className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-2" htmlFor={`attr-${a.key}`}>
                {s(`a_${a.key}` as 'a_state')}
                {a.required && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{s('required')}</span>}
              </label>
              {a.type === 'enum' && a.enum ? (
                <div className="flex flex-wrap gap-2" id={`attr-${a.key}`} role="radiogroup">
                  {a.enum.map((v) => (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={attrs[a.key] === v}
                      onClick={() => setAttrs((x) => ({ ...x, [a.key]: v }))}
                      className={clsx('min-h-11 rounded-full border px-3.5 text-[14px] font-semibold', attrs[a.key] === v ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  id={`attr-${a.key}`}
                  inputMode={a.type === 'number' ? 'decimal' : 'text'}
                  className="min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary"
                  value={attrs[a.key] ?? ''}
                  onChange={(e) => setAttrs((x) => ({ ...x, [a.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-2" htmlFor="alias">
              {s('alias')}
            </label>
            <input id="alias" className="min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary" placeholder={s('alias_ph')} value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
