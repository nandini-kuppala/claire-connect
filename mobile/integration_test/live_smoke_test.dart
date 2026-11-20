// Live smoke test against the deployed server and Nexconn (read-only: it signs in a demo account,
// connects, reads history and walks the screens; it sends no chat messages).
//   flutter test integration_test/live_smoke_test.dart -d <simulator or device>
import 'package:claire_connect/api/api_client.dart';
import 'package:claire_connect/api/json.dart';
import 'package:claire_connect/app.dart';
import 'package:claire_connect/app_services.dart';
import 'package:claire_connect/cards/card_payload.dart';
import 'package:claire_connect/chat/chat_engine.dart';
import 'package:claire_connect/chat/chat_models.dart';
import 'package:claire_connect/i18n/i18n.dart';
import 'package:claire_connect/session/session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';


Future<void> settle(WidgetTester tester, [int seconds = 4]) async {
  for (var i = 0; i < seconds * 4; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('demo sign-in, Nexconn connect, history and screens', (tester) async {
    final session = SessionStore(api);
    await session.load();
    await session.logout();
    final i18n = I18n();
    await i18n.load('en');
    final services = AppServices(api: api, session: session, i18n: i18n, engine: ChatEngine.instance);

    await tester.pumpWidget(ClaireApp(services: services));
    await settle(tester, 3);
    debugPrint('PROBE screen=login');

    // Sign in through the demo list, like a visitor would.
    await tester.tap(find.text('Explore as a demo business'));
    await settle(tester, 6);
    debugPrint('PROBE screen=demo demoTitle=${find.text('Demo accounts').evaluate().length} none=${find.text('Demo accounts are not available right now.').evaluate().length} spinners=${find.byType(CircularProgressIndicator).evaluate().length}');
    try {
      final r = await api.get('/api/demo-accounts');
      debugPrint('PROBE direct demo-accounts ok: ${asList(asMap(r)['accounts']).length}');
    } catch (e) {
      debugPrint('PROBE direct demo-accounts failed: $e');
    }
    final demoRow = find.textContaining('Amit Hosiery');
    // The login screen is a lazy ListView: scroll until the demo row is built.
    for (var i = 0; i < 30 && demoRow.evaluate().isEmpty; i++) {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await settle(tester, 1);
    }
    expect(demoRow, findsWidgets);
    await tester.ensureVisible(demoRow.first);
    await settle(tester, 1);
    await tester.tap(demoRow.first);
    for (var i = 0; i < 120 && !session.signedIn; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(session.signedIn, isTrue);
    expect(session.chat?.isNexconn, isTrue);
    debugPrint('PROBE signed in, chat mode=${session.chat?.mode} area=${session.chat?.area}');
    // Show the home screen in English for the walkthrough (does not change the account language).
    await i18n.load('en');
    await settle(tester, 6);
    debugPrint('PROBE screen=home');
    await settle(tester, 4);

    // Engine-level checks.
    await services.ensureChat();
    expect(services.engine.isConnected, isTrue);
    debugPrint('PROBE connected as ${services.engine.myId.isNotEmpty}');
    final claire = await services.engine.history(ChatChannel.claire);
    debugPrint('PROBE claire history: ${claire.length} messages, types=${claire.map((m) => m.type).toSet()}');
    for (final m in claire.where((m) => m.type == ccCard).take(6)) {
      final p = CardPayload.parse(m.content);
      final keys = m.content.keys.toList()..sort();
      final shapes = {for (final k in keys) k: m.content[k].runtimeType.toString()};
      debugPrint('PROBE card kind=${p.kind} parsed=${p.runtimeType} fieldTypes=$shapes');
    }
    for (final m in claire.where((m) => m.type == ccReply).take(2)) {
      debugPrint('PROBE reply content=${m.content}');
    }
    final channels = await services.engine.listChannels();
    debugPrint('PROBE channels=${channels.length} unread=${channels.fold<int>(0, (a, c) => a + c.unread)}');

    // Walk the screens.
    await tester.tap(find.text('Chats'));
    await settle(tester, 8);
    debugPrint('PROBE screen=inbox');
    await settle(tester, 4);

    await tester.tap(find.text('Claire').first);
    await settle(tester, 10);
    debugPrint('PROBE screen=claire');
    await settle(tester, 4);
    await tester.pageBack();
    await settle(tester, 3);

    final convs = asList(await api.get('/api/conversations'));
    if (convs.isNotEmpty) {
      final name = asStr(asMap(asMap(convs.first)['counterpart'])['name']);
      final row = find.text(name);
      if (row.evaluate().isNotEmpty) {
        await tester.tap(row.first);
        await settle(tester, 12);
        debugPrint('PROBE screen=deal ($name)');
        await settle(tester, 4);
        await tester.pageBack();
        await settle(tester, 2);
      }
    }

    await tester.tap(find.text('Orders'));
    await settle(tester, 6);
    debugPrint('PROBE screen=orders');
    await settle(tester, 4);

    await tester.tap(find.text('Profile'));
    await settle(tester, 6);
    debugPrint('PROBE screen=profile');
    await settle(tester, 4);

    await services.engine.disconnect();
    await session.logout();
  }, timeout: const Timeout(Duration(minutes: 6)));

  test('API base is configured', () => expect(kApiBase, startsWith('http')));
}
