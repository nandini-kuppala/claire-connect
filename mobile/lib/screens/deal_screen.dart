// Deal chat: Nexconn GroupChannel(conversation.channelId) shown like a 1-on-1 with the other
// business. Messages are translated for the reader; offers, orders and Claire's private tips are
// cards. After each SDK send the server is told via POST /api/deals/:id/inbound.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../cards/format.dart';
import '../chat/chat_controller.dart';
import '../chat/chat_models.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/cards/card_ctx.dart';
import '../widgets/cards/deal_cards.dart';
import '../widgets/chat_view.dart';
import '../widgets/ui.dart';
import 'nav.dart';

class DealScreen extends StatefulWidget {
  const DealScreen({super.key, required this.conversationId});
  final String conversationId;
  @override
  State<DealScreen> createState() => _DealScreenState();
}

class _DealScreenState extends State<DealScreen> {
  Map<String, dynamic>? _detail;
  Object? _error;
  ChatController? _controller;
  Timer? _refetch;
  bool _quickBusy = false;

  String get _id => widget.conversationId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _refetch?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final services = AppServices.of(context);
    try {
      final d = asMap(await services.api.get('/api/conversations/${Uri.encodeComponent(_id)}'));
      if (!mounted) return;
      setState(() {
        _detail = d;
        _error = null;
      });
      if (_controller == null) _startChat(services, d);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _startChat(AppServices services, Map<String, dynamic> d) {
    final conv = asMap(d['conversation']);
    final channelId = asStr(conv['channelId'], asStr(conv['channel_id'], _id));
    final theirLang = asStrOrNull(asMap(d['counterpart'])['language']);
    final myLang = services.session.language;
    final api = services.api;
    final c = ChatController(
      channel: ChatChannel.group(channelId),
      myLang: myLang,
      engine: services.engine,
      translator: services.translator,
      counterpartLang: theirLang,
      echoChips: false,
      prepare: services.ensureChat,
      onSend: (text, messageId) async => api.post('/api/deals/${Uri.encodeComponent(_id)}/inbound', {'text': text, 'lang': myLang, 'messageId': messageId}),
      onChip: (chipId, label, messageId) async {
        await api.post('/api/deals/${Uri.encodeComponent(_id)}/chip', {'chipId': chipId});
        _scheduleRefetch();
      },
    );
    // New offers / orders change live statuses: refresh the deal facts.
    c.onIncoming = (m) {
      if (m.type == ccCard) _scheduleRefetch();
    };
    setState(() => _controller = c);
    unawaited(c.start());
  }

  void _scheduleRefetch() {
    _refetch?.cancel();
    _refetch = Timer(const Duration(milliseconds: 700), _load);
  }

  // ── Deal facts ──────────────────────────────────────────────────────────
  List<Map<String, dynamic>> get _offers => asMapList(_detail?['offers']);
  String? get _side => asStrOrNull(asMap(_detail?['me'])['side']);

  DealInfo _dealInfo() {
    final req = asMapOrNull(_detail?['requirement']);
    final offers = _offers;
    final last = offers.isEmpty ? null : offers.last;
    final side = _side;
    Map<String, dynamic>? firstSeller;
    for (final o in offers) {
      final mine = asBool(o['mine']);
      if ((side == 'buyer' && !mine) || (side == 'seller' && mine)) {
        firstSeller = o;
        break;
      }
    }
    return DealInfo(
      qty: asNumOrNull(req?['qty'])?.toDouble() ?? asNumOrNull(last?['qty'])?.toDouble(),
      unit: asStrOrNull(req?['unit']) ?? asStrOrNull(last?['unit']),
      listedPrice: asNumOrNull(firstSeller?['unit_price'])?.toDouble(),
      side: side,
      offers: [
        for (final o in offers)
          DealOfferLite(
            id: asStr(o['id']),
            unitPrice: asDouble(o['unit_price']),
            qty: asDouble(o['qty']),
            status: asStr(o['status']),
            mine: asBool(o['mine']),
            createdAt: asInt(o['created_at']),
          ),
      ],
    );
  }

  Map<String, String> get _offerStatus => {for (final o in _offers) asStr(o['id']): asStr(o['status'])};

  // ── Actions ─────────────────────────────────────────────────────────────
  Future<void> _counter(String offerId, double current, String unit) async {
    final price = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PriceSheet(titleKey: 'deal.counter_title', initial: current, unit: unit),
    );
    if (price == null || !mounted) return;
    try {
      await AppServices.of(context).api.post('/api/offers/${Uri.encodeComponent(offerId)}/respond', {'action': 'counter', 'unitPrice': price});
      if (mounted) showToast(context, context.t('deal.counter_sent'));
      _scheduleRefetch();
    } catch (e) {
      if (mounted) showToast(context, errorText(context, e));
    }
  }

  Future<void> _quickCounter(double price) async {
    if (_quickBusy) return;
    setState(() => _quickBusy = true);
    try {
      await AppServices.of(context).api.post('/api/deals/${Uri.encodeComponent(_id)}/chip', {'chipId': 'counter:${_fmtPrice(price)}'});
      if (mounted) showToast(context, context.t('deal.counter_sent'));
      _scheduleRefetch();
    } catch (e) {
      if (mounted) showToast(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => _quickBusy = false);
    }
  }

