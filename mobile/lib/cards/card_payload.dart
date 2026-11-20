// Typed CLAIRE custom-message payloads (shared/cards.ts). Parsing is lenient: values may arrive as
// strings (iOS custom-message fields) and missing fields get safe defaults, so one odd card never
// breaks a chat.
import '../api/json.dart';

class ChipItem {
  const ChipItem({required this.id, required this.label, this.sub, this.primary = false});
  factory ChipItem.fromJson(Map<String, dynamic> j) =>
      ChipItem(id: asStr(j['id']), label: asStr(j['label']), sub: asStrOrNull(j['sub']), primary: asBool(j['primary']));
  final String id;
  final String label;
  final String? sub;
  final bool primary;
}

class TileItem {
  const TileItem({required this.id, required this.label, required this.shape, required this.color});
  factory TileItem.fromJson(Map<String, dynamic> j) =>
      TileItem(id: asStr(j['id']), label: asStr(j['label']), shape: asStr(j['shape'], 'tshirt'), color: asStr(j['color'], '#1F8C73'));
  final String id;
  final String label;
  final String shape;
  final String color;
}

class MatchLine {
  const MatchLine({
    required this.listingId,
    required this.businessId,
    required this.businessName,
    required this.qty,
    required this.unitPrice,
    required this.readyDays,
    this.listingTitle,
    this.stock,
    this.unit,
    this.supplier,
  });
  factory MatchLine.fromJson(Map<String, dynamic> j) => MatchLine(
        listingId: asStr(j['listingId']),
        businessId: asStr(j['businessId']),
        businessName: asStr(j['businessName']),
        qty: asDouble(j['qty']),
        unitPrice: asDouble(j['unitPrice']),
        readyDays: asInt(j['readyDays']),
        listingTitle: asStrOrNull(j['listingTitle']),
        stock: asNumOrNull(j['stock']),
        unit: asStrOrNull(j['unit']),
        supplier: asMapOrNull(j['supplier']),
      );
  final String listingId;
  final String businessId;
  final String businessName;
  final double qty;
  final double unitPrice;
  final int readyDays;
  final String? listingTitle;
  final num? stock;
  final String? unit;

  /// Supplier facts (results API only): city, ratingAvg, orders, badges, isNew…
  final Map<String, dynamic>? supplier;

  Map<String, dynamic> toJson() => {
        'listingId': listingId,
        'businessId': businessId,
        'businessName': businessName,
        'qty': qty,
        'unitPrice': unitPrice,
        'readyDays': readyDays,
      };
}

class MatchCardData {
  const MatchCardData({
    required this.kind,
    required this.lines,
    required this.avgPrice,
    required this.total,
    required this.readyDays,
    required this.trust,
    required this.badges,
    this.key,
    this.shape,
    this.rating,
    this.stock,
    this.onTimePct,
  });
  factory MatchCardData.fromJson(Map<String, dynamic> j) {
    final art = asMap(j['art']);
    return MatchCardData(
      kind: asStr(j['kind'], 'single'),
      lines: asMapList(j['lines']).map(MatchLine.fromJson).toList(),
      avgPrice: asDouble(j['avgPrice']),
      total: asDouble(j['total']),
      readyDays: asInt(j['readyDays']),
      trust: asInt(j['trust']),
      badges: asStrList(j['badges']),
      key: asStrOrNull(j['key']),
      shape: asStrOrNull(art['shape']),
      rating: asNumOrNull(j['rating']),
      stock: asNumOrNull(j['stock']),
      onTimePct: asNumOrNull(j['onTimePct']),
    );
  }
  final String kind;
  final List<MatchLine> lines;
  final double avgPrice;
  final double total;
  final int readyDays;
  final int trust;
  final List<String> badges;
  final String? key;
  final String? shape;
  final num? rating;
  final num? stock;
  final num? onTimePct;
}

class OrderItem {
  const OrderItem({required this.orderId, required this.code, required this.title, required this.status, required this.total, required this.counterpart, this.conversationId});
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        orderId: asStr(j['orderId']),
        code: asStr(j['code']),
        title: asStr(j['title']),
        status: asStr(j['status']),
        total: asDouble(j['total']),
        counterpart: asStr(j['counterpart']),
        conversationId: asStrOrNull(j['conversationId']),
      );
  final String orderId;
  final String code;
  final String title;
  final String status;
  final double total;
  final String counterpart;
  final String? conversationId;
}

sealed class CardPayload {
  const CardPayload();
  String get kind;

