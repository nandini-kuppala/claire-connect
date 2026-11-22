// O3–O5: voice interview with Claire. One question at a time with the mic as the hero;
// the profile fills in underneath while the user talks, then a confirm step, then (for sellers) the photo catalog sheet.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, ImagePlus, Keyboard, Loader2, Mic, Pencil, Send, Store, Volume2 } from '../icons';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { CatalogSheet } from '../components/CatalogSheet';
import { BrandMark, ClaireMark } from '../components/Avatar';
import { Button } from '../components/Button';
import { catName, errMsg, extFor, patchSession, tx, useMe, useRecorder } from '../desk/kit';
import { OnboardingStrings } from './Onboarding.strings';
// The work chips share their labels with the Goods home card (same keys, same translations).
import { OrderGoodsS } from './goods/OrderGoods.strings';

interface ProfileDraft {
  owner_name: string | null;
  business_name: string | null;
  role_label: string | null;
  sells: string[];
  buys: string[];
  capacity_note: string | null;
  city: string | null;
  area: string | null;
  gstin: string | null;
  is_manufacturer: boolean | null;
}
interface NextQ { key: string; text: string; ttsUrl: string | null }
interface TurnResponse { transcript: string; lang: string; draft: ProfileDraft; next: NextQ | null; done: boolean }

const EMPTY: ProfileDraft = { owner_name: null, business_name: null, role_label: null, sells: [], buys: [], capacity_note: null, city: null, area: null, gstin: null, is_manufacturer: null };
const STEPS = ['intro', 'business', 'location', 'gst'] as const;
const SPEECH_LANG: Record<string, string> = { ta: 'ta-IN', hi: 'hi-IN', en: 'en-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', or: 'or-IN' };

type Phase = 'interview' | 'work' | 'confirm' | 'saving' | 'products';

// S18 "What work does your unit do?" — same keys and shape as POST /api/sc/profile/work (businesses.sc_work).
const WORK_KEYS = ['knitting', 'dyeing', 'printing', 'embroidery', 'cutting', 'stitching', 'checking_packing', 'fabric_shop', 'trims_shop', 'yarn', 'transport', 'selling_garments'] as const;
type WorkKey = (typeof WORK_KEYS)[number];
/** Processes done as job work: these also ask capacity and usual turnaround. */
const JOB_WORK = new Set<WorkKey>(['knitting', 'dyeing', 'printing', 'embroidery', 'cutting', 'stitching', 'checking_packing']);
interface WorkAnswer { processes: WorkKey[]; capacity: string; days: string; sendsWork: boolean | null }
/** Pre-select what the interview already understood (e.g. "stitching job work" → Stitching). */
function workFromDraft(d: ProfileDraft): WorkKey[] {
  const out = new Set<WorkKey>();
  for (const c of d.sells) {
    if (c.startsWith('service.')) { const k = (c === 'service.checking' ? 'checking_packing' : c.slice(8)) as WorkKey; if (WORK_KEYS.includes(k)) out.add(k); }
    else if (c.startsWith('fabric.')) out.add('fabric_shop');
    else if (c.startsWith('yarn.')) out.add('yarn');
    else if (c.startsWith('garment.')) out.add('selling_garments');
  }
  return [...out];
}