  Future<void> _acceptOffer(Map<String, dynamic> o) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(c.t('offer.accept'), style: AppFonts.head(size: 18)),
        content: Text(c.t('offer.confirm_accept', {'price': inr(asNumOrNull(o['unit_price'])), 'total': inr(asDouble(o['unit_price']) * asDouble(o['qty']))}), style: AppFonts.body()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(c.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(c.t('offer.yes_accept'))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await AppServices.of(context).api.post('/api/offers/${Uri.encodeComponent(asStr(o['id']))}/respond', {'action': 'accept'});
      _scheduleRefetch();
    } catch (e) {
      if (mounted) showToast(context, errorText(context, e));
    }
  }

  Future<void> _makeOffer() async {
    final d = _dealInfo();
    final body = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _OfferSheet(qty: d.qty, price: d.theirPrice, unit: d.unit ?? 'piece'),
    );
    if (body == null || !mounted) return;
    final req = asMapOrNull(_detail?['requirement']);
    try {
      await AppServices.of(context).api.post('/api/offers', {'conversationId': _id, 'title': ?asStrOrNull(req?['title']), ...body});
      _scheduleRefetch();
    } catch (e) {
      if (mounted) showToast(context, errorText(context, e));
    }
  }

  static String _fmtPrice(double p) => p == p.roundToDouble() ? p.round().toString() : p.toStringAsFixed(1);

  /// One step under the counterpart's price: ₹92 → ₹91, ₹18.5 → ₹18.
  static double _stepDown(double p) => p >= 20 ? p.ceilToDouble() - 1 : ((p - 0.5) * 2).roundToDouble() / 2;

  // ── UI ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final d = _detail;
    final c = _controller;
    final cp = asMap(d?['counterpart']);
    final agent = asMapOrNull(d?['agent']);
    final names = <String, String>{claireId: 'Claire', if (agent != null) asStr(agent['id']): '${asStr(agent['name'])} · ${context.t('status.support')}'};

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: d == null
            ? null
            : Row(children: [
                InitialsAvatar(name: asStr(cp['name']), accent: asStrOrNull(cp['accent']), size: 40),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(child: Text(asStr(cp['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.head(size: 16.5, weight: FontWeight.w600))),
                      const SizedBox(width: 6),
                      if (asMap(cp['trust'])['score'] != null) TrustPill(score: asInt(asMap(cp['trust'])['score']), compact: true),
                    ]),
                    Text(
                      [asStr(cp['role']), asStr(cp['city']), langNative(asStrOrNull(cp['language']))].where((s) => s.isNotEmpty).join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppFonts.body(size: 12.5, color: AppColors.meta),
                    ),
                  ]),
                ),
              ]),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: AppColors.line)),
      ),
      body: d == null
          ? (_error != null
              ? EmptyState(title: context.t('deal.load_failed'), sub: errorText(context, _error), action: context.t('common.retry'), onAction: _load, icon: Icons.cloud_off_rounded)
              : const Center(child: CircularProgressIndicator()))
          : Column(children: [
              _productStrip(context, d),
              Expanded(
                child: c == null
                    ? const Center(child: CircularProgressIndicator())
                    : ChatView(
                        controller: c,
                        names: names,
                        showSenderNames: true,
                        placeholder: context.t('deal.placeholder'),
                        footer: _quickReplies(context, d),
                        ctx: buildCardCtx(
                          context,
                          chip: (chipId, label) => c.chip(chipId, label),
                          refresh: _scheduleRefetch,
                          offerStatus: _offerStatus,
                          deal: _dealInfo(),
                          onCounter: _counter,
                        ),
                      ),
              ),
            ]),
    );
  }

  Widget _productStrip(BuildContext context, Map<String, dynamic> d) {
    final req = asMapOrNull(d['requirement']);
    if (req == null) return const SizedBox.shrink();
    final unit = unitKey(asStrOrNull(req['unit']));
    final listed = _dealInfo().listedPrice;
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(children: [
        GarmentThumb(shape: asStrOrNull(req['shape']), size: 40),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(asStr(req['title']), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 14.5, weight: FontWeight.w700)),
            Text(
              [
                context.t('unit.qty_$unit', {'n': fmtNum(asNumOrNull(req['qty']))}),
                if (listed != null) context.t('deal.listed', {'price': inr(listed)}),
              ].join(' · '),
              style: AppFonts.body(size: 12.5, color: AppColors.meta),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget? _quickReplies(BuildContext context, Map<String, dynamic> d) {
    if (d['conversation'] is Map && asMap(d['conversation'])['kind'] == 'support') return null;
    final offers = _offers;
    final side = _side;
    Map<String, dynamic>? pendingTheirs;
    double? myLast;
    for (final o in offers.reversed) {
      if (pendingTheirs == null && !asBool(o['mine']) && o['status'] == 'pending') pendingTheirs = o;
      if (myLast == null && asBool(o['mine'])) myLast = asDouble(o['unit_price']);
    }
    final items = <Widget>[];
    if (pendingTheirs != null) {
      final p = asDouble(pendingTheirs['unit_price']);
      items.add(_quick(Icons.check_rounded, context.t('deal.accept_price', {'price': inr(p)}), () => _acceptOffer(pendingTheirs!), primary: true));
      if (side == 'buyer') {
        var ask = _stepDown(p);
        if (myLast != null && ask < myLast) ask = myLast;
        if (ask > 0 && ask < p) items.add(_quick(Icons.edit_rounded, context.t('deal.ask_for', {'price': inr(ask)}), () => _quickCounter(ask)));
      }
    }
    items.add(_quick(Icons.sell_rounded, context.t('deal.make_offer'), _makeOffer));
    return Container(
      color: AppColors.page,
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) => items[i],
      ),
    );
  }

  Widget _quick(IconData icon, String label, VoidCallback onTap, {bool primary = false}) => ActionChip(
        avatar: Icon(icon, size: 16, color: primary ? AppColors.white : AppColors.primary),
        label: Text(label, style: AppFonts.body(size: 13.5, weight: FontWeight.w700, color: primary ? AppColors.white : AppColors.primary)),
        backgroundColor: primary ? AppColors.primary : AppColors.surface,
        shape: StadiumBorder(side: primary ? BorderSide.none : const BorderSide(color: AppColors.chipBorder)),
        onPressed: _quickBusy ? null : onTap,
      );
}

