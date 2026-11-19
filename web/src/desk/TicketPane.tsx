// Centre pane: ticket header, "Join conversation" banner, then the live (translated) group chat with Claire's whisper chips.
import { useState } from 'react';
import { Languages, LogIn, MessageSquareText } from '../icons';
import { ClaireMark } from '../components/Avatar';
import { engine, type Channel } from '../chat/engine';
import { C, HEAD, LangChip, Spinner, errMsg, fmtTime, useNow, type Ticket } from './kit';
import { PRIORITY_COLOR, SlaChip } from './QueuePane';
import { ChatView } from '../chat/ChatView';

export function TicketPane({
  ticket, channel, joined, joining, onJoin, agentName, loading,
}: {
  ticket: Ticket | null; channel: Channel | null; joined: boolean; joining: boolean; onJoin: () => void; agentName: string; agentLang: string; loading: boolean;
}) {
  const now = useNow(1000);
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!ticket)
    return (
      <section className="flex min-h-0 flex-col items-center justify-center bg-page text-center">
        {loading ? <Spinner size={26} /> : (
          <>
            <span className="flex size-16 items-center justify-center rounded-full" style={{ background: C.tint, color: C.primary }}><MessageSquareText size={30} /></span>
            <p className={`${HEAD} mt-3 text-[16px] font-semibold`} style={{ color: C.ink }}>Pick a ticket from the queue</p>
            <p className="mt-1 text-[13px]" style={{ color: C.meta }}>The conversation and AI brief open here.</p>
          </>
        )}
      </section>
    );

  const replies = ticket.suggestedReplies.length
    ? ticket.suggestedReplies
    : [
        `Namaste, I am ${agentName} from CLAIRE Trade Desk. I am looking into this now.`,
        ...(ticket.nextStep ? [ticket.nextStep] : []),
        'Can you share a photo or the LR number, please?',
        'Thank you both. I will update you within the hour.',
      ];
  // The console reads in English; parties may write in different languages, so detect per message.
  const counterpartLang = 'auto';

  async function sendReply(text: string) {
    if (!channel) return;
    setSending(text);
    setSendError(null);
    try {
      await engine.sendText(channel, text);
    } catch (e) {
      setSendError(errMsg(e));
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="flex min-h-0 flex-col bg-page">
      {/* Header */}
      <header className="flex items-center gap-3 border-b bg-surface px-5 py-3" style={{ borderColor: C.border }}>
        <span className="h-9 w-1 rounded-full" style={{ background: PRIORITY_COLOR[ticket.priority] ?? C.border }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={`${HEAD} truncate text-[16px] font-semibold`} style={{ color: C.ink }}>
              {ticket.parties.map((p) => p.name).join(' ↔ ') || ticket.typeLabel}
            </h2>
            <SlaChip ticket={ticket} now={now} />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: C.meta }}>
            <span className="font-semibold" style={{ color: PRIORITY_COLOR[ticket.priority] }}>{ticket.priority}</span>
            <span>·</span><span>{ticket.code}</span><span>·</span><span>{ticket.typeLabel}</span>
            {ticket.createdAt && <><span>·</span><span>opened {fmtTime(ticket.createdAt)}</span></>}
            <span className="ml-1 flex gap-1">{ticket.languages.map((l) => <LangChip key={l} code={l} />)}</span>
          </p>
        </div>
        {joined && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium" style={{ background: C.tint, color: C.primary }}>
            <Languages size={13} /> Translating to English
          </span>
        )}
      </header>

      {!joined ? (
        <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
          <div className="w-full max-w-[560px] rounded-[22px] border bg-surface p-6" style={{ borderColor: C.border }}>
            <p className={`flex items-center gap-2 ${HEAD} text-[15px] font-semibold`} style={{ color: C.ink }}>
              {ticket.description ? 'What was reported' : 'Before you join'}
            </p>
            {/* The AI summary sits in the context panel; here show the raw report so the two don't repeat. */}
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed" style={{ color: C.ink }}>{ticket.description || ticket.summary || 'No summary yet.'}</p>
            {ticket.status === 'resolved' ? (
              <p className="mt-4 text-[14px] font-medium" style={{ color: C.success }}>This ticket is resolved.</p>
            ) : (
              <>
                <p className="mt-4 text-[13px]" style={{ color: C.ink2 }}>
                  {ticket.conversationId
                    ? 'You will join the existing deal chat. Both parties see that you joined; Claire pauses auto-replies.'
                    : 'A support chat will be opened with the requester.'}
                </p>
                <button
                  onClick={onJoin}
                  disabled={joining}
                  className="mt-4 flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white disabled:opacity-60"
                  style={{ background: C.primary }}
                >
                  {joining ? <Spinner size={16} color="#fff" /> : <LogIn size={16} />} Join conversation
                </button>
                {ticket.agentName && ticket.agentId && <p className="mt-2 text-[12px]" style={{ color: C.meta }}>Assigned to {ticket.agentName}</p>}
              </>
            )}
          </div>
        </div>
      ) : channel ? (
        <>
          <div className="min-h-0 flex-1">
            <ChatView key={channel.targetId} channel={channel} conversationId={ticket.conversationId ?? undefined} counterpartLang={counterpartLang} compact uiLang="en" placeholder="Message" />
          </div>
          {ticket.status !== 'resolved' && (
            <div className="border-t bg-surface px-4 py-2.5" style={{ borderColor: C.border }}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: C.ink2 }}>
                <ClaireMark size={18} /> Claire suggests
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {replies.map((r) => (
                  <button
                    key={r}
                    onClick={() => sendReply(r)}
                    disabled={!!sending}
                    title={r}
                    className="line-clamp-2 min-h-10 max-w-[300px] shrink-0 rounded-[18px] border px-3.5 py-2 text-left text-[13px] leading-snug font-medium transition-colors hover:bg-primary-tint disabled:opacity-50"
                    style={{ borderColor: C.chipBorder, color: C.primary, background: C.surface }}
                  >
                    {sending === r ? 'Sending…' : r}
                  </button>
                ))}
              </div>
              {sendError && <p className="mt-1 text-[12px]" style={{ color: C.danger }}>{sendError}</p>}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center"><Spinner size={24} /></div>
      )}
    </section>
  );
}
