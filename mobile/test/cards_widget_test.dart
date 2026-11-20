import 'package:claire_connect/api/api_client.dart';
import 'package:claire_connect/cards/card_payload.dart';
import 'package:claire_connect/i18n/i18n.dart';
import 'package:claire_connect/theme/tokens.dart';
import 'package:claire_connect/widgets/cards/basic_cards.dart';
import 'package:claire_connect/widgets/cards/card_ctx.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

void main() {
  setUp(() => AppFonts.useGoogleFonts = false);

  testWidgets('chips card sends the tapped chip once and folds away', (tester) async {
    final taps = <String>[];
    final ctx = CardCtx(
      myUserId: 'u_me',
      myBusinessId: 'b_me',
      lang: 'en',
      api: ApiClient(baseUrl: 'http://localhost'),
      chip: (id, label) async => taps.add('$id|$label'),
      openDeal: (_, {requirementId, listingId}) async {},
      openConversation: (_) {},
      openResults: (_) {},
      refresh: () {},
    );
    final payload = CardPayload.parse({
      'kind': 'chips',
      'text': 'How many pieces do you need?',
      'chips': [
        {'id': 'qty:500', 'label': '500 pcs'},
        {'id': 'qty:1000', 'label': '1,000 pcs'},
      ],
    }) as ChipsCard;

    await tester.pumpWidget(I18nScope(
      i18n: I18n.fromTables(en: const {}),
      child: MaterialApp(home: Scaffold(body: ChipsCardView(payload: payload, ctx: ctx, sentAt: 1))),
    ));

    expect(find.text('How many pieces do you need?'), findsOneWidget);
    await tester.tap(find.text('1,000 pcs'));
    await tester.pump();
    expect(taps, ['qty:1000|1,000 pcs']);
    // Answered: the options fold away, the question stays.
    expect(find.text('500 pcs'), findsNothing);
    expect(find.text('How many pieces do you need?'), findsOneWidget);
  });
}
