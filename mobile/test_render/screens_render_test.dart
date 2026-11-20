// Offscreen screenshots of the real screens, signed in as demo buyer Amit against the live server,
// in several languages. Uses the Mac's own Indic system fonts so the PNGs show real glyphs.
// Read-only: it signs in and reads, and never changes the shared demo account (no PATCH /api/me).
// The Nexconn plugin is native, so chat history and the inbox list are not available here; chat
// cards are rendered from representative payloads instead.
//
//   flutter test test_render/screens_render_test.dart --update-goldens
//   (PNGs land in screenshots/render/)
@Tags(['render'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:claire_connect/api/api_client.dart';
import 'package:claire_connect/api/json.dart';
import 'package:claire_connect/app_services.dart';
import 'package:claire_connect/chat/chat_engine.dart';
import 'package:claire_connect/chat/chat_models.dart';
import 'package:claire_connect/i18n/i18n.dart';
import 'package:claire_connect/screens/language_screen.dart';
import 'package:claire_connect/screens/login_screen.dart';
import 'package:claire_connect/screens/results_screen.dart';
import 'package:claire_connect/screens/shell_screen.dart';
import 'package:claire_connect/session/session_store.dart';
import 'package:claire_connect/theme/app_theme.dart';
import 'package:claire_connect/theme/tokens.dart';
import 'package:claire_connect/widgets/cards/card_ctx.dart';
import 'package:claire_connect/widgets/cards/card_renderer.dart';
import 'package:claire_connect/widgets/chat_view.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _sup = '/System/Library/Fonts/Supplemental';
const _mf = '/opt/homebrew/share/flutter/bin/cache/artifacts/material_fonts';
const _sys = '/System/Library/Fonts';

/// Family names match AppFonts' fallback list; files are macOS system fonts.
const _fonts = <String, List<String>>{
  'Roboto': ['$_mf/Roboto-Regular.ttf', '$_mf/Roboto-Medium.ttf', '$_mf/Roboto-Bold.ttf', '$_mf/Roboto-Black.ttf'],
  'MaterialIcons': ['$_mf/MaterialIcons-Regular.otf'],
  'Noto Sans Tamil': ['$_sup/Tamil Sangam MN.ttc'],
  'Noto Sans Devanagari': ['$_sup/Devanagari Sangam MN.ttc'],
  'Noto Sans Bengali': ['$_sup/Bangla Sangam MN.ttc'],
  'Noto Sans Telugu': ['$_sup/Telugu Sangam MN.ttc'],
  'Noto Sans Kannada': ['$_sys/NotoSansKannada.ttc'],
  'Noto Sans Malayalam': ['$_sup/Malayalam Sangam MN.ttc'],
  'Noto Sans Gujarati': ['$_sup/Gujarati Sangam MN.ttc'],
  'Noto Sans Oriya': ['$_sys/NotoSansOriya.ttc'],
};

Future<void> _loadFonts() async {
  for (final e in _fonts.entries) {
    final loader = FontLoader(e.key);
    for (final f in e.value) {
      final file = File(f);
      if (file.existsSync()) loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
    }
    await loader.load();
  }
}

/// Real network, but read-only: refuses every write except sign-in, and shows the account in
/// [lang] locally by rewriting user.language in /api/me and /api/auth/verify responses.
class _ReadOnlyClient extends http.BaseClient {
  final _inner = http.Client();
  String lang = 'en';

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final path = request.url.path;
    if (request.method != 'GET' && path != '/api/auth/verify') {
      return http.StreamedResponse(Stream.value(utf8.encode('{"error":"read-only screenshot run"}')), 403, request: request);
    }
    final res = await _inner.send(request);
    if (path != '/api/me' && path != '/api/auth/verify') return res;
    final body = await res.stream.bytesToString();
    var out = body;
    try {
      final j = jsonDecode(body);
      if (j is Map && j['user'] is Map) {
        (j['user'] as Map)['language'] = lang;
        out = jsonEncode(j);
      }
    } catch (_) {}
    return http.StreamedResponse(Stream.value(utf8.encode(out)), res.statusCode, headers: res.headers, request: request);
  }
}

final _client = _ReadOnlyClient();

class _Env {
  _Env(this.services, this.requirementId);
  final AppServices services;
  final String? requirementId;
}

Future<_Env> _signIn() async {
  final api = ApiClient(client: _client);
  final r = asMap(await api.post('/api/auth/verify', {'phone': '9000000001', 'otp': '123456'}));
  final session = SessionStore(api);
  await session.apply(r, newToken: asStr(r['token']));
  final services = AppServices(api: api, session: session, i18n: I18n(), engine: ChatEngine.instance);
  final req = asMap(await api.get('/api/requirements?limit=6'));
  final list = asMapList(req['requirements']);
  return _Env(services, list.isEmpty ? null : asStr(list.first['id']));
}

Future<void> _setLang(AppServices s, String lang) async {
  _client.lang = lang;
  await s.session.updateUser(language: lang); // local only
  await s.i18n.load(lang);
}

Widget _wrap(AppServices s, Widget child) => AppScope(
      services: s,
      child: I18nScope(
        i18n: s.i18n,
        child: MaterialApp(debugShowCheckedModeBanner: false, theme: buildAppTheme(), home: child),
      ),
    );

/// Lets real network I/O finish, then settles frames.
Future<void> _settle(WidgetTester t, {int seconds = 4}) async {
  for (var i = 0; i < seconds * 2; i++) {
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
    await t.pump(const Duration(milliseconds: 100));
  }
}

ChatMessage _msg(String id, String type, Map<String, dynamic> content, {bool mine = false, String sender = claireId}) =>
    ChatMessage(id: id, channel: ChatChannel.claire, senderId: mine ? 'u_amit' : sender, type: type, content: content, sentAt: DateTime.now().millisecondsSinceEpoch, mine: mine);

Widget _cardGallery(AppServices s, String title, List<ChatMessage> msgs) {
  final ctx = CardCtx(
    myUserId: s.session.user?.id ?? 'u_amit',
    myBusinessId: s.session.user?.businessId ?? 'b_amit',
    lang: s.i18n.lang,
    api: s.api,
    chip: (_, _) async {},
    openDeal: (_, {requirementId, listingId}) async {},
    openConversation: (_) {},
    openResults: (_) {},
    refresh: () {},
  );
  return Builder(
    builder: (context) => Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final m in msgs)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: m.type == rcText
                  ? MessageBubble(text: asStr(m.content['text']), mine: m.mine, sentAt: m.sentAt)
                  : CardRenderer(message: m, ctx: ctx),
            ),
        ],
      ),
    ),
  );
}

