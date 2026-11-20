// UI strings from assets/i18n/<lang>.json with English fallback and {placeholder} replacement.
// Follows the signed-in user's language (from /api/me); signed-out screens can pick one too.
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../cards/format.dart' show badgeKey;

class I18n extends ChangeNotifier {
  I18n({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  /// Builds an instance from in-memory tables (tests, previews).
  I18n.fromTables({required Map<String, String> en, Map<String, String>? current, this._lang = 'en'})
      : _bundle = rootBundle,
        _en = en,
        _cur = current ?? en;

  final AssetBundle _bundle;
  Map<String, String> _en = const {};
  Map<String, String> _cur = const {};
  String _lang = 'en';

  String get lang => _lang;

  Future<void> load(String lang) async {
    if (_en.isEmpty) _en = await _read('en');
    Map<String, String> cur = _en;
    if (lang != 'en') {
      try {
        cur = await _read(lang);
      } catch (_) {
        cur = const {}; // no file for this language yet: English fallback
      }
    }
    _cur = cur;
    _lang = lang;
    notifyListeners();
  }

  Future<Map<String, String>> _read(String lang) async {
    final raw = await _bundle.loadString('assets/i18n/$lang.json');
    return parseTable(raw);
  }

  /// Flattens a JSON object into dotted keys: {"home": {"hi": "…"}} → {"home.hi": "…"}.
  static Map<String, String> parseTable(String raw) {
    final out = <String, String>{};
    void walk(String prefix, Object? v) {
      if (v is Map) {
        v.forEach((k, val) => walk(prefix.isEmpty ? '$k' : '$prefix.$k', val));
      } else if (v != null) {
        out[prefix] = '$v';
      }
    }

    walk('', jsonDecode(raw));
    return out;
  }

  /// Replaces {name} placeholders; unknown placeholders are left as they are.
  static String fill(String template, [Map<String, Object?>? vars]) {
    if (vars == null || vars.isEmpty) return template;
    return template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
      final k = m.group(1)!;
      return vars.containsKey(k) ? '${vars[k] ?? ''}' : m.group(0)!;
    });
  }

  bool has(String key) => _cur.containsKey(key) || _en.containsKey(key);

  String t(String key, [Map<String, Object?>? vars]) => fill(_cur[key] ?? _en[key] ?? key, vars);

  static I18n of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<I18nScope>();
    assert(scope != null, 'I18nScope missing above this context');
    return scope!.notifier!;
  }
}

class I18nScope extends InheritedNotifier<I18n> {
  const I18nScope({super.key, required I18n i18n, required super.child}) : super(notifier: i18n);
}

extension I18nContext on BuildContext {
  String t(String key, [Map<String, Object?>? vars]) => I18n.of(this).t(key, vars);
  I18n get i18n => I18n.of(this);

  /// Trust badge label from the server, in the user's language when we know it.
  String badge(String label) {
    final b = badgeKey(label);
    return b == null ? label : t(b.key, {'n': b.n});
  }
}