export default function Onboarding() {
  const t = useT();
  const nav = useNavigate();
  const { lang } = useMe();

  const [phase, setPhase] = useState<Phase>('interview');
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState<NextQ>({ key: 'intro', text: tx(t, 'onb_q_intro', "Hello! I'm Claire. What's your name, and what's your business called?"), ttsUrl: null });
  const [stepIdx, setStepIdx] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  // null until the work step is answered or skipped; skipping saves nothing (the Goods card asks later).
  const [work, setWork] = useState<WorkAnswer | null>(null);
  const [workAsked, setWorkAsked] = useState(false);
  /** The interview is done: the work step comes once, then the confirm step. */
  function toReview() {
    setPhase(workAsked ? 'confirm' : 'work');
  }

  const audio = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRecorder();
  const press = useRef<{ at: number; toggle: boolean; stoppedOnDown: boolean }>({ at: 0, toggle: false, stoppedOnDown: false });
  const speech = useRef<any>(null);

  // Ask the server for the first (localized, spoken) question; keep the local fallback if unavailable.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = (await api.post('/api/onboarding/turn', { draft: EMPTY, language: lang })) as Partial<TurnResponse>;
        if (alive && r?.next?.text) setQuestion(r.next);
      } catch { /* fallback question already shown */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoplay Claire's voice once the user has interacted with the page (browser autoplay rules).
  useEffect(() => {
    if (question.ttsUrl && unlocked.current) play(question.ttsUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.ttsUrl]);

  useEffect(() => () => { audio.current?.pause(); stopSpeech(); }, []);

  function unlock() {
    unlocked.current = true;
  }

  function play(url: string | null) {
    if (!url) return;
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    a.onplay = () => setSpeaking(true);
    a.onended = a.onpause = () => setSpeaking(false);
    a.play().catch(() => setSpeaking(false));
  }

  function applyDraft(next: ProfileDraft) {
    const merged = { ...EMPTY, ...next, sells: next.sells ?? [], buys: next.buys ?? [] };
    const changed = new Set<string>();
    (Object.keys(merged) as (keyof ProfileDraft)[]).forEach((k) => {
      if (JSON.stringify(merged[k]) !== JSON.stringify(draft[k]) && merged[k] != null && !(Array.isArray(merged[k]) && !(merged[k] as unknown[]).length)) changed.add(k);
    });
    setDraft(merged);
    setFresh(changed);
    if (changed.size) window.setTimeout(() => setFresh(new Set()), 1600);
  }

  function handleTurn(r: TurnResponse) {
    if (r.transcript) setTranscript(r.transcript);
    if (r.draft) applyDraft(r.draft);
    if (r.lang && r.lang !== lang) patchSession({ user: { language: r.lang } });
    if (r.done || !r.next) {
      if (r.next?.text) setConfirmText(r.next.text);
      if (r.next?.ttsUrl && unlocked.current) play(r.next.ttsUrl);
      toReview();
      return;
    }
    const idx = STEPS.indexOf(r.next.key as (typeof STEPS)[number]);
    setStepIdx(idx >= 0 ? idx : Math.min(STEPS.length - 1, stepIdx + 1));
    setQuestion(r.next);
  }

  async function sendAudio(blob: Blob, mime: string) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('audio', blob, `answer.${extFor(mime)}`);
      fd.append('step', question.key);
      fd.append('draft', JSON.stringify(draft));
      fd.append('language', lang);
      const r = (await api.upload('/api/onboarding/turn', fd)) as TurnResponse;
      handleTurn(r);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
      setInterim('');
    }
  }

  async function skipGst() {
    setBusy(true);
    setError(null);
    try {
      handleTurn((await api.post('/api/onboarding/turn', { text: '', step: 'gst', draft, language: lang })) as TurnResponse);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendText(value: string) {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    setError(null);
    setTranscript(v);
    setText('');
    try {
      const r = (await api.post('/api/onboarding/turn', { text: v, step: question.key, draft, language: lang })) as TurnResponse;
      handleTurn(r);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Interim transcript from the browser's speech engine (display only; the server transcript is authoritative).
  function startSpeech() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || /Android/i.test(navigator.userAgent)) return;
    try {
      const sr = new SR();
      sr.lang = SPEECH_LANG[lang] ?? 'en-IN';
      sr.interimResults = true;
      sr.continuous = true;
      sr.onresult = (e: any) => {
        let s = '';
        for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
        setInterim(s);
      };
      sr.onerror = () => {};
      sr.start();
      speech.current = sr;
    } catch { /* optional */ }
  }
  function stopSpeech() {
    try { speech.current?.stop(); } catch { /* ignore */ }
    speech.current = null;
  }

  async function beginRecording() {
    setError(null);
    setInterim('');
    audio.current?.pause();
    try {
      await recorder.start();
      startSpeech();
    } catch {
      setError(tx(t, 'mic_denied', 'Microphone is blocked. Allow it in your browser, or type instead.'));
      setTyping(true);
    }
  }
  async function endRecording() {
    stopSpeech();
    const r = await recorder.stop();
    if (r && r.durationMs > 500) await sendAudio(r.blob, r.mime);
    else if (r) setError(tx(t, 'hold_longer', 'Too short. Hold the mic and speak.'));
  }

  // Hold-to-talk, or tap once to start and tap again to stop.
  function onMicDown(e: ReactPointerEvent) {
    e.preventDefault();
    unlock();
    if (busy) return;
    if (recorder.recording) {
      press.current.stoppedOnDown = true;
      void endRecording();
      return;
    }
    press.current = { at: Date.now(), toggle: false, stoppedOnDown: false };
    void beginRecording();
  }
  function onMicUp() {
    if (press.current.stoppedOnDown) {
      press.current.stoppedOnDown = false;
      return;
    }
    if (!recorder.recording) return;
    if (Date.now() - press.current.at > 450) void endRecording();
    else press.current.toggle = true;
  }

  const pendingUser = useRef<Record<string, unknown> | null>(null);
  function finish() {
    if (pendingUser.current) patchSession({ user: pendingUser.current as any });
    nav('/chat/claire', { replace: true });
  }

  async function complete() {
    setPhase('saving');
    setError(null);
    try {
      const days = Number.parseInt(work?.days ?? '', 10);
      const workBody = work && work.processes.length
        ? { processes: work.processes, capacity: work.capacity.trim().slice(0, 60) || undefined, turnaround_days: Number.isFinite(days) ? Math.min(90, days) : undefined, sends_work: work.sendsWork ?? undefined }
        : work && work.sendsWork != null ? { processes: [], sends_work: work.sendsWork } : undefined;
      const r = (await api.post('/api/onboarding/complete', { draft, language: lang, work: workBody })) as { business: any; user: any };
      // The onboarded user is stored only when leaving onboarding, so an app-level "already onboarded" redirect
      // cannot skip the add-products step.
      pendingUser.current = r.user ?? {};
      patchSession({ business: r.business ?? null });
      if (draft.sells.length) setPhase('products');
      else finish();
    } catch (e) {
      setError(errMsg(e));
      setPhase('confirm');
    }
  }

  const filled = [draft.owner_name, draft.business_name, draft.sells.length || draft.buys.length ? 1 : null, draft.city, draft.gstin].filter(Boolean).length;

  const o = OnboardingStrings.use();
  const g = OrderGoodsS.use();
  const stepLabels = [o('s_intro'), o('s_business'), o('s_location'), o('s_gst'), o('s_work'), o('s_confirm')];
  const TOTAL = stepLabels.length;

  // ── Products step (sellers) ──
  if (phase === 'products') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className={clsx('mb-6 flex size-24 items-center justify-center rounded-full', published ? 'bg-success-tint text-success' : 'bg-clay-tint text-clay')}>
            {published ? <Check size={44} aria-hidden /> : <ImagePlus size={42} aria-hidden />}
          </div>
          <h1 className="font-head text-[26px] leading-tight font-bold text-ink">
            {published ? tx(t, 'onb_shop_live', 'Your shop is live') : tx(t, 'onb_add_products', 'Add your products')}
          </h1>
          <p className="mt-2 max-w-[330px] text-[16px] leading-relaxed text-ink-2">
            {published
              ? tx(t, 'onb_shop_live_sub', 'Buyers can now find you. Claire will tell you when an enquiry comes in.')
              : tx(t, 'onb_add_products_sub', 'Pick photos you already have. Claire writes the titles; you say the price once.')}
          </p>
          <div className="mt-8 flex w-full max-w-[340px] flex-col gap-2">
            {published ? (
              <Button size="lg" block onClick={finish}>
                <IconLabel icon={<ArrowRight size={18} aria-hidden />} after>
                  {tx(t, 'onb_go_inbox', 'Go to Claire')}
                </IconLabel>
              </Button>
            ) : (
              <>
                <Button size="lg" block onClick={() => setCatalogOpen(true)}>
                  <IconLabel icon={<ImagePlus size={18} aria-hidden />}>{tx(t, 'onb_pick_photos', 'Choose photos')}</IconLabel>
                </Button>
                <Button variant="ghost" size="lg" block onClick={finish}>
                  {tx(t, 'skip_for_now', 'Skip for now')}
                </Button>
              </>
            )}
          </div>
        </div>
        <CatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} onPublished={() => setPublished(true)} />
      </Screen>
    );
  }

  // ── Work step (S18): what the unit does; optional ──
  if (phase === 'work') {
    return (
      <Screen>
        <TopBar stepIdx={TOTAL - 2} labels={stepLabels} stepText={o('step_of', { n: TOTAL - 1, total: TOTAL })} />
        <WorkStep
          initial={work ?? { processes: workFromDraft(draft), capacity: (draft.capacity_note ?? '').slice(0, 60), days: '', sendsWork: null }}
          title={g('work_q')}
          hint={g('work_hint')}
          label={(k) => g(`w_${k}` as 'w_dyeing')}
          o={o}
          onDone={(w) => {
            setWork(w);
            setWorkAsked(true);
            setPhase('confirm');
          }}
          onSkip={() => {
            setWork(null);
            setWorkAsked(true);
            setPhase('confirm');
          }}
        />
      </Screen>
    );
  }

  // ── Confirm step ──
  if (phase === 'confirm' || phase === 'saving') {
    return (
      <Screen>
        <TopBar stepIdx={TOTAL - 1} labels={stepLabels} stepText={o('step_of', { n: TOTAL, total: TOTAL })} />
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="mt-3 flex items-start gap-3">
            <ClaireMark size={40} />
            <p className="flex-1 rounded-[18px] rounded-tl-[6px] border border-line bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink">
              {confirmText ?? tx(t, 'onb_confirm_q', 'Here is your profile. Is this correct?')}
            </p>
          </div>
          <div className="mt-4">
            <ProfileCard draft={draft} lang={lang} fresh={new Set()} editable onEdit={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          </div>
          {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-center text-[14px] text-danger">{error}</p>}
        </div>
        <div className="border-t border-line bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button size="lg" block loading={phase === 'saving'} onClick={complete} disabled={phase === 'saving' || !(draft.business_name || draft.owner_name)}>
            <IconLabel icon={phase === 'saving' ? null : <Check size={18} aria-hidden />}>{tx(t, 'yes_correct', 'Yes, correct')}</IconLabel>
          </Button>
          {work?.processes.length ? (
            <button type="button" onClick={() => setPhase('work')} disabled={phase === 'saving'} className="mt-2 flex min-h-11 w-full flex-wrap items-center justify-center gap-1.5 rounded-[16px] px-2 text-[13.5px] text-ink-2 hover:bg-sunken">
              <span className="font-semibold text-ink">{o('s_work')}:</span>
              {work.processes.map((k) => <span key={k}>{g(`w_${k}` as 'w_dyeing')}</span>).reduce<ReactNode[]>((a, x, i) => (i ? [...a, '·', x] : [x]), [])}
              <Pencil size={14} aria-hidden className="text-meta" />
            </button>
          ) : null}
          <Button variant="ghost" block className="mt-1.5" onClick={() => setPhase('interview')} disabled={phase === 'saving'}>
            <IconLabel icon={<Mic size={18} aria-hidden />}>{tx(t, 'onb_fix_voice', 'Fix something by voice')}</IconLabel>
          </Button>
        </div>
      </Screen>
    );
  }

  // ── Interview ──
  const ringScale = 1 + recorder.level * 0.7;
  const showAnswer = !!(transcript || interim || recorder.recording || busy);
  return (
    <Screen onPointerDownCapture={unlock}>
      <TopBar stepIdx={stepIdx} labels={stepLabels} stepText={o('step_of', { n: stepIdx + 1, total: TOTAL })} />

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-4">
        {/* Claire's question: one at a time, big and readable */}
        <div key={question.key} className="mt-6 flex animate-fade-up flex-col items-center text-center">
          <span className="relative inline-flex">
            {speaking && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" aria-hidden />}
            <ClaireMark size={68} className="relative" />
          </span>
          <p className="mt-5 font-head text-[22px] leading-snug font-semibold text-ink">{question.text}</p>
          {question.ttsUrl && (
            <button
              type="button"
              onClick={() => play(question.ttsUrl)}
              className={clsx(
                'mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors',
                speaking ? 'bg-primary text-white' : 'bg-primary-tint text-primary hover:bg-primary-soft',
              )}
            >
              <Volume2 size={18} aria-hidden /> {o('listen')}
            </button>
          )}
        </div>

        {/* What the user said */}
        {showAnswer && (
          <div className="mt-6 self-center rounded-[18px] bg-bubble-own px-4 py-3 text-center" aria-live="polite">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-primary uppercase">{o('you_said')}</p>
            <p className="mt-0.5 text-[16px] leading-relaxed text-ink">
              {recorder.recording ? (
                interim || <span className="text-meta">{tx(t, 'listening', 'Listening…')}</span>
              ) : busy && !transcript ? (
                <span className="inline-flex items-center gap-2 text-meta">
                  <Loader2 size={15} className="animate-spin" aria-hidden /> {tx(t, 'understanding', 'Understanding…')}
                </span>
              ) : (
                transcript
              )}
            </p>
          </div>
        )}

        {/* Profile taking shape */}
        <div className="mt-auto pt-6">
          <MiniProfile draft={draft} lang={lang} fresh={fresh} busy={busy} title={tx(t, 'onb_building', 'Building your profile')} empty={o('answers_here')} />
        </div>
        {error && <p role="alert" className="mt-3 rounded-[14px] bg-danger-tint px-3 py-2 text-center text-[14px] text-danger">{error}</p>}
      </div>

      {/* Mic dock */}
      <div className="bg-page px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        {typing ? (
          <form
            className="flex items-center gap-2 rounded-[22px] border border-line bg-surface p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendText(text);
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tx(t, 'type_answer', 'Type your answer')}
              className="h-12 min-w-0 flex-1 bg-transparent px-2 text-[16px] text-ink outline-none placeholder:text-meta"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setTyping(false)}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
              aria-label={tx(t, 'speak', 'Speak')}
            >
              <Mic size={20} aria-hidden />
            </button>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:bg-primary-soft"
              aria-label={tx(t, 'send', 'Send')}
            >
              {busy ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative flex size-[128px] items-center justify-center">
              {recorder.recording && (
                <span
                  className="absolute size-[92px] rounded-full bg-clay/20 transition-transform duration-75"
                  style={{ transform: `scale(${ringScale})` }}
                  aria-hidden
                />
              )}
              {!recorder.recording && !busy && <span className="absolute size-[92px] animate-pulse-ring rounded-full bg-primary/15" aria-hidden />}
              <button
                className={clsx(
                  'relative flex size-[92px] touch-none items-center justify-center rounded-full text-white transition-[transform,background-color] select-none active:scale-95 disabled:opacity-60',
                  recorder.recording ? 'bg-clay' : 'bg-primary hover:bg-primary-hover',
                )}
                onPointerDown={onMicDown}
                onPointerUp={onMicUp}
                onPointerLeave={() => recorder.recording && !press.current.toggle && Date.now() - press.current.at > 450 && void endRecording()}
                onContextMenu={(e) => e.preventDefault()}
                disabled={busy}
                aria-label={recorder.recording ? tx(t, 'stop', 'Stop') : tx(t, 'hold_to_talk', 'Hold to talk')}
              >
                {busy ? (
                  <Loader2 size={34} className="animate-spin" aria-hidden />
                ) : recorder.recording ? (
                  <span className="size-7 rounded-[8px] bg-surface" aria-hidden />
                ) : (
                  <Mic size={38} aria-hidden />
                )}
              </button>
            </div>
            <p className="-mt-1 text-[14px] font-medium text-ink-2">
              {recorder.recording ? tx(t, 'release_to_send', 'Release or tap to send') : tx(t, 'hold_or_tap', 'Hold to talk, or tap')}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-primary transition-colors hover:bg-primary-tint"
                onClick={() => setTyping(true)}
              >
                <Keyboard size={17} aria-hidden /> {tx(t, 'type_instead', 'Type instead')}
              </button>
              {question.key === 'gst' && (
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-full border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-sunken"
                  onClick={skipGst}
                  disabled={busy || recorder.recording}
                >
                  {tx(t, 'onb_skip', 'Skip')}
                </button>
              )}
              {filled >= 2 && (
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[14px] font-medium text-meta transition-colors hover:bg-sunken"
                  onClick={toReview}
                >
                  {tx(t, 'onb_review', 'Review profile')} <ArrowRight size={15} aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}

// ── Pieces ──
/** Icon + label inside a Button (kept local so it works with any Button icon typing). */
function IconLabel({ icon, after, children }: { icon: ReactNode; after?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {!after && icon}
      <span>{children}</span>
      {after && icon}
    </span>
  );
}

function Screen({ children, onPointerDownCapture }: { children: ReactNode; onPointerDownCapture?: () => void }) {
  return (
    <div className="min-h-dvh bg-page">
      <div
        className="mx-auto flex h-dvh w-full max-w-[480px] flex-col bg-page min-[481px]:shadow-[0_0_0_1px_var(--color-line)]"
        onPointerDownCapture={onPointerDownCapture}
      >
        {children}
      </div>
    </div>
  );
}

/** Brand + "Step 2 of 5 · Your business" + a segmented progress bar. */
function TopBar({ stepIdx, labels, stepText }: { stepIdx: number; labels: string[]; stepText: string }) {
  const total = labels.length;
  const idx = Math.min(stepIdx, total - 1);
  return (
    <div className="px-4 pt-[max(12px,env(safe-area-inset-top))] pb-1">
      <div className="flex min-h-[44px] items-center gap-2.5">
        <BrandMark size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-tight text-meta">{stepText}</p>
          <p className="truncate font-head text-[15px] leading-tight font-semibold text-ink">{labels[idx]}</p>
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={idx + 1} aria-valuetext={stepText}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={clsx('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= idx ? 'bg-primary' : 'bg-line')} />
        ))}
      </div>
    </div>
  );
}

/** Compact live summary during the interview: only what has been understood so far, as chips. */
function MiniProfile({ draft, lang, fresh, busy, title, empty }: { draft: ProfileDraft; lang: string; fresh: Set<string>; busy: boolean; title: string; empty: string }) {
  const items: { key: keyof ProfileDraft; label: string }[] = [];
  if (draft.owner_name) items.push({ key: 'owner_name', label: draft.owner_name });
  if (draft.business_name) items.push({ key: 'business_name', label: draft.role_label ? `${draft.business_name} · ${draft.role_label}` : draft.business_name });
  draft.sells.forEach((c) => items.push({ key: 'sells', label: catName(c, lang) }));
  draft.buys.forEach((c) => items.push({ key: 'buys', label: catName(c, lang) }));
  if (draft.capacity_note) items.push({ key: 'capacity_note', label: draft.capacity_note });
  const loc = [draft.area, draft.city].filter(Boolean).join(', ');
  if (loc) items.push({ key: 'city', label: loc });
  if (draft.gstin) items.push({ key: 'gstin', label: `GST ${draft.gstin}` });

  return (
    <div className="rounded-[22px] border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[12px] bg-primary-tint text-primary">
          <Store size={18} aria-hidden />
        </span>
        <p className={clsx('font-head text-[15px] font-semibold text-ink', busy && 'animate-pulse')}>{title}</p>
      </div>
      {items.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li
              key={`${it.key}-${i}`}
              className={clsx(
                'inline-flex min-h-[32px] max-w-full items-center gap-1 rounded-full px-3 text-[13.5px] transition-colors duration-700',
                fresh.has(it.key) ? 'bg-primary text-white' : 'bg-primary-tint text-primary',
              )}
            >
              {fresh.has(it.key) && <Check size={13} className="shrink-0" aria-hidden />}
              <span className="truncate">{it.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-3 w-20 rounded-full bg-sunken" />
          <span className="h-3 w-28 rounded-full bg-sunken" />
          <span className="sr-only">{empty}</span>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ draft, lang, fresh, editable, onEdit }: { draft: ProfileDraft; lang: string; fresh: Set<string>; editable?: boolean; onEdit?: (p: Partial<ProfileDraft>) => void }) {
  const t = useT();
  const location = [draft.area, draft.city].filter(Boolean).join(', ') || null;
  const rows: { key: keyof ProfileDraft | 'loc'; label: string; value: ReactNode; edit?: (v: string) => Partial<ProfileDraft>; raw?: string | null }[] = [
    { key: 'owner_name', label: tx(t, 'f_name', 'Name'), value: draft.owner_name, raw: draft.owner_name, edit: (v) => ({ owner_name: v || null }) },
    { key: 'business_name', label: tx(t, 'f_business', 'Business'), value: draft.business_name ? <>{draft.business_name}{draft.role_label && <span className="text-meta"> · {draft.role_label}</span>}</> : null, raw: draft.business_name, edit: (v) => ({ business_name: v || null }) },
    { key: 'sells', label: tx(t, 'f_sells', 'Sells'), value: draft.sells.length ? <Chips items={draft.sells.map((c) => catName(c, lang))} /> : null },
    { key: 'buys', label: tx(t, 'f_buys', 'Buys'), value: draft.buys.length ? <Chips items={draft.buys.map((c) => catName(c, lang))} /> : null },
    { key: 'capacity_note', label: tx(t, 'f_capacity', 'Capacity'), value: draft.capacity_note, raw: draft.capacity_note, edit: (v) => ({ capacity_note: v || null }) },
    { key: 'city', label: tx(t, 'f_location', 'Location'), value: location, raw: draft.city, edit: (v) => ({ city: v || null }) },
    { key: 'gstin', label: 'GST', value: draft.gstin, raw: draft.gstin, edit: (v) => ({ gstin: v.toUpperCase() || null }) },
  ];
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <div className="flex size-11 items-center justify-center rounded-[14px] bg-primary-tint text-primary">
          <Store size={22} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={clsx('truncate font-head text-[17px] font-semibold', draft.business_name ? 'text-ink' : 'text-meta')}>
            {draft.business_name || tx(t, 'your_business', 'Your business')}
          </p>
          <p className="truncate text-[13px] text-meta">{draft.owner_name || '—'}</p>
        </div>
      </div>
      <dl>
        {rows.map((r) => (
          <div
            key={r.key}
            className={clsx('flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 transition-colors duration-700 last:border-b-0', fresh.has(r.key) && 'bg-primary-tint')}
          >
            <dt className="w-[84px] shrink-0 text-[13px] text-meta">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-[15px] text-ink">
              {editable && r.edit ? (
                <EditableValue value={r.raw ?? ''} display={r.value} onSave={(v) => onEdit?.(r.edit!(v))} />
              ) : r.value ? (
                <span className="flex items-center gap-1.5">
                  {fresh.has(r.key) && <Check size={14} className="shrink-0 text-success" aria-hidden />}
                  <span className="min-w-0">{r.value}</span>
                </span>
              ) : (
                <span className="inline-block h-3 w-24 rounded-full bg-sunken" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EditableValue({ value, display, onSave }: { value: string; display: ReactNode; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (editing)
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          onSave(v.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-11 w-full rounded-[12px] border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-primary"
      />
    );
  return (
    <button type="button" className="flex min-h-[40px] w-full items-center gap-2 text-left" onClick={() => setEditing(true)}>
      <span className="min-w-0 flex-1">{display || <span className="text-meta">—</span>}</span>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-meta hover:bg-sunken">
        <Pencil size={15} aria-hidden />
      </span>
    </button>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="inline-flex h-7 items-center rounded-full bg-primary-tint px-2.5 text-[13px] text-primary">
          {s}
        </span>
      ))}
    </span>
  );
}

/** S18: multi-select chips, then (for job-work processes) capacity and usual turnaround, then "Do you send work?". */
function WorkStep({ initial, title, hint, label, o, onDone, onSkip }: {
  initial: WorkAnswer; title: string; hint: string; label: (k: WorkKey) => string;
  o: ReturnType<typeof OnboardingStrings.use>; onDone: (w: WorkAnswer) => void; onSkip: () => void;
}) {
  const [w, setW] = useState<WorkAnswer>(initial);
  const toggle = (k: WorkKey) => setW((x) => ({ ...x, processes: x.processes.includes(k) ? x.processes.filter((p) => p !== k) : [...x.processes, k] }));
  const jobWork = w.processes.some((k) => JOB_WORK.has(k));
  const answered = w.processes.length > 0 || w.sendsWork != null;
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mt-3 flex items-start gap-3">
          <ClaireMark size={40} />
          <div className="flex-1 rounded-[18px] rounded-tl-[6px] border border-line bg-surface px-4 py-3">
            <p className="font-head text-[18px] leading-snug font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{hint}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={title}>
          {WORK_KEYS.map((k) => {
            const on = w.processes.includes(k);
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)}
                className={clsx('inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[14.5px] font-semibold transition-colors', on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}>
                {on && <Check size={15} aria-hidden />}{label(k)}
              </button>
            );
          })}
        </div>
        {jobWork && (
          <div className="mt-5 grid gap-3 rounded-[18px] border border-line bg-surface p-4">
            <label className="block">
              <span className="text-[13.5px] font-medium text-ink-2">{o('cap_label')}</span>
              <input value={w.capacity} maxLength={60} onChange={(e) => setW((x) => ({ ...x, capacity: e.target.value }))} placeholder={o('cap_ph')}
                className="mt-1.5 h-12 w-full rounded-[16px] border border-line-strong bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-meta focus:border-primary" />
            </label>
            <label className="block">
              <span className="text-[13.5px] font-medium text-ink-2">{o('days_label')}</span>
              <input value={w.days} inputMode="numeric" onChange={(e) => setW((x) => ({ ...x, days: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                className="mt-1.5 h-12 w-28 rounded-[16px] border border-line-strong bg-surface px-3 font-head text-[16px] text-ink tabular-nums outline-none focus:border-primary" />
            </label>
          </div>
        )}
        <div className="mt-5">
          <p className="text-[15px] font-semibold text-ink">{o('sends_q')}</p>
          <div className="mt-2 flex gap-2">
            {([true, false] as const).map((v) => (
              <button key={String(v)} type="button" aria-pressed={w.sendsWork === v} onClick={() => setW((x) => ({ ...x, sendsWork: x.sendsWork === v ? null : v }))}
                className={clsx('min-h-11 min-w-[88px] rounded-full border px-4 text-[14.5px] font-semibold transition-colors', w.sendsWork === v ? 'border-primary bg-primary-tint text-primary' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}>
                {v ? o('yes') : o('no')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button size="lg" block disabled={!answered} onClick={() => onDone(w)}>
          <IconLabel icon={<ArrowRight size={18} aria-hidden />} after>{o('continue')}</IconLabel>
        </Button>
        <Button variant="ghost" block className="mt-1.5" onClick={onSkip}>{o('skip')}</Button>
      </div>
    </>
  );
}