List<ChatMessage> _claireTurn(String ask) => [
      _msg('1', rcText, {'text': ask}, mine: true),
      _msg('2', ccCard, {
        'kind': 'chips',
        'text': 'Which size range do you need?',
        'chips': [
          {'id': 'size:s_xxl', 'label': 'S to XXL'},
          {'id': 'size:m_xl', 'label': 'M to XL'},
          {'id': 'size:kids', 'label': 'Kids sizes'},
        ],
      }),
      _msg('3', ccCard, {
        'kind': 'results',
        'requirementId': 'rq_demo',
        'title': 'Cotton T-shirts',
        'unit': 'piece',
        'singles': [
          {
            'kind': 'single', 'avgPrice': 112, 'total': 56000, 'readyDays': 4, 'trust': 92, 'badges': ['GST verified', 'On time'],
            'art': {'shape': 'tshirt', 'color': '#1F8C73'},
            'lines': [{'listingId': 'l_1', 'businessId': 'b_lakshmi', 'businessName': 'Lakshmi Knits', 'qty': 500, 'unitPrice': 112, 'readyDays': 4}],
          },
          {
            'kind': 'single', 'avgPrice': 118, 'total': 59000, 'readyDays': 2, 'trust': 88, 'badges': ['GST verified'],
            'art': {'shape': 'tshirt', 'color': '#13203B'},
            'lines': [{'listingId': 'l_2', 'businessId': 'b_sree', 'businessName': 'Sree Textiles', 'qty': 500, 'unitPrice': 118, 'readyDays': 2}],
          },
        ],
        'combos': [],
        'mto': [],
      }),
    ];

