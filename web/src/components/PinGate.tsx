// PIN on a shared phone (slice 7, 03 J13): when the person set a PIN, the app asks for it once per browser session,
// so `recorded_by` names who actually counted. Forgetting it means logging in again with OTP.
import { useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { useSession } from '../store/session';
import { defineStrings } from '../lib/localStrings';

const S = defineStrings('pin_gate', {
  en: { title: 'Enter your PIN', hint: 'This phone is shared. Your 4-digit PIN shows who is recording.', wrong: 'Wrong PIN. Try again.', locked: 'Too many tries. Wait 5 minutes, or log out and log in with OTP.', logout: 'Not you? Log out', del: 'Delete' },
  ta: { title: 'உங்கள் PIN-ஐ உள்ளிடுங்கள்', hint: 'இந்த போன் பகிரப்படுகிறது. யார் பதிகிறார்கள் என்று உங்கள் 4 இலக்க PIN காட்டும்.', wrong: 'PIN தவறு. மீண்டும் முயலுங்கள்.', locked: 'அதிக முயற்சிகள். 5 நிமிடம் காத்திருங்கள், அல்லது வெளியேறி OTP-யுடன் உள்நுழையுங்கள்.', logout: 'நீங்கள் இல்லையா? வெளியேறு', del: 'அழி' },
  hi: { title: 'अपना PIN डालें', hint: 'यह फ़ोन साझा है। आपका 4 अंकों का PIN बताता है कि कौन दर्ज कर रहा है।', wrong: 'PIN गलत है। फिर कोशिश करें।', locked: 'बहुत बार कोशिश हुई। 5 मिनट रुकें, या लॉग आउट करके OTP से लॉग इन करें।', logout: 'आप नहीं? लॉग आउट', del: 'मिटाएँ' },
});
const KEY = 'cc_pin_ok';
const unlocked = (uid: string) => { try { return sessionStorage.getItem(KEY) === uid; } catch { return false; } };

export function PinGate({ children }: { children: ReactNode }) {
  const user = useSession((st) => st.user);
  const logout = useSession((st) => st.logout);
  const s = S.use();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  if (!user?.has_pin || ok || unlocked(user.id)) return <>{children}</>;

  const press = async (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setErr(null);
    if (next.length < 4) return;
    try {
      await api.post('/api/sc/me/pin/verify', { pin: next });
      try { sessionStorage.setItem(KEY, user.id); } catch { /* fine: asks again next time */ }
      setOk(true);
    } catch (e) {
      setErr(e instanceof ApiError && (e.body as { code?: string })?.code === 'locked' ? s('locked') : s('wrong'));
      setPin('');
    }
  };
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6">
      <h1 className="font-head text-[22px] font-bold text-ink">{s('title')}</h1>
      <p className="mt-1 max-w-[320px] text-center text-[14px] text-ink-2">{s('hint')}</p>
      <div className="mt-6 flex gap-3" aria-label={`${pin.length} / 4`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`size-4 rounded-full border-2 border-primary ${i < pin.length ? 'bg-primary' : ''}`} />)}
      </div>
      {err && <p role="alert" className="mt-4 text-[14px] text-danger">{err}</p>}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) =>
          k === '' ? <span key="blank" /> : (
            <button key={k} onClick={() => (k === 'del' ? setPin((p) => p.slice(0, -1)) : void press(k))}
              className="flex size-16 items-center justify-center rounded-full border border-line-strong bg-surface font-head text-[22px] font-bold text-ink active:bg-sunken">
              {k === 'del' ? <span className="text-[13px] font-semibold">{s('del')}</span> : k}
            </button>
          ),
        )}
      </div>
      {<button className="mt-6 min-h-11 px-3 text-[14px] font-semibold text-primary" onClick={() => logout()}>{s('logout')}</button>}
    </div>
  );
}