  static CardPayload parse(Map<String, dynamic> j) {
    final kind = asStr(j['kind']);
    switch (kind) {
      case 'chips':
        return ChipsCard(
          text: asStr(j['text']),
          chips: asMapList(j['chips']).map(ChipItem.fromJson).where((c) => c.id.isNotEmpty).toList(),
          hint: asStrOrNull(j['hint']),
          grid: asStr(j['layout']) == 'grid',
        );
      case 'tiles':
        return TilesCard(text: asStr(j['text']), tiles: asMapList(j['tiles']).map(TileItem.fromJson).toList());
      case 'summary':
        return SummaryCard(title: asStr(j['title']), lines: asStrList(j['lines']));
      case 'notice':
        return NoticeCard(text: asStr(j['text']), tone: asStr(j['tone'], 'info'));
      case 'results':
        List<MatchCardData> list(Object? v) => asMapList(v).map(MatchCardData.fromJson).toList();
        return ResultsCard(
          requirementId: asStr(j['requirementId']),
          title: asStr(j['title']),
          singles: list(j['singles']),
          combos: list(j['combos']),
          mto: list(j['mto']),
          note: asStrOrNull(j['note']),
        );
      case 'orders':
        return OrdersCard(text: asStr(j['text']), items: asMapList(j['items']).map(OrderItem.fromJson).toList());
      case 'offer':
        return OfferCard.fromJson(j);
      case 'order':
        return OrderCard.fromJson(j);
      case 'requirement':
        return RequirementCard(
          requirementId: asStr(j['requirementId']),
          title: asStr(j['title']),
          qty: asDouble(j['qty']),
          unit: asStr(j['unit'], 'piece'),
          budget: asNumOrNull(j['budget']),
          deadlineDays: asIntOrNull(j['deadlineDays']),
          city: asStrOrNull(j['city']),
          buyerName: asStr(j['buyerName']),
          buyerTrust: asInt(j['buyerTrust']),
        );
      case 'carousel':
        return CarouselCard(text: asStr(j['text']), items: asMapList(j['items']));
      default:
        return OtherCard(kind: kind, text: asStr(j['text'] ?? j['title'] ?? j['outcome']), raw: j);
    }
  }
}

class ChipsCard extends CardPayload {
  const ChipsCard({required this.text, required this.chips, this.hint, this.grid = false});
  @override
  String get kind => 'chips';
  final String text;
  final List<ChipItem> chips;
  final String? hint;
  final bool grid;
}

class TilesCard extends CardPayload {
  const TilesCard({required this.text, required this.tiles});
  @override
  String get kind => 'tiles';
  final String text;
  final List<TileItem> tiles;
}

class SummaryCard extends CardPayload {
  const SummaryCard({required this.title, required this.lines});
  @override
  String get kind => 'summary';
  final String title;
  final List<String> lines;
}

class NoticeCard extends CardPayload {
  const NoticeCard({required this.text, this.tone = 'info'});
  @override
  String get kind => 'notice';
  final String text;
  final String tone;
}

class ResultsCard extends CardPayload {
  const ResultsCard({required this.requirementId, required this.title, required this.singles, required this.combos, required this.mto, this.note});
  @override
  String get kind => 'results';
  final String requirementId;
  final String title;
  final List<MatchCardData> singles;
  final List<MatchCardData> combos;
  final List<MatchCardData> mto;
  final String? note;

  List<MatchCardData> get all => [...singles, ...combos, ...mto];
  int get sellerCount => all.expand((m) => m.lines.map((l) => l.businessId)).toSet().length;
}

class OrdersCard extends CardPayload {
  const OrdersCard({required this.text, required this.items});
  @override
  String get kind => 'orders';
  final String text;
  final List<OrderItem> items;
}

class OfferCard extends CardPayload {
  const OfferCard({
    required this.offerId,
    required this.fromBusinessId,
    required this.fromName,
    required this.title,
    required this.qty,
    required this.unit,
    required this.unitPrice,
    required this.total,
    required this.dispatchDays,
    required this.advancePct,
    required this.creditDays,
    required this.freight,
    required this.status,
    this.parentPrice,
  });
  factory OfferCard.fromJson(Map<String, dynamic> j) => OfferCard(
        offerId: asStr(j['offerId']),
        fromBusinessId: asStr(j['fromBusinessId']),
        fromName: asStr(j['fromName']),
        title: asStr(j['title']),
        qty: asDouble(j['qty']),
        unit: asStr(j['unit'], 'piece'),
        unitPrice: asDouble(j['unitPrice']),
        total: asDouble(j['total']),
        dispatchDays: asInt(j['dispatchDays']),
        advancePct: asInt(j['advancePct']),
        creditDays: asInt(j['creditDays']),
        freight: asStr(j['freight']),
        status: asStr(j['status'], 'pending'),
        parentPrice: asNumOrNull(j['parentPrice'])?.toDouble(),
      );
  @override
  String get kind => 'offer';
  final String offerId;
  final String fromBusinessId;
  final String fromName;
  final String title;
  final double qty;
  final String unit;
  final double unitPrice;
  final double total;
  final int dispatchDays;
  final int advancePct;
  final int creditDays;
  final String freight;
  final String status;
  final double? parentPrice;

