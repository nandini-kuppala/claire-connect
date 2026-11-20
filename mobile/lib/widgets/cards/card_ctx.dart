// What a card can do from inside a chat (mirrors web/src/cards/types.ts CardCtx).
import '../../api/api_client.dart';

class DealOfferLite {
  const DealOfferLite({required this.id, required this.unitPrice, required this.qty, required this.status, required this.mine, this.createdAt = 0});
  final String id;
  final double unitPrice;
  final double qty;
  final String status;
  final bool mine;
  final int createdAt;
}

class DealInfo {
  const DealInfo({this.qty, this.unit, this.listedPrice, this.side, this.offers = const []});
  final double? qty;
  final String? unit;
  final double? listedPrice;
  final String? side;
  final List<DealOfferLite> offers;

  /// Price the other side last asked for: their newest offer, else the listed price.
  double? get theirPrice {
    for (final o in offers.reversed) {
      if (!o.mine) return o.unitPrice;
    }
    return listedPrice;
  }
}

class CardCtx {
  const CardCtx({
    required this.myUserId,
    required this.myBusinessId,
    required this.lang,
    required this.api,
    required this.chip,
    required this.openDeal,
    required this.openConversation,
    required this.openResults,
    required this.refresh,
    this.latestCardAt,
    this.offerStatus = const {},
    this.deal,
    this.onCounter,
  });

  final String myUserId;
  final String? myBusinessId;
  final String lang;
  final ApiClient api;

  /// Tap a chip: echo it (Claire chat) and notify the server.
  final Future<void> Function(String chipId, String label) chip;
  final Future<void> Function(String sellerBusinessId, {String? requirementId, String? listingId}) openDeal;
  final void Function(String conversationId) openConversation;
  final void Function(String requirementId) openResults;
  final void Function() refresh;

  /// Newest card time from the same sender: older chip cards can no longer be tapped.
  final int? latestCardAt;

  /// Live offer statuses (card payloads keep the status they were posted with).
  final Map<String, String> offerStatus;
  final DealInfo? deal;

  /// Opens the counter-offer sheet for an offer card.
  final Future<void> Function(String offerId, double currentPrice, String unit)? onCounter;

  bool isStale(int sentAt) => latestCardAt != null && sentAt < latestCardAt!;

  CardCtx withLatest(int? latest) => CardCtx(
        myUserId: myUserId,
        myBusinessId: myBusinessId,
        lang: lang,
        api: api,
        chip: chip,
        openDeal: openDeal,
        openConversation: openConversation,
        openResults: openResults,
        refresh: refresh,
        latestCardAt: latest,
        offerStatus: offerStatus,
        deal: deal,
        onCounter: onCounter,
      );
}
