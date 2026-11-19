import { Headset } from '../icons';
import { LANGS } from '@shared/taxonomy';
import type { CardProps } from './types';
import { strings } from './strings';

const langName = (code: string) => LANGS.find((l) => l.code === code)?.native ?? code;

/** Centered system line: a Trade Desk agent joined the chat. */
export function AgentJoinedCard({ payload, ctx }: CardProps<'agent_joined'>) {
  const t = strings(ctx.lang);
  return (
    <div className="flex w-full justify-center">
      <div className="flex max-w-[320px] items-center gap-2.5 rounded-[18px] border border-line bg-surface py-2 pr-3.5 pl-2">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-tint text-clay">
          <Headset size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] leading-snug font-semibold text-ink">{t('joined', { name: payload.agentName })}</p>
          <p className="text-[12px] leading-snug text-meta">
            {payload.languages.length > 0 && <>{t('speaks', { langs: payload.languages.map(langName).join(', ') })} · </>}
            <span className="tabular-nums">{t('ticket', { code: payload.ticketCode })}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AgentJoinedCard;
