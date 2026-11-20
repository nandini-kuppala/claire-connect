import 'dart:convert';
import 'dart:io';

import 'package:claire_connect/cards/format.dart';
import 'package:claire_connect/i18n/i18n.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('I18n.fill', () {
    test('replaces placeholders', () {
      expect(I18n.fill("Hi {name}! I'm Claire", {'name': 'Amit'}), "Hi Amit! I'm Claire");
      expect(I18n.fill('{n} suppliers · from {price}/{unit}', {'n': 3, 'price': '₹149', 'unit': 'pc'}), '3 suppliers · from ₹149/pc');
    });

    test('leaves unknown placeholders and handles null values', () {
      expect(I18n.fill('Sent to {phone}', {'other': 1}), 'Sent to {phone}');
      expect(I18n.fill('Offer {price}', {'price': null}), 'Offer ');
      expect(I18n.fill('No vars {x}'), 'No vars {x}');
    });
  });

  group('I18n tables', () {
    test('nested JSON flattens to dotted keys', () {
      final t = I18n.parseTable('{"home": {"hi": "Hi", "deep": {"x": "y"}}, "top": 1}');
      expect(t, {'home.hi': 'Hi', 'home.deep.x': 'y', 'top': '1'});
    });

    test('falls back to English, then to the key', () {
      final i = I18n.fromTables(
        en: {'home.hi': 'Hi {name}', 'nav.home': 'Home'},
        current: {'home.hi': 'வணக்கம் {name}'},
        lang: 'ta',
      );
      expect(i.t('home.hi', {'name': 'Ravi'}), 'வணக்கம் Ravi');
      expect(i.t('nav.home'), 'Home');
      expect(i.t('missing.key'), 'missing.key');
      expect(i.lang, 'ta');
    });

    test('en.json is valid and has the core keys', () {
      final raw = File('assets/i18n/en.json').readAsStringSync();
      final table = I18n.parseTable(raw);
      expect(jsonDecode(raw), isA<Map>());
      for (final k in ['home.hi_name', 'login.explore', 'nav.chats', 'chat.translated_show_original', 'offer.accept', 'order.a_dispatched']) {
        expect(table.containsKey(k), isTrue, reason: k);
      }
      expect(I18n.fill(table['home.hi_name']!, {'name': 'Lakshmi'}), "Hi Lakshmi! I'm Claire");
    });
  });

  test('server trust badges map to i18n keys', () {
    expect(badgeKey('GST verified')?.key, 'badge.gst_verified');
    expect(badgeKey('Replies in < 10 min')?.key, 'badge.fast_reply');
    final r = badgeKey('4 repeat buyers');
    expect(r?.key, 'badge.repeat_buyers');
    expect(r?.n, 4);
    expect(badgeKey('Something new'), isNull);
  });
}
