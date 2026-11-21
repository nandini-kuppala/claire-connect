import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DisputeCard, MovementCard } from './ScCards';
import { GoodsAnswerCard, RecordDraftCard } from './ClaireGoodsCards';
import clsx from 'clsx';
import { TriangleExclamationPoint } from '../icons';
import type { CardPayload } from '@shared/cards';
import type { CardCtx, ChatMessage } from './types';
import { ChipsCard } from './Chips';
import { TilesCard } from './Tiles';
import { CarouselCard } from './Carousel';
import { SummaryCard } from './Summary';
import { ResultsCard } from './Results';
import { RequirementCard } from './Requirement';
import { OfferCard } from './Offer';
import { OrderCard } from './Order';
import { RatingCard } from './Rating';
import { OrdersCard } from './Orders';
import { AgentJoinedCard } from './AgentJoined';
import { ResolvedCard } from './Resolved';
import { ProfileCard } from './Profile';
import { NoticeCard } from './Notice';
import { JobSplitCard } from './JobSplit';

export { HintBubble } from './HintBubble';
export { ReplyBubble } from './ReplyBubble';
export type { CardCtx, ChatMessage } from './types';

export interface CardRendererProps {
  message: ChatMessage;
  payload: CardPayload;
  ctx: CardCtx;
}

function Fallback() {
  return (
    <div className="inline-flex max-w-[340px] items-center gap-2 rounded-2xl border border-line bg-page px-3.5 py-2.5 text-[13px] text-meta">
      <TriangleExclamationPoint size={16} aria-hidden className="shrink-0 text-warning" />
      This card can't be shown on this version.
    </div>
  );
}

/** Keeps one malformed card from taking down the whole chat. */
class CardBoundary extends Component<{ children: ReactNode; id: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[card] render failed', this.props.id, error, info.componentStack);
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}

function renderCard({ message, payload, ctx }: CardRendererProps): ReactNode {
  switch (payload.kind) {
    case 'chips': return <ChipsCard message={message} payload={payload} ctx={ctx} />;
    case 'tiles': return <TilesCard message={message} payload={payload} ctx={ctx} />;
    case 'carousel': return <CarouselCard message={message} payload={payload} ctx={ctx} />;
    case 'summary': return <SummaryCard message={message} payload={payload} ctx={ctx} />;
    case 'results': return <ResultsCard message={message} payload={payload} ctx={ctx} />;
    case 'requirement': return <RequirementCard message={message} payload={payload} ctx={ctx} />;
    case 'offer': return <OfferCard message={message} payload={payload} ctx={ctx} />;
    case 'order': return <OrderCard message={message} payload={payload} ctx={ctx} />;
    case 'rating': return <RatingCard message={message} payload={payload} ctx={ctx} />;
    case 'orders': return <OrdersCard message={message} payload={payload} ctx={ctx} />;
    case 'agent_joined': return <AgentJoinedCard message={message} payload={payload} ctx={ctx} />;
    case 'resolved': return <ResolvedCard message={message} payload={payload} ctx={ctx} />;
    case 'profile': return <ProfileCard message={message} payload={payload} ctx={ctx} />;
    case 'notice': return <NoticeCard message={message} payload={payload} ctx={ctx} />;
    case 'job_split': return <JobSplitCard message={message} payload={payload} ctx={ctx} />;
    case 'movement': return <MovementCard payload={payload} ctx={ctx} />;
    case 'dispute': return <DisputeCard payload={payload} />;
    case 'goods_answer': return <GoodsAnswerCard payload={payload} ctx={ctx} />;
    case 'record_draft': return <RecordDraftCard payload={payload} ctx={ctx} />;
    default: return <Fallback />;
  }
}

/** Renders any CLAIRE `CC:Card` payload. */
export function CardRenderer(props: CardRendererProps) {
  if (!props.payload || typeof props.payload !== 'object') return <Fallback />;
  return (
    <div className={clsx('flex w-full min-w-0', props.message.mine ? 'justify-end' : 'justify-start')}>
      <CardBoundary id={props.message.id}>{renderCard(props)}</CardBoundary>
    </div>
  );
}

/** Cards that render as centered system lines rather than in a sender's bubble column. */
export const SYSTEM_CARD_KINDS: ReadonlySet<CardPayload['kind']> = new Set(['agent_joined', 'resolved', 'notice']);

export default CardRenderer;
