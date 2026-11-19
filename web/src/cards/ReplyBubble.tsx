import clsx from 'clsx';
import type { ReplyPayload } from '@shared/cards';
import type { CardCtx, ChatMessage } from './types';
import { cleanLabel } from './format';

export interface ReplyBubbleProps {
  message: ChatMessage;
  payload: ReplyPayload;
  /** Accepted for call-site symmetry with the other bubbles; unused. */
  ctx?: CardCtx;
}

/** A chip tap rendered as the sender's own text bubble (20px radius, softened 8px tail). */
export function ReplyBubble({ message, payload }: ReplyBubbleProps) {
  return (
    <div
      className={clsx(
        'w-fit max-w-full px-3.5 py-2 text-[15px] leading-[1.45] break-words whitespace-pre-line text-ink',
        message.mine ? 'ml-auto rounded-[20px_20px_8px_20px] bg-bubble-own' : 'rounded-[20px_20px_20px_8px] border border-line bg-surface',
      )}
      data-chip-id={payload.chipId}
    >
      {cleanLabel(payload.label)}
    </div>
  );
}

export default ReplyBubble;
