// Party picker sheet: my contacts first, then businesses I trade with; add a contact inline (03 S4 "To").
import { useEffect, useState } from 'react';
import { api, errorText } from '../../lib/api';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { ChevronRight, Plus, Search } from '../../icons';
import { RecS } from './Record.strings';
import { SetupS } from './Setup.strings';
import type { Party } from './types';

const inputCls = 'min-h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3.5 text-[16px] outline-none focus:border-primary';

export function PartyPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: Party) => void }) {
  const s = RecS.use();
  const ss = SetupS.use();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Party[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void api.get<{ parties: Party[] }>(`/api/sc/parties?q=${encodeURIComponent(q)}`).then((r) => setList(r.parties)).catch(() => setList([])), 200);
    return () => clearTimeout(t);
  }, [open, q]);

  useEffect(() => {
    if (open) {
      setAdding(false);
      setForm({ name: '', phone: '' });
      setError(null);
    }
  }, [open]);

  const addContact = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ contact: { id: string; name: string; role_hint: string | null } }>('/api/sc/contacts', { name: form.name, phone: form.phone || undefined });
      onPick({ ref: { k: 'c', id: r.contact.id }, name: r.contact.name, kind: 'contact', sub: r.contact.role_hint, onClaire: false });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={adding ? s('new_contact') : s('pick_party')}
      footer={adding ? <Button block size="lg" loading={busy} disabled={form.name.trim().length < 2} onClick={() => void addContact()}>{s('save')}</Button> : undefined}
    >
      {adding ? (
        <div className="space-y-4 pb-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{ss('name')}</span>
            <input className={inputCls} placeholder={ss('name_ph')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{ss('phone')}</span>
            <input className={inputCls} inputMode="tel" placeholder="98765 43210" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <span className="mt-1 block text-[12.5px] text-meta">{ss('phone_hint')}</span>
          </label>
          {error && <p className="rounded-[14px] bg-danger-tint px-3 py-2 text-[14px] text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <label className="flex min-h-12 items-center gap-2 rounded-[16px] border border-line-strong bg-surface px-3.5">
            <Search size={18} className="text-meta" aria-hidden />
            <input className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" placeholder={s('search_people')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {list.map((p) => {
              const business = p.kind === 'business';
              return (
                <li key={`${p.ref.k}:${p.ref.id}`}>
                  <button
                    disabled={business}
                    onClick={() => {
                      onPick(p);
                      onClose();
                    }}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sunken disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={business ? 'block text-[15px] font-semibold text-ink-2' : 'block text-[15px] font-semibold text-ink'}>{p.name}</span>
                      <span className="block text-[12.5px] leading-snug text-meta">{business ? s('two_sided_soon') : p.sub}</span>
                    </span>
                    {!business && <ChevronRight size={18} className="shrink-0 text-meta" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" block icon={Plus} onClick={() => setAdding(true)}>
            {s('new_contact')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
