// Profile for a staff login (slice 7): who you are, whose staff, language, PIN, log out. Nothing about money,
// trust scores, the store or the business's settings (04 §10.3b).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '../lib/api';
import { useSession } from '../store/session';
import { Button } from '../components/Button';
import { LANGS } from '../../../shared/taxonomy';
import { defineStrings } from '../lib/localStrings';

const S = defineStrings('staff_profile', {
  en: { title: 'Profile', staff_of: 'Staff of {biz}', language: 'Language', pin: 'PIN for this phone', pin_hint: 'Set or change it in Goods → Setup.', open: 'Open', logout: 'Log out', can: 'You can record goods, check what came in and ask Claire. Prices, orders and the store are for the owner.' },
  ta: { title: 'சுயவிவரம்', staff_of: '{biz} பணியாளர்', language: 'மொழி', pin: 'இந்த போனுக்கான PIN', pin_hint: 'சரக்கு → அமைப்பில் அமைக்கலாம் அல்லது மாற்றலாம்.', open: 'திற', logout: 'வெளியேறு', can: 'சரக்கைப் பதியலாம், வந்ததைச் சரிபார்க்கலாம், Claire-இடம் கேட்கலாம். விலை, ஆர்டர், கடை உரிமையாளருக்கு.' },
  hi: { title: 'प्रोफ़ाइल', staff_of: '{biz} का स्टाफ़', language: 'भाषा', pin: 'इस फ़ोन का PIN', pin_hint: 'माल → सेटअप में रखें या बदलें।', open: 'खोलें', logout: 'लॉग आउट', can: 'आप माल दर्ज कर सकते हैं, आया माल जाँच सकते हैं और Claire से पूछ सकते हैं। कीमत, ऑर्डर और दुकान मालिक के लिए हैं।' },
});

export function StaffProfile() {
  const s = S.use();
  const nav = useNavigate();
  const user = useSession((st) => st.user);
  const biz = useSession((st) => st.business);
  const refresh = useSession((st) => st.refresh);
  const logout = useSession((st) => st.logout);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="px-4 pb-28 pt-[max(18px,var(--safe-top))]">
      <h1 className="font-head text-[28px] font-bold text-ink">{s('title')}</h1>
      <section className="mt-4 rounded-[18px] border border-line bg-surface px-4 py-3.5">
        <p className="font-head text-[18px] font-semibold text-ink">{user?.name}</p>
        <p className="text-[14px] text-ink-2">{s('staff_of', { biz: (biz?.name as string) ?? '' })}</p>
        {user?.phone && <p className="text-[13px] text-meta">+91 {user.phone}</p>}
        <p className="mt-2 text-[13.5px] text-ink-2">{s('can')}</p>
      </section>
      <h2 className="mt-5 text-[13px] font-semibold text-ink-2">{s('language')}</h2>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {LANGS.filter((l) => ['ta', 'hi', 'en'].includes(l.code)).map((l) => (
          <button key={l.code} role="radio" aria-checked={user?.language === l.code} disabled={!!busy}
            onClick={async () => { setBusy(l.code); try { await api.patch('/api/me', { language: l.code }); await refresh(); } finally { setBusy(null); } }}
            className={clsx('min-h-11 rounded-full border px-4 text-[14px] font-semibold', user?.language === l.code ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink')}>
            {l.native}
          </button>
        ))}
      </div>
      <section className="mt-5 flex items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3">
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{s('pin')}</span><span className="block text-[13px] text-meta">{s('pin_hint')}</span></span>
        <Button size="sm" variant="ghost" onClick={() => nav('/goods/setup')}>{s('open')}</Button>
      </section>
      <Button className="mt-6" variant="secondary" block onClick={() => { nav('/login', { replace: true, state: null }); logout(); }}>{s('logout')}</Button>
    </div>
  );
}
