// App-wide services handed down the tree: API client, session, strings, chat engine, translator.
import 'dart:async';

import 'package:flutter/widgets.dart';

import 'api/api_client.dart';
import 'chat/chat_engine.dart';
import 'chat/translator.dart';
import 'i18n/i18n.dart';
import 'session/session_store.dart';

class AppServices {
  AppServices({required this.api, required this.session, required this.i18n, required this.engine}) : translator = Translator(api);

  final ApiClient api;
  final SessionStore session;
  final I18n i18n;
  final ChatEngine engine;
  final Translator translator;

  static AppServices of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope missing');
    return scope!.services;
  }

  /// Connects the Nexconn engine with the token from /api/me (refreshing it once on failure).
  Future<void> ensureChat() async {
    final user = session.user;
    final creds = session.chat;
    if (user == null || creds == null) throw ChatException(-5, 'not signed in');
    try {
      await engine.connect(creds, userId: user.id, language: user.language);
    } on ChatException {
      // The cached token may be stale: fetch a fresh one and try once more.
      await session.refreshMe();
      final fresh = session.chat;
      if (fresh == null) rethrow;
      await engine.connect(fresh, userId: user.id, language: session.language);
    }
  }

  Future<void> setLanguage(String lang) async {
    await api.patch('/api/me', {'language': lang});
    await session.updateUser(language: lang);
    await i18n.load(lang);
    engine.setTranslationLanguage(lang);
  }

  Future<void> logout() async {
    unawaited(engine.disconnect());
    await session.logout();
  }
}

class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.services, required super.child});
  final AppServices services;
  @override
  bool updateShouldNotify(AppScope oldWidget) => oldWidget.services != services;
}
