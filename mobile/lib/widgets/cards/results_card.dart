// Compact results card in Claire's chat: summary, Claire's take, top 2 suppliers, then "See all".
import 'package:material_ui/material_ui.dart';

import '../../cards/card_payload.dart';
import '../../cards/format.dart';
import '../../i18n/i18n.dart';
import '../../theme/tokens.dart';
import '../brand.dart';
import '../ui.dart';
import 'basic_cards.dart';
import 'card_ctx.dart';

class ResultsCardView extends StatefulWidget {
  const ResultsCardView({super.key, required this.payload, required this.ctx, required this.sentAt});
  final ResultsCard payload;
  final CardCtx ctx;
  final int sentAt;
  @override
  State<ResultsCardView> createState() => _ResultsCardViewState();
}

class _ResultsCardViewState extends State<ResultsCardView> with ChipLock {
  String? _busy;
  String? _error;

  Future<void> _run(String key, Future<void> Function() fn) async {
    if (_busy != null) return;
    setState(() {
      _busy = key;
      _error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.payload;
    final ctx = widget.ctx;
    final all = p.all;
    final singles = [...p.singles, ...p.mto];
    final top = singles.take(2).toList();
    final combo = top.isEmpty && p.combos.isNotEmpty ? p.combos.first : null;
    final unit = all.isEmpty ? '' : context.t('unit.per_${unitFromShape(all.first.shape)}');
    final minPrice = all.isEmpty ? 0.0 : all.map((m) => m.avgPrice).reduce((a, b) => a < b ? a : b);
    String days(int n) => n <= 1 ? context.t('results.ready_1') : context.t('results.ready_in', {'n': n});
    final take = p.note ??
        (top.isNotEmpty
            ? context.t('results.card_take', {'name': top.first.lines.isEmpty ? '' : top.first.lines.first.businessName, 'price': inr(top.first.avgPrice), 'unit': unit, 'days': days(top.first.readyDays)})
            : combo != null
                ? context.t('results.card_take_combo', {'n': combo.lines.length})
                : null);
    final locked = lockedFor(ctx.isStale(widget.sentAt));

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
      child: Surface(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.title, style: AppFonts.head(size: 16.5, weight: FontWeight.w600)),
              if (all.isNotEmpty)
                Text(
                  p.sellerCount == 1
                      ? context.t('results.card_summary_1', {'price': inr(minPrice), 'unit': unit})
                      : context.t('results.card_summary', {'n': p.sellerCount, 'price': inr(minPrice), 'unit': unit}),
                  style: AppFonts.body(size: 13, color: AppColors.meta),
                ),
              if (take != null) ...[
                const SizedBox(height: 12),
                _ClaireTake(text: take),
              ],
            ]),
          ),
          if (all.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(context.t('results.none'), style: AppFonts.body(color: AppColors.ink2)),
            ),
          for (var i = 0; i < top.length; i++)
            if (top[i].lines.isNotEmpty) _supplierRow(context, top[i], 't$i', unit),
          if (combo != null) _comboRow(context, combo, unit),
          if (_error != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: ErrorLine(_error!)),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
              PillButton(
                label: context.t('results.see_all', {'n': all.length}),
                icon: Icons.view_list_rounded,
                small: true,
                onPressed: () => ctx.openResults(p.requirementId),
              ),
              if (!locked) ...[
                PillButton(label: context.t('results.change_budget'), small: true, variant: PillVariant.secondary, onPressed: () => _chip('refine:budget', context.t('results.change_budget'))),
                PillButton(label: context.t('results.start_over'), small: true, variant: PillVariant.ghost, onPressed: () => _chip('restart', context.t('results.start_over'))),
              ],
            ]),
          ),
        ]),
      ),
    );
  }

  void _chip(String id, String label) {
    setState(() => picked = id);
    widget.ctx.chip(id, label);
  }

  Widget _supplierRow(BuildContext context, MatchCardData m, String key, String unit) {
    final l = m.lines.first;
    return Container(
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.line))),
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 0),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(l.businessName, style: AppFonts.body(size: 14.5, weight: FontWeight.w700)),
              TrustPill(score: m.trust, compact: true),
            ]),
            const SizedBox(height: 2),
            Text.rich(TextSpan(children: [
              TextSpan(text: inr(m.avgPrice), style: AppFonts.money(size: 15.5)),
              TextSpan(text: '/$unit · ', style: AppFonts.body(size: 13, color: AppColors.meta)),
              TextSpan(text: m.readyDays <= 1 ? context.t('results.ready_1') : context.t('results.ready_in', {'n': m.readyDays}), style: AppFonts.body(size: 13, color: AppColors.ink2)),
            ])),
          ]),
        ),
        PillButton(
          label: context.t('results.chat'),
          icon: Icons.chat_bubble_rounded,
          variant: PillVariant.tint,
          small: true,
          loading: _busy == key,
          onPressed: _busy != null ? null : () => _run(key, () => widget.ctx.openDeal(l.businessId, requirementId: widget.payload.requirementId, listingId: l.listingId)),
        ),
      ]),
    );
  }

  Widget _comboRow(BuildContext context, MatchCardData combo, String unit) => Container(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.line))),
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 0),
        child: Row(children: [
          const IconTile(icon: Icons.groups_rounded, size: 36, round: true, bg: AppColors.accentTint, fg: AppColors.accentInk),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.t('results.split_names', {'names': combo.lines.map((l) => l.businessName).join(' + ')}), style: AppFonts.body(size: 14, weight: FontWeight.w700)),
              Text('${inr(combo.avgPrice)}/$unit', style: AppFonts.money(size: 15)),
            ]),
          ),
          PillButton(
            label: context.t('results.chat_all', {'n': combo.lines.length}),
            variant: PillVariant.tint,
            small: true,
            loading: _busy == 'combo',
            onPressed: _busy != null
                ? null
                : () => _run('combo', () async {
                      final r = await widget.ctx.api.post('/api/deals/combo', {'requirementId': widget.payload.requirementId, 'lines': combo.lines.map((l) => l.toJson()).toList()});
                      final convs = r is Map ? r['conversations'] : null;
                      if (convs is List && convs.isNotEmpty && convs.first is Map) widget.ctx.openConversation('${(convs.first as Map)['id']}');
                    }),
          ),
        ]),
      );
}

class _ClaireTake extends StatelessWidget {
  const _ClaireTake({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: AppColors.accentTint, borderRadius: AppRadius.all(16)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const ClaireMark(size: 22),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: AppFonts.body(size: 13.5, color: AppColors.ink2))),
        ]),
      );
}
