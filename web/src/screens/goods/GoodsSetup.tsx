// Goods setup (slice 0.5): people you work with, your places, what your unit does, and your names for materials.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ArrowLeft, Check, Plus } from '../../icons';
import { SetupS } from './Setup.strings';
import { SpecPicker } from './SpecPicker';
import type { Contact, Place, Spec } from './types';

const CAPS = ['knitting', 'dyeing', 'printing', 'embroidery', 'cutting', 'stitching', 'checking_packing', 'fabric', 'trims', 'yarn', 'transport', 'garments', 'selling_garments'] as const;
const LANGS = [['ta', 'தமிழ்'], ['hi', 'हिन्दी'], ['en', 'English']] as const;

function Section({ title, hint, action, children }: { title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-4 mt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-head text-[17px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13.5px] leading-snug text-meta">{hint}</p>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12.5px] text-meta">{hint}</span>}
    </label>
  );
}

const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

export default function GoodsSetup() {
  const s = SetupS.use();
  const nav = useNavigate();
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [caps, setCaps] = useState<{ suggested: string[]; capabilities: string[] | null; confirmed: boolean } | null>(null);
  const [capSel, setCapSel] = useState<string[]>([]);
  const [capSaved, setCapSaved] = useState(false);
  const [aliases, setAliases] = useState<{ alias: string; spec: Spec }[]>([]);
  const [sheet, setSheet] = useState<'contact' | 'place' | 'material' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [h, c, p, k, sp] = await Promise.all([
      api.get<{ role: 'owner' | 'staff' }>('/api/sc/home'),
      api.get<{ contacts: Contact[] }>('/api/sc/contacts'),
      api.get<{ places: Place[] }>('/api/sc/places'),
      api.get<{ suggested: string[]; capabilities: string[] | null; confirmed: boolean }>('/api/sc/capabilities'),
      api.get<{ aliases: { alias: string; spec: Spec }[] }>('/api/sc/specs'),
    ]);
    setRole(h.role);
    setContacts(c.contacts);
    setPlaces(p.places);
    setCaps(k);
    setCapSel(k.capabilities ?? k.suggested);
    setAliases(sp.aliases);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(errorText(e)));
  }, [load]);

  const openSheet = (k: 'contact' | 'place' | 'material') => {
    setForm(k === 'contact' ? { language: 'ta' } : k === 'place' ? { kind: 'godown' } : {});
    setError(null);
    setSheet(k);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (sheet === 'contact') await api.post('/api/sc/contacts', { name: form.name, phone: form.phone || undefined, language: form.language, role_hint: form.role_hint || undefined });
      if (sheet === 'place') await api.post('/api/sc/places', { name: form.name, kind: form.kind });
      setSheet(null);
      await load();
    } catch (e) {
      setError(errorText(e) || s('error'));
    } finally {
      setBusy(false);
    }
  };

  const owner = role === 'owner';

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
        <button className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-sunken" onClick={() => nav('/goods')} aria-label={s('back')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-head text-[20px] font-bold text-ink">{s('title')}</h1>
      </header>

      <Section title={s('contacts')} hint={s('contacts_hint')} action={<Button size="sm" variant="tint" icon={Plus} onClick={() => openSheet('contact')}>{s('add_contact')}</Button>}>
        {contacts && contacts.length === 0 ? (
          <p className="text-[14.5px] text-ink-2">{s('no_contacts')}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {(contacts ?? []).map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-semibold text-ink">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-meta">{[c.role_hint, c.phones[0] ? `+91\u00a0${c.phones[0]}` : null].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-ink-2">{c.link_state === 'linked' ? s('on_claire') : s('your_contact')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={s('places')} hint={s('places_hint')} action={owner ? <Button size="sm" variant="tint" icon={Plus} onClick={() => openSheet('place')}>{s('add_place')}</Button> : undefined}>
        {places && places.length === 0 ? (
          <p className="text-[14.5px] text-ink-2">{s('no_places')}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {(places ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-[15.5px] text-ink">
                <span className="min-w-0 flex-1 font-semibold">{p.name}</span>
                <span className="text-[13px] text-meta">{s(`k_${p.kind}` as 'k_godown')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {caps && (
        <Section title={s('caps')} hint={s('caps_hint')}>
          <div className="flex flex-wrap gap-2" role="group">
            {CAPS.map((c) => {
              const on = capSel.includes(c);
              return (
                <button
                  key={c}
                  disabled={!owner}
                  aria-pressed={on}
                  onClick={() => {
                    setCapSaved(false);
                    setCapSel((x) => (on ? x.filter((y) => y !== c) : [...x, c]));
                  }}
                  className={clsx('inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold disabled:opacity-70', on ? 'border-primary bg-primary-tint text-primary' : 'border-line-strong bg-surface text-ink-2')}
                >
                  {on && <Check size={15} aria-hidden />}
                  {s(`c_${c}`)}
                </button>
              );
            })}
          </div>
          {owner ? (
            <Button className="mt-3" variant={capSaved || (caps.confirmed && !capSaved && JSON.stringify(capSel) === JSON.stringify(caps.capabilities)) ? 'secondary' : 'primary'} icon={capSaved ? Check : undefined}
              onClick={async () => {
                await api.post('/api/sc/capabilities', { capabilities: capSel });
                setCapSaved(true);
              }}>
              {capSaved ? s('confirmed') : s('confirm')}
            </Button>
          ) : (
            <p className="mt-2 text-[13px] text-meta">{s('owner_only')}</p>
          )}
        </Section>
      )}

      <Section title={s('materials')} hint={s('materials_hint')} action={<Button size="sm" variant="tint" icon={Plus} onClick={() => setSheet('material')}>{s('add_material')}</Button>}>
        {aliases.length === 0 ? (
          <p className="text-[14.5px] text-ink-2">{s('no_materials')}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {aliases.map((a) => (
              <li key={a.alias} className="px-4 py-3">
                <p className="text-[15.5px] font-semibold text-ink">{a.alias}</p>
                <p className="mt-0.5 text-[13px] text-meta">{a.spec.label_en}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Sheet
        open={sheet === 'contact' || sheet === 'place'}
        onClose={() => setSheet(null)}
        title={sheet === 'contact' ? s('add_contact') : s('add_place')}
        footer={
          <Button block size="lg" loading={busy} disabled={!form.name?.trim()} onClick={() => void save()}>
            {s('save')}
          </Button>
        }
      >
        <div className="space-y-4 pb-2">
          <Field label={sheet === 'place' ? s('place_name') : s('name')}>
            <input className={inputCls} placeholder={sheet === 'place' ? s('place_ph') : s('name_ph')} value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </Field>
          {sheet === 'contact' && (
            <>
              <Field label={s('phone')} hint={s('phone_hint')}>
                <input className={inputCls} inputMode="tel" placeholder="98765 43210" value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label={s('role_hint')}>
                <input className={inputCls} placeholder={s('role_ph')} value={form.role_hint ?? ''} onChange={(e) => setForm((f) => ({ ...f, role_hint: e.target.value }))} />
              </Field>
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('language')}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {LANGS.map(([code, name]) => (
                    <button key={code} role="radio" aria-checked={form.language === code} onClick={() => setForm((f) => ({ ...f, language: code }))}
                      className={clsx('min-h-11 rounded-full border px-4 text-[14px] font-semibold', form.language === code ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {sheet === 'place' && (
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{s('kind')}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {(['godown', 'floor', 'shop', 'other'] as const).map((k) => (
                  <button key={k} role="radio" aria-checked={form.kind === k} onClick={() => setForm((f) => ({ ...f, kind: k }))}
                    className={clsx('min-h-11 rounded-full border px-4 text-[14px] font-semibold', form.kind === k ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
                    {s(`k_${k}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      </Sheet>

      <SpecPicker open={sheet === 'material'} createOnly onClose={() => setSheet(null)} onPick={() => void load()} />
    </div>
  );
}
