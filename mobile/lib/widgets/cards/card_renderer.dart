// Renders any CLAIRE CC:Card payload.
import 'package:material_ui/material_ui.dart';

import '../../cards/card_payload.dart';
import '../../chat/chat_models.dart';
import 'basic_cards.dart';
import 'card_ctx.dart';
import 'deal_cards.dart';
import 'results_card.dart';

/// Cards that render as centred system lines rather than in a sender's column.
bool isSystemCard(Map<String, dynamic> content) => const {'notice', 'agent_joined', 'resolved'}.contains(content['kind']);

class CardRenderer extends StatelessWidget {
  const CardRenderer({super.key, required this.message, required this.ctx});
  final ChatMessage message;
  final CardCtx ctx;

  @override
  Widget build(BuildContext context) {
    final payload = CardPayload.parse(message.content);
    final sentAt = message.sentAt;
    return switch (payload) {
      ChipsCard p => ChipsCardView(payload: p, ctx: ctx, sentAt: sentAt),
      TilesCard p => TilesCardView(payload: p, ctx: ctx, sentAt: sentAt),
      SummaryCard p => SummaryCardView(payload: p),
      NoticeCard p => NoticeCardView(payload: p),
      ResultsCard p => ResultsCardView(payload: p, ctx: ctx, sentAt: sentAt),
      OrdersCard p => OrdersCardView(payload: p, ctx: ctx),
      OfferCard p => OfferCardView(payload: p, ctx: ctx, mine: message.mine),
      OrderCard p => OrderCardView(key: ValueKey('order:${p.orderId}:${p.status}'), payload: p, ctx: ctx),
      RequirementCard p => RequirementCardView(payload: p),
      CarouselCard p => CarouselCardView(payload: p, ctx: ctx),
      OtherCard p => OtherCardView(payload: p),
    };
  }
}
