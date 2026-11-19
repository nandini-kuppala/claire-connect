// Claire, the AI trade assistant: DirectChannel('claire'). The client sends through the SDK,
// then notifies the server (/api/claire/turn); Claire's replies arrive as chat messages.
//
// Home → Claire hand-offs (router state, handled once, then cleared so a reload does not resend):
//   { send: string }   → sent as the user's text message, exactly like typing it
//   { chip: string, label?: string } → tapped like a chip (echoed as the user's reply bubble)
//   { voice: true }    → opens the voice recorder (falls back to focusing the composer)
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CC_REPLY, type ReplyPayload } from '@shared/cards';
import { api } from '../lib/api';
import { langNative } from '../lib/format';
import { useT } from '../i18n';
import { useSession } from '../store/session';
import { claireChannel, engine } from '../chat/engine';
import { ChatView, type SendInfo } from '../chat/ChatView';
import { AppShell } from '../components/AppShell';
import { ClaireMark } from '../components/Avatar';
import { ArrowLeft, Globe } from '../icons';
import { ClaireStrings } from './ClaireScreen.strings';

interface Handoff {
  send?: string;
  chip?: string;
  label?: string;
  voice?: boolean;
}

function readHandoff(state: unknown): Handoff | null {
  if (!state || typeof state !== 'object') return null;
  const st = state as Record<string, unknown>;
  const send = typeof st.send === 'string' && st.send.trim() ? st.send.trim() : undefined;
  const chip = typeof st.chip === 'string' && st.chip.trim() ? st.chip.trim() : undefined;
  const rawLabel = st.label ?? st.chipLabel;
  const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : undefined;
  const voice = st.voice === true || st.voice === 'true' || st.voice === 1;
  if (!send && !chip && !voice) return null;
  return { send, chip, label, voice };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ClaireScreen() {
  const t = useT();
  const s = ClaireStrings.use();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession((st) => st.user);
  const myLang = user?.language || 'en';
  const wrapRef = useRef<HTMLDivElement>(null);

  // Read the hand-off on the first render so onEmpty (below) can skip the welcome card when the
  // user arrives with something to say: the welcome would reset Claire's session mid-turn.
  const [handoff] = useState(() => readHandoff(location.state));
  const pending = useRef<Handoff | null>(handoff);
  const started = useRef(false);

  const onSend = useCallback((m: SendInfo) => api.post('/api/claire/turn', { text: m.text, messageId: m.messageId }), []);
  const onChip = useCallback((chipId: string, _label: string, messageId?: string) => api.post('/api/claire/turn', { chipId, messageId }), []);
  const onEmpty = useCallback(() => {
    const h = pending.current;
    if (h && (h.send || h.chip)) return Promise.resolve();
    return api.post('/api/claire/welcome', {});
  }, []);

  /** Wait until ChatView has loaded its first page, so the optimistic echo is not wiped by it. */
  const waitForChat = useCallback(async () => {
    try {
      await engine.connect();
    } catch {
      /* ChatView shows the offline banner; we still try */
    }
    const until = Date.now() + 6000;
    await sleep(120);
    while (Date.now() < until) {
      const el = wrapRef.current;
      if (el && !el.querySelector('[aria-busy="true"]')) break;
      await sleep(100);
    }
    await sleep(250);
  }, []);

  useEffect(() => {
    if (!handoff || started.current) return;
    started.current = true;
    navigate(location.pathname, { replace: true, state: null });

    void (async () => {
      await waitForChat();
      try {
        if (handoff.send) {
          // Same as typing: SDK send (echoed into ChatView by the engine), then the Claire turn.
          const sent = await engine.sendText(claireChannel, handoff.send);
          await api.post('/api/claire/turn', { text: handoff.send, messageId: sent.id });
        } else if (handoff.chip) {
          // Same as tapping: echo a CC:Reply bubble, then notify the server with its id.
          const known = handoff.chip.startsWith('home:') ? s(handoff.chip as Parameters<typeof s>[0]) : '';
          const label = handoff.label || (known && known !== handoff.chip ? known : handoff.chip);
          const content: ReplyPayload = { chipId: handoff.chip, label };
          let messageId: string | undefined;
          try {
            messageId = (await engine.sendCard(claireChannel, CC_REPLY, content)).id;
          } catch {
            /* the chip's action matters more than its echo */
          }
          await api.post('/api/claire/turn', { chipId: handoff.chip, messageId });
        }
      } catch {
        /* a failed hand-off leaves the chat usable; the user can just type */
      } finally {
        pending.current = null;
      }

      if (handoff.voice) {
        const root = wrapRef.current;
        const holdLabel = t('hold_to_talk');
        const mic = Array.from(root?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
          (b) => b.getAttribute('aria-label') === holdLabel || b.title === holdLabel,
        );
        if (mic && !mic.disabled) {
          // Composer starts a hands-free (tap-mode) recording on Enter / Space.
          mic.focus();
          mic.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
        } else {
          root?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        }
      }
    })();
    // Runs once per arrival; the state is cleared right away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <header className="flex min-h-[64px] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-2 pt-[var(--safe-top)]">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-sunken"
        aria-label={t('back')}
      >
        <ArrowLeft size={22} />
      </button>
      <ClaireMark size={42} />
      <div className="min-w-0 flex-1">
        <h1 className="font-head text-[17px] leading-tight font-semibold text-ink">{s('title')}</h1>
        <p className="truncate text-[13px] leading-[1.45] text-meta">{s('sub')}</p>
      </div>
      <Link
        to="/language"
        className="mr-1.5 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:bg-sunken"
        aria-label={s('language')}
      >
        <Globe size={16} aria-hidden className="text-meta" />
        <span lang={myLang}>{langNative(myLang)}</span>
      </Link>
    </header>
  );

  return (
    <AppShell variant="chat">
      <div ref={wrapRef} className="contents">
        <ChatView
          channel={claireChannel}
          counterpartLang={myLang}
          header={header}
          onSend={onSend}
          onChip={onChip}
          onEmpty={onEmpty}
          placeholder={t('claire_placeholder')}
        />
      </div>
    </AppShell>
  );
}
