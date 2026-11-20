import 'package:flutter/widgets.dart';

import 'api/api_client.dart';
import 'app.dart';
import 'app_services.dart';
import 'chat/chat_engine.dart';
import 'i18n/i18n.dart';
import 'session/session_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionStore(api);
  final i18n = I18n();
  await session.load();
  await i18n.load(session.language);
  final services = AppServices(api: api, session: session, i18n: i18n, engine: ChatEngine.instance);
  api.onUnauthorized = () => services.logout();
  runApp(ClaireApp(services: services));
}