  bool get isCounter => parentPrice != null;
}

class OrderCard extends CardPayload {
  const OrderCard({
    required this.orderId,
    required this.code,
    required this.title,
    required this.qty,
    required this.unit,
    required this.unitPrice,
    required this.total,
    required this.status,
    required this.buyerBusinessId,
    required this.sellerBusinessId,
    required this.buyerName,
    required this.sellerName,
    required this.advancePct,
    required this.creditDays,
    required this.gstPct,
    this.advancePaid,
    this.toConfirm,
    this.transporter,
    this.lr,
  });
  factory OrderCard.fromJson(Map<String, dynamic> j) {
    final dispatch = asMap(j['dispatch']);
    return OrderCard(
      orderId: asStr(j['orderId']),
      code: asStr(j['code']),
      title: asStr(j['title']),
      qty: asDouble(j['qty']),
      unit: asStr(j['unit'], 'piece'),
      unitPrice: asDouble(j['unitPrice']),
      total: asDouble(j['total']),
      status: asStr(j['status'], 'confirmed'),
      buyerBusinessId: asStr(j['buyerBusinessId']),
      sellerBusinessId: asStr(j['sellerBusinessId']),
      buyerName: asStr(j['buyerName']),
      sellerName: asStr(j['sellerName']),
      advancePct: asInt(j['advancePct']),
      creditDays: asInt(j['creditDays']),
      gstPct: asDouble(j['gstPct']),
      advancePaid: j['advancePaid'] == null ? null : asBool(j['advancePaid']),
      toConfirm: asStrOrNull(j['toConfirm']),
      transporter: asStrOrNull(dispatch['transporter']),
      lr: asStrOrNull(dispatch['lr']),
    );
  }
  @override
  String get kind => 'order';
  final String orderId;
  final String code;
  final String title;
  final double qty;
  final String unit;
  final double unitPrice;
  final double total;
  final String status;
  final String buyerBusinessId;
  final String sellerBusinessId;
  final String buyerName;
  final String sellerName;
  final int advancePct;
  final int creditDays;
  final double gstPct;
  final bool? advancePaid;
  final String? toConfirm;
  final String? transporter;
  final String? lr;

  double get grandTotal => total + (total * gstPct / 100).roundToDouble();
  bool get advanceIsPaid => advancePaid ?? (status != 'confirmed' && advancePct > 0);
}

class RequirementCard extends CardPayload {
  const RequirementCard({
    required this.requirementId,
    required this.title,
    required this.qty,
    required this.unit,
    required this.buyerName,
    required this.buyerTrust,
    this.budget,
    this.deadlineDays,
    this.city,
  });
  @override
  String get kind => 'requirement';
  final String requirementId;
  final String title;
  final double qty;
  final String unit;
  final num? budget;
  final int? deadlineDays;
  final String? city;
  final String buyerName;
  final int buyerTrust;
}

class CarouselCard extends CardPayload {
  const CarouselCard({required this.text, required this.items});
  @override
  String get kind => 'carousel';
  final String text;
  final List<Map<String, dynamic>> items;
}

/// Kinds the phone app shows as a simple line (rating, agent_joined, resolved, profile, job_split…).
class OtherCard extends CardPayload {
  const OtherCard({required this.kind, required this.text, required this.raw});
  @override
  final String kind;
  final String text;
  final Map<String, dynamic> raw;
}

class HintPayload {
  const HintPayload({required this.text, this.actionLabel, this.actionChipId});
  factory HintPayload.fromJson(Map<String, dynamic> j) {
    final a = asMap(j['action']);
    return HintPayload(text: asStr(j['text']), actionLabel: asStrOrNull(a['label']), actionChipId: asStrOrNull(a['chipId']));
  }
  final String text;
  final String? actionLabel;
  final String? actionChipId;

  /// `offer:90` / `counter:90` / `quote:90` → the draft Claire suggests sending.
  ({String kind, double price})? get draft {
    final m = RegExp(r'^(offer|counter|quote):(\d+(?:\.\d+)?)$').firstMatch(actionChipId ?? '');
    if (m == null) return null;
    final p = double.parse(m.group(2)!);
    return p > 0 ? (kind: m.group(1)!, price: p) : null;
  }
}
