// Navigation helpers shared by screens and cards.
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../widgets/cards/card_ctx.dart';
import 'claire_screen.dart';
import 'deal_screen.dart';
import 'results_screen.dart';

Future<void> openClaire(BuildContext context, {String? text, String? chipId, String? chipLabel}) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClaireScreen(initialText: text, initialChipId: chipId, initialChipLabel: chipLabel)));

Future<void> openResults(BuildContext context, String requirementId) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ResultsScreen(requirementId: requirementId)));

Future<void> openConversation(BuildContext context, String conversationId) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => DealScreen(conversationId: conversationId)));

/// Opens (or creates) the deal chat with a seller, then shows it.
Future<void> openDealWith(BuildContext context, String sellerBusinessId, {String? requirementId, String? listingId}) async {
  final services = AppServices.of(context);
  final nav = Navigator.of(context);
  final r = asMap(await services.api.post('/api/deals/open', {
    'sellerBusinessId': sellerBusinessId,
    'requirementId': ?requirementId,
    if (listingId != null && listingId.isNotEmpty) 'listingId': listingId,
  }));
  final id = asStrOrNull(asMap(r['conversation'])['id']);
  if (id != null) await nav.push(MaterialPageRoute(builder: (_) => DealScreen(conversationId: id)));
}

CardCtx buildCardCtx(
  BuildContext context, {
  required Future<void> Function(String chipId, String label) chip,
  required VoidCallback refresh,
  Map<String, String> offerStatus = const {},
  DealInfo? deal,
  Future<void> Function(String offerId, double price, String unit)? onCounter,
}) {
  final services = AppServices.of(context);
  final user = services.session.user;
  return CardCtx(
    myUserId: user?.id ?? '',
    myBusinessId: user?.businessId ?? asStrOrNull(services.session.business?['id']),
    lang: services.session.language,
    api: services.api,
    chip: chip,
    openDeal: (seller, {requirementId, listingId}) => openDealWith(context, seller, requirementId: requirementId, listingId: listingId),
    openConversation: (id) => openConversation(context, id),
    openResults: (id) => openResults(context, id),
    refresh: refresh,
    offerStatus: offerStatus,
    deal: deal,
    onCounter: onCounter,
  );
}
