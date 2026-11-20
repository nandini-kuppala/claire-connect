import 'dart:convert';

import 'package:claire_connect/cards/card_payload.dart';
import 'package:claire_connect/cards/format.dart';
import 'package:claire_connect/chat/chat_controller.dart';
import 'package:claire_connect/chat/chat_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeContent', () {
    test('server REST content arrives as a JSON string', () {
      final c = normalizeContent(ccCard, jsonEncode({'kind': 'notice', 'text': 'Advance received', 'tone': 'success'}));
      expect(c['kind'], 'notice');
      expect(c['tone'], 'success');
    });

    test('unwraps a single {content: "<json>"} wrapper', () {
      final c = normalizeContent(ccHint, {'content': jsonEncode({'text': 'Ask for ₹91', 'action': {'label': 'Offer ₹91', 'chipId': 'offer:91'}})});
      expect(c['text'], 'Ask for ₹91');
      expect(HintPayload.fromJson(c).draft, (kind: 'offer', price: 91.0));
    });

    test('decodes nested JSON strings from native custom-message fields', () {
      final c = normalizeContent(ccCard, {
        'kind': 'chips',
        'text': 'How many pieces?',
        'chips': jsonEncode([
          {'id': 'qty:500', 'label': '500'},
          {'id': 'qty:1000', 'label': '1,000', 'primary': 'true'},
        ]),
      });
      final p = CardPayload.parse(c) as ChipsCard;
      expect(p.chips.map((e) => e.id), ['qty:500', 'qty:1000']);
      expect(p.chips.last.primary, isTrue);
    });

    test('text messages accept text or content', () {
      expect(normalizeContent(rcText, {'content': 'hello'})['text'], 'hello');
      expect(normalizeContent(rcText, 'plain')['text'], 'plain');
    });
  });

  group('CardPayload.parse', () {
    test('results card with string numbers (iOS fields)', () {
      final p = CardPayload.parse({
        'kind': 'results',
        'requirementId': 'rq_1',
        'title': 'Track pants',
        'singles': [
          {
            'kind': 'single',
            'avgPrice': '168',
            'total': '168000',
            'readyDays': '3',
            'trust': '94',
            'badges': ['GST verified'],
            'art': {'shape': 'trackpants', 'color': '#1F2A44'},
            'lines': [
              {'listingId': 'l_001', 'businessId': 'b_sree', 'businessName': 'Sree Textiles', 'qty': 1000, 'unitPrice': 168, 'readyDays': 3},
            ],
          },
        ],
        'combos': [],
        'mto': [],
      }) as ResultsCard;
      expect(p.all.single.avgPrice, 168);
      expect(p.all.single.trust, 94);
      expect(p.all.single.lines.single.businessName, 'Sree Textiles');
      expect(p.sellerCount, 1);
      expect(unitFromShape(p.all.single.shape), 'piece');
    });

    test('offer and order cards', () {
      final offer = CardPayload.parse({
        'kind': 'offer', 'offerId': 'of_1', 'fromBusinessId': 'b_sree', 'fromName': 'Sree Textiles', 'title': 'Track pants',
        'qty': 1000, 'unit': 'piece', 'unitPrice': 92, 'total': 92000, 'dispatchDays': 5, 'advancePct': 30, 'creditDays': 0,
        'freight': 'to_pay', 'status': 'pending', 'parentPrice': 95,
      }) as OfferCard;
      expect(offer.isCounter, isTrue);
      expect(offer.unitPrice - offer.parentPrice!, -3);

      final order = CardPayload.parse({
        'kind': 'order', 'orderId': 'o_1', 'code': 'CC-26-00001', 'title': 'Track pants', 'qty': 1000, 'unit': 'piece',
        'unitPrice': 100, 'total': 100000, 'status': 'confirmed', 'buyerBusinessId': 'b_amit', 'sellerBusinessId': 'b_sree',
        'buyerName': 'Amit Hosiery', 'sellerName': 'Sree Textiles', 'advancePct': 30, 'creditDays': 0, 'gstPct': 5, 'ewayBill': true,
      }) as OrderCard;
      expect(order.grandTotal, 105000);
      expect(order.advanceIsPaid, isFalse);
    });

    test('unknown kinds become OtherCard instead of throwing', () {
      final p = CardPayload.parse({'kind': 'something_new', 'text': 'Hello'});
      expect(p, isA<OtherCard>());
      expect((p as OtherCard).text, 'Hello');
    });
  });

  group('chat list helpers', () {
    ChatMessage msg(String id, int at, {String type = rcText, Map<String, dynamic>? content, bool mine = false, SendStatus status = SendStatus.sent, String? localId}) => ChatMessage(
          id: id,
          channel: ChatChannel.claire,
          senderId: mine ? 'u_me' : claireId,
          type: type,
          content: content ?? {'text': 'm$id'},
          sentAt: at,
          mine: mine,
          status: status,
          localId: localId,
        );

    test('upsert replaces the optimistic copy and keeps order', () {
      var list = [msg('a', 1), msg('local_1', 5, mine: true, status: SendStatus.sending, content: {'text': 'hi'})];
      list = upsertMessage(list, msg('srv1', 4, mine: true, content: {'text': 'hi'}, localId: 'local_1'));
      expect(list.map((m) => m.id), ['a', 'srv1']);
      expect(list.last.status, SendStatus.sent);
      list = upsertMessage(list, msg('b', 2));
      expect(list.map((m) => m.id), ['a', 'b', 'srv1']);
    });

    test('visible keeps only the newest card per order', () {
      final order = {'kind': 'order', 'orderId': 'o_1'};
      final list = [
        msg('1', 1, type: ccCard, content: {...order, 'status': 'confirmed'}),
        msg('2', 2),
        msg('3', 3, type: ccCard, content: {...order, 'status': 'dispatched'}),
        msg('4', 4, type: 'RC:GrpNtf', content: {}),
      ];
      expect(visibleMessages(list).map((m) => m.id), ['2', '3']);
    });
  });

  group('format', () {
    test('Indian grouping and rupees', () {
      expect(groupIndian(1234567), '12,34,567');
      expect(inr(168000), '₹1,68,000');
      expect(inr(167.8), '₹167.8');
      expect(inr(null), '—');
    });

    test('cleanLabel strips leading emoji', () {
      expect(cleanLabel('🧵 Fabric'), 'Fabric');
      expect(cleanLabel('T-shirts'), 'T-shirts');
    });
  });
}
