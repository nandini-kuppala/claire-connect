// Results for one requirement: Claire's recommendation and supplier cards
// (GET /api/requirements/:id → Chat → POST /api/deals/open → deal chat).
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../cards/card_payload.dart';
import '../cards/format.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/ui.dart';
import 'nav.dart';

class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key, required this.requirementId});
  final String requirementId;
  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  Map<String, dynamic>? _data;
  Object? _error;
  String? _busy;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final r = asMap(await AppServices.of(context).api.get('/api/requirements/${Uri.encodeComponent(widget.requirementId)}'));
      if (mounted) setState(() => _data = r);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _chat(String key, Future<void> Function() fn) async {
    if (_busy != null) return;
    setState(() => _busy = key);
    try {
      await fn();
    } catch (e) {
      if (mounted) showToast(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final req = asMap(data?['requirement']);
    return Scaffold(
      appBar: AppBar(title: Text(asStr(req['title'], context.t('results.title')))),
      body: data == null
          ? (_error != null
              ? EmptyState(title: context.t('results.load_failed'), sub: errorText(context, _error), action: context.t('common.retry'), onAction: _load, icon: Icons.cloud_off_rounded)
              : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(onRefresh: _load, child: _body(context, data)),
    );
  }

  Widget _body(BuildContext context, Map<String, dynamic> data) {
    final req = asMap(data['requirement']);
    final results = asMap(data['results']);
    final rec = asMap(data['recommendation']);
    List<MatchCardData> list(String k) => asMapList(results[k]).map(MatchCardData.fromJson).toList();
    final singles = [...list('singles'), ...list('mto')];
    final combos = list('combos');
    final unit = unitKey(asStrOrNull(req['unit']));
    final facts = <String>[
      if (req['qty'] != null) context.t('unit.qty_$unit', {'n': fmtNum(asNumOrNull(req['qty']))}),
      if (req['budget'] != null) context.t('results.max_price', {'price': inr(asNumOrNull(req['budget']))}),
      if (req['deadlineDays'] != null) context.t('results.in_days', {'n': asInt(req['deadlineDays'])}),
      if (asStrOrNull(req['city']) != null) asStr(req['city']),
    ];
    final recKey = asStrOrNull(rec['key']);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      children: [
        Text(facts.join(' · '), style: AppFonts.body(color: AppColors.ink2)),
        const SizedBox(height: 14),
        if (asStrOrNull(rec['reason']) != null)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.accentTint, borderRadius: AppRadius.all(AppRadius.lg)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const ClaireMark(size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.t('results.recommendation'), style: AppFonts.body(size: 13, weight: FontWeight.w700, color: AppColors.accentInk)),
                  const SizedBox(height: 2),
                  Text(asStr(rec['reason']), style: AppFonts.body(size: 14.5, color: AppColors.ink2)),
                ]),
              ),
            ]),
          ),
        const SizedBox(height: 18),
        SectionTitle(context.t('results.suppliers_n', {'n': singles.length})),
        if (singles.isEmpty && combos.isEmpty) EmptyState(title: context.t('results.none'), icon: Icons.search_off_rounded),
        for (final m in singles) Padding(padding: const EdgeInsets.only(bottom: 12), child: _supplierCard(context, m, unit, recommended: m.key != null && m.key == recKey)),
        if (combos.isNotEmpty) ...[
          const SizedBox(height: 6),
          SectionTitle(context.t('results.combos')),
          for (final m in combos) Padding(padding: const EdgeInsets.only(bottom: 12), child: _comboCard(context, m, unit)),
        ],
      ],
    );
  }

  Widget _supplierCard(BuildContext context, MatchCardData m, String unit, {required bool recommended}) {
    if (m.lines.isEmpty) return const SizedBox.shrink();
    final l = m.lines.first;
    final sup = l.supplier ?? const {};
    final key = 's:${m.key ?? l.listingId}';
    final rating = asNumOrNull(sup['ratingAvg']) ?? m.rating;
    final orders = asIntOrNull(sup['orders']);
    final stock = l.stock ?? m.stock;
    return Surface(
      padding: EdgeInsets.zero,
      borderColor: recommended ? AppColors.primary : AppColors.line,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (recommended)
          Container(
            width: double.infinity,
            color: AppColors.primaryTint,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            child: Row(children: [
              const Icon(Icons.star_rounded, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(context.t('results.recommended'), style: AppFonts.body(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              GarmentThumb(shape: m.shape, size: 56),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text(l.businessName, style: AppFonts.head(size: 16.5, weight: FontWeight.w600)),
                    TrustPill(score: m.trust, compact: true),
                  ]),
                  if (l.listingTitle != null) Text(l.listingTitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, color: AppColors.meta)),
                  if (rating != null)
                    Row(children: [
                      const Icon(Icons.star_rounded, size: 15, color: AppColors.accent),
                      const SizedBox(width: 3),
                      Text(
                        orders != null ? context.t('results.rating_orders', {'rating': rating.toStringAsFixed(1), 'n': orders}) : rating.toStringAsFixed(1),
                        style: AppFonts.body(size: 13, color: AppColors.ink2),
                      ),
                    ]),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            Text.rich(TextSpan(children: [
              TextSpan(text: inr(m.avgPrice), style: AppFonts.money(size: 24)),
              TextSpan(text: ' /${context.t('unit.per_$unit')}', style: AppFonts.body(color: AppColors.meta)),
            ])),
            const SizedBox(height: 8),
            Wrap(spacing: 16, runSpacing: 6, children: [
              if (stock != null) _fact(Icons.inventory_2_outlined, context.t('results.stock', {'n': fmtNum(stock)})),
              _fact(Icons.schedule_rounded, m.readyDays <= 1 ? context.t('results.ready_1') : context.t('results.ready_in', {'n': m.readyDays})),
            ]),
            if (m.badges.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: [for (final b in m.badges.take(2)) StatusPill(label: context.badge(b), tone: Tone.neutral)]),
            ],
            const SizedBox(height: 14),
            PillButton(
              label: context.t('results.chat_with', {'name': l.businessName}),
              icon: Icons.chat_bubble_rounded,
              expand: true,
              loading: _busy == key,
              onPressed: _busy != null ? null : () => _chat(key, () => openDealWith(context, l.businessId, requirementId: widget.requirementId, listingId: l.listingId)),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _comboCard(BuildContext context, MatchCardData m, String unit) => Surface(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const IconTile(icon: Icons.groups_rounded, size: 40, round: true, bg: AppColors.accentTint, fg: AppColors.accentInk),
            const SizedBox(width: 12),
            Expanded(child: Text(context.t('results.split_names', {'names': m.lines.map((l) => l.businessName).join(' + ')}), style: AppFonts.body(weight: FontWeight.w700))),
          ]),
          const SizedBox(height: 10),
          for (final l in m.lines)
            Text('${l.businessName}: ${context.t('unit.qty_$unit', {'n': fmtNum(l.qty)})} × ${inr(l.unitPrice)}', style: AppFonts.body(size: 13.5, color: AppColors.ink2)),
          const SizedBox(height: 8),
          Text.rich(TextSpan(children: [
            TextSpan(text: inr(m.avgPrice), style: AppFonts.money(size: 20)),
            TextSpan(text: ' /${context.t('unit.per_$unit')} · ${context.t('results.total', {'amount': inr(m.total)})}', style: AppFonts.body(size: 13.5, color: AppColors.meta)),
          ])),
          const SizedBox(height: 12),
          PillButton(
            label: context.t('results.chat_all', {'n': m.lines.length}),
            variant: PillVariant.tint,
            expand: true,
            loading: _busy == 'combo',
            onPressed: _busy != null
                ? null
                : () => _chat('combo', () async {
                      final nav = Navigator.of(context);
                      final r = asMap(await AppServices.of(context).api.post('/api/deals/combo', {'requirementId': widget.requirementId, 'lines': m.lines.map((l) => l.toJson()).toList()}));
                      final convs = asMapList(r['conversations']);
                      if (convs.isNotEmpty && mounted) await openConversation(nav.context, asStr(convs.first['id']));
                    }),
          ),
        ]),
      );

  Widget _fact(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: AppColors.meta),
        const SizedBox(width: 5),
        Text(text, style: AppFonts.body(size: 13.5, color: AppColors.ink2)),
      ]);
}
