// Every language file must carry every English key, with the same {placeholders},
// and must not keep English text where a translation is expected.
import 'dart:io';

import 'package:claire_connect/i18n/i18n.dart';
import 'package:claire_connect/i18n/languages.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, String> _table(String lang) => I18n.parseTable(File('assets/i18n/$lang.json').readAsStringSync());

List<String> _placeholders(String s) => RegExp(r'\{(\w+)\}').allMatches(s).map((m) => m.group(1)!).toList()..sort();

/// Keys whose value is legitimately identical in every language (names and pure formats).
const _sameAsEnglish = {'claire.title', 'inbox.claire', 'inbox.updates', 'results.max_price', 'order.dispatch_line'};

/// Terms that stay in Latin script in every language.
const _keepAsIs = ['CLAIRE', 'Claire', 'Nexconn', 'GST', 'OTP', 'GSM', '₹'];

void main() {
  final en = _table('en');
  final langs = kLanguages.map((l) => l.code).where((c) => c != 'en').toList();

  test('there is a file for each of the 9 other app languages', () {
    expect(langs, hasLength(9));
    for (final lang in langs) {
      expect(File('assets/i18n/$lang.json').existsSync(), isTrue, reason: lang);
    }
  });

  for (final lang in langs) {
    group(lang, () {
      final t = _table(lang);

      test('has exactly the English keys', () {
        expect(en.keys.toSet().difference(t.keys.toSet()), isEmpty, reason: 'missing in $lang');
        expect(t.keys.toSet().difference(en.keys.toSet()), isEmpty, reason: 'extra in $lang');
      });

      test('keeps identical placeholders', () {
        for (final k in en.keys) {
          expect(_placeholders(t[k] ?? ''), _placeholders(en[k]!), reason: '$lang:$k');
        }
      });

      test('is translated and keeps brand and trade terms', () {
        for (final k in en.keys) {
          final v = t[k] ?? '';
          expect(v.trim(), isNotEmpty, reason: '$lang:$k');
          if (!_sameAsEnglish.contains(k)) expect(v, isNot(en[k]), reason: 'untranslated $lang:$k');
          for (final term in _keepAsIs) {
            if (en[k]!.contains(term)) expect(v, contains(term), reason: '$lang:$k should keep $term');
          }
        }
      });
    });
  }
}