class _PriceSheet extends StatefulWidget {
  const _PriceSheet({required this.titleKey, required this.initial, required this.unit});
  final String titleKey;
  final double initial;
  final String unit;
  @override
  State<_PriceSheet> createState() => _PriceSheetState();
}

class _PriceSheetState extends State<_PriceSheet> {
  late final _price = TextEditingController(text: _DealScreenState._fmtPrice(widget.initial));

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = double.tryParse(_price.text.trim());
    return SheetBody(
      title: context.t(widget.titleKey),
      sub: context.t('deal.their_price', {'price': inr(widget.initial)}),
      children: [
        TextField(
          controller: _price,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
          onChanged: (_) => setState(() {}),
          style: AppFonts.money(size: 22),
          decoration: InputDecoration(prefixText: '₹ ', suffixText: '/${context.t('unit.per_${unitKey(widget.unit)}')}'),
        ),
        const SizedBox(height: 16),
        PillButton(label: context.t('deal.send_counter'), large: true, expand: true, onPressed: v == null || v <= 0 ? null : () => Navigator.pop(context, v)),
      ],
    );
  }
}

class _OfferSheet extends StatefulWidget {
  const _OfferSheet({required this.qty, required this.price, required this.unit});
  final double? qty;
  final double? price;
  final String unit;
  @override
  State<_OfferSheet> createState() => _OfferSheetState();
}

class _OfferSheetState extends State<_OfferSheet> {
  late final _qty = TextEditingController(text: widget.qty == null ? '' : fmtNum(widget.qty).replaceAll(',', ''));
  late final _price = TextEditingController(text: widget.price == null ? '' : _DealScreenState._fmtPrice(widget.price!));
  final _days = TextEditingController(text: '7');
  final _advance = TextEditingController(text: '30');

  @override
  void dispose() {
    _qty.dispose();
    _price.dispose();
    _days.dispose();
    _advance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final qty = double.tryParse(_qty.text.trim());
    final price = double.tryParse(_price.text.trim());
    final valid = qty != null && qty > 0 && price != null && price > 0;
    final per = context.t('unit.per_${unitKey(widget.unit)}');
    TextField num(TextEditingController c, String label, {String? suffix, String? prefix, bool decimal = false}) => TextField(
          controller: c,
          keyboardType: TextInputType.numberWithOptions(decimal: decimal),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(decimal ? r'[\d.]' : r'\d'))],
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(labelText: label, suffixText: suffix, prefixText: prefix),
        );
    return SheetBody(
      title: context.t('deal.make_offer'),
      children: [
        Row(children: [
          Expanded(child: num(_qty, context.t('deal.f_qty'), suffix: per)),
          const SizedBox(width: 10),
          Expanded(child: num(_price, context.t('deal.f_price'), prefix: '₹ ', suffix: '/$per', decimal: true)),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: num(_days, context.t('deal.f_days'))),
          const SizedBox(width: 10),
          Expanded(child: num(_advance, context.t('deal.f_advance'), suffix: '%')),
        ]),
        if (valid) ...[
          const SizedBox(height: 12),
          Text(context.t('offer.total', {'amount': inr(qty * price)}), style: AppFonts.money(size: 18)),
        ],
        const SizedBox(height: 16),
        PillButton(
          label: context.t('deal.send_offer'),
          large: true,
          expand: true,
          onPressed: !valid
              ? null
              : () => Navigator.pop(context, {
                    'qty': qty,
                    'unitPrice': price,
                    'dispatchDays': int.tryParse(_days.text) ?? 7,
                    'advancePct': (int.tryParse(_advance.text) ?? 30).clamp(0, 100),
                    'creditDays': 0,
                    'freight': 'to_pay',
                  }),
        ),
      ],
    );
  }
}