List<ChatMessage> _dealCards() => [
      _msg('o1', ccCard, {
        'kind': 'offer', 'offerId': 'of_1', 'fromBusinessId': 'b_sree', 'fromName': 'Sree Textiles', 'title': 'Cotton T-shirts',
        'qty': 500, 'unit': 'piece', 'unitPrice': 115, 'total': 57500, 'dispatchDays': 5, 'advancePct': 30, 'creditDays': 0,
        'freight': 'to_pay', 'status': 'pending', 'parentPrice': 120,
      }, sender: 'u_sree'),
      _msg('o2', ccCard, {
        'kind': 'order', 'orderId': 'o_1', 'code': 'CC-26-00001', 'title': 'Cotton T-shirts', 'qty': 500, 'unit': 'piece',
        'unitPrice': 115, 'total': 57500, 'status': 'confirmed', 'buyerBusinessId': 'b_amit', 'sellerBusinessId': 'b_sree',
        'buyerName': 'Amit Hosiery', 'sellerName': 'Sree Textiles', 'advancePct': 30, 'creditDays': 0, 'gstPct': 5,
      }, sender: claireId),
    ];

final _errors = <FlutterErrorDetails>[];

void main() {
  late _Env env;
  final out = Directory('screenshots/render')..createSync(recursive: true);

  setUpAll(() async {
    HttpOverrides.global = null; // real network to the live server
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    AppFonts.useGoogleFonts = false;
    await _loadFonts();
    env = await _signIn();
  });

  for (final lang in ['en', 'ta', 'te', 'hi', 'kn', 'ml', 'bn', 'or', 'mr', 'gu']) {
    testWidgets('screens in $lang', (t) async {
      t.view.physicalSize = const Size(1179, 2556); // iPhone 15/16 class, 393×852 pt
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      final s = env.services;
      await _setLang(s, lang);
      final prev = FlutterError.onError;
      FlutterError.onError = _errors.add; // logged per screenshot instead of failing the run
      addTearDown(() => FlutterError.onError = prev);

      Future<void> snap(String name) async {
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('../screenshots/render/${lang}_$name.png'));
        for (final e in _errors) {
          stdout.writeln('LAYOUT $lang/$name: ${e.exceptionAsString().split('\n').first}');
        }
        _errors.clear();
      }

      Future<void> shot(String name, Widget w, {int seconds = 4}) async {
        await t.pumpWidget(_wrap(s, w));
        await _settle(t, seconds: seconds);
        await snap(name);
      }

      Future<void> tab(String name, String key, {int seconds = 4}) async {
        await t.tap(find.text(s.i18n.t(key)).last);
        await _settle(t, seconds: seconds);
        await snap(name);
      }

      final full = lang == 'en' || lang == 'ta' || lang == 'te';
      await shot('home', const ShellScreen());
      if (full) {
        await tab('inbox', 'nav.chats', seconds: 6);
        await tab('orders', 'nav.orders', seconds: 12);
        await tab('profile', 'nav.profile');
      }
      if (env.requirementId != null) await shot('results', ResultsScreen(requirementId: env.requirementId!), seconds: 6);
      await shot('claire_cards', Builder(builder: (c) => _cardGallery(s, c.t('claire.title'), _claireTurn(c.t('home.ex1')))), seconds: 1);
      if (full) {
        await shot('deal_cards', Builder(builder: (c) => _cardGallery(s, 'Sree Textiles', _dealCards())), seconds: 1);
        await shot('language', const LanguageScreen(localOnly: true), seconds: 1);
        await shot('login', const LoginScreen());
      }
      await t.pumpWidget(const SizedBox());
      await t.pump(const Duration(minutes: 2)); // let shell/chat retry timers run out
    });
  }

  tearDownAll(() => stdout.writeln('screenshots in ${out.path}'));
}
