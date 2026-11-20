// Claire's conversational cards: chips, tiles, summary, notice, orders, requirement, carousel.
import 'package:material_ui/material_ui.dart';

import '../../cards/card_payload.dart';
import '../../cards/format.dart';
import '../../i18n/i18n.dart';
import '../../theme/tokens.dart';
import '../ui.dart';
import 'card_ctx.dart';

const double kCardMaxWidth = 380;

/// Claire's question text as an incoming bubble.
class QuestionBubble extends StatelessWidget {
  const QuestionBubble({super.key, required this.text, this.hint});
  final String text;
  final String? hint;
  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Container(
      constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.bubbleOther,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(20), bottomLeft: Radius.circular(20), bottomRight: Radius.circular(20)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(text, style: AppFonts.body(size: 15.5)),
        if (hint != null && hint!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(hint!, style: AppFonts.body(size: 13, color: AppColors.meta)),
        ],
      ]),
    );
  }
}

/// "Tap once" state for chip-like cards: answered or superseded cards fold their options away.
mixin ChipLock<T extends StatefulWidget> on State<T> {
  String? picked;
  bool lockedFor(bool stale) => stale || picked != null;
}

class ChipsCardView extends StatefulWidget {
  const ChipsCardView({super.key, required this.payload, required this.ctx, required this.sentAt});
  final ChipsCard payload;
  final CardCtx ctx;
  final int sentAt;
  @override
  State<ChipsCardView> createState() => _ChipsCardViewState();
}

class _ChipsCardViewState extends State<ChipsCardView> with ChipLock {
  static const _icons = <String, IconData>{
    'home:buy': Icons.shopping_bag_rounded,
    'home:fabric': Icons.layers_rounded,
    'home:job': Icons.content_cut_rounded,
    'home:sell': Icons.photo_camera_rounded,
    'home:orders': Icons.inventory_2_rounded,
    'home:human': Icons.support_agent_rounded,
  };

  void _tap(ChipItem c) {
    if (lockedFor(widget.ctx.isStale(widget.sentAt))) return;
    setState(() => picked = c.id);
    widget.ctx.chip(c.id, cleanLabel(c.label));
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.payload;
    final locked = lockedFor(widget.ctx.isStale(widget.sentAt));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      QuestionBubble(text: p.text, hint: p.hint),
      if (!locked && p.chips.isNotEmpty) ...[
        const SizedBox(height: 10),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
          child: p.grid
              ? LayoutBuilder(builder: (context, box) {
                  final w = (box.maxWidth - 10) / 2;
                  return Wrap(spacing: 10, runSpacing: 10, children: [
                    for (final c in p.chips) SizedBox(width: w, child: _GridChip(chip: c, icon: _icons[c.id], onTap: () => _tap(c))),
                  ]);
                })
              : Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final c in p.chips) ChipButton(label: cleanLabel(c.label), sub: c.sub, icon: _icons[c.id], primary: c.primary, onTap: () => _tap(c)),
                ]),
        ),
      ],
    ]);
  }
}

class ChipButton extends StatelessWidget {
  const ChipButton({super.key, required this.label, required this.onTap, this.sub, this.icon, this.primary = false});
  final String label;
  final String? sub;
  final IconData? icon;
  final bool primary;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final fg = primary ? AppColors.white : AppColors.primary;
    return Material(
      color: primary ? AppColors.primary : AppColors.surface,
      shape: StadiumBorder(side: primary ? BorderSide.none : const BorderSide(color: AppColors.chipBorder, width: 1.2)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 18, color: fg), const SizedBox(width: 6)],
              Flexible(
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(label, style: AppFonts.body(size: 14.5, weight: FontWeight.w700, color: fg, height: 1.25)),
                  if (sub != null && sub!.isNotEmpty) Text(sub!, style: AppFonts.body(size: 12, color: primary ? AppColors.white : AppColors.meta, height: 1.25)),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _GridChip extends StatelessWidget {
  const _GridChip({required this.chip, required this.onTap, this.icon});
  final ChipItem chip;
  final IconData? icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final primary = chip.primary;
    return Material(
      color: primary ? AppColors.primary : AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.all(18), side: primary ? BorderSide.none : const BorderSide(color: AppColors.line)),
      child: InkWell(
        borderRadius: AppRadius.all(18),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              if (icon != null) ...[
                IconTile(icon: icon!, size: 38, round: true, bg: primary ? AppColors.primaryHover : AppColors.primaryTint, fg: primary ? AppColors.white : AppColors.primary),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(cleanLabel(chip.label), style: AppFonts.body(size: 14.5, weight: FontWeight.w700, color: primary ? AppColors.white : AppColors.ink, height: 1.3)),
                  if (chip.sub != null) Text(chip.sub!, style: AppFonts.body(size: 12, color: primary ? AppColors.white : AppColors.meta, height: 1.3)),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class TilesCardView extends StatefulWidget {
  const TilesCardView({super.key, required this.payload, required this.ctx, required this.sentAt});
  final TilesCard payload;
  final CardCtx ctx;
  final int sentAt;
  @override
  State<TilesCardView> createState() => _TilesCardViewState();
}

class _TilesCardViewState extends State<TilesCardView> with ChipLock {
  @override
  Widget build(BuildContext context) {
    final locked = lockedFor(widget.ctx.isStale(widget.sentAt));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      QuestionBubble(text: widget.payload.text),
      if (!locked) ...[
        const SizedBox(height: 10),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
          child: LayoutBuilder(builder: (context, box) {
            final w = (box.maxWidth - 20) / 3;
            return Wrap(spacing: 10, runSpacing: 10, children: [
              for (final tile in widget.payload.tiles)
                SizedBox(
                  width: w,
                  child: Surface(
                    radius: 18,
                    padding: const EdgeInsets.all(6),
                    onTap: () {
                      if (lockedFor(widget.ctx.isStale(widget.sentAt))) return;
                      setState(() => picked = tile.id);
                      widget.ctx.chip(tile.id, cleanLabel(tile.label));
                    },
                    child: Column(children: [
                      AspectRatio(aspectRatio: 1, child: LayoutBuilder(builder: (_, b) => GarmentThumb(shape: tile.shape, color: tile.color, size: b.maxWidth))),
                      const SizedBox(height: 6),
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: Text(cleanLabel(tile.label), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, weight: FontWeight.w700, height: 1.3)),
                        ),
                      ),
                    ]),
                  ),
                ),
            ]);
          }),
        ),
      ],
    ]);
  }
}

class SummaryCardView extends StatelessWidget {
  const SummaryCardView({super.key, required this.payload});
  final SummaryCard payload;
  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
        child: Surface(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const IconTile(icon: Icons.assignment_turned_in_rounded, size: 40, round: true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(payload.title, style: AppFonts.body(size: 13, weight: FontWeight.w700, color: AppColors.meta)),
                for (final l in payload.lines) Text(l, style: AppFonts.body(size: 15, weight: FontWeight.w600)),
              ]),
            ),
          ]),
        ),
      );
}

class NoticeCardView extends StatelessWidget {
  const NoticeCardView({super.key, required this.payload});
  final NoticeCard payload;
  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (payload.tone) {
      'success' => (AppColors.successTint, AppColors.success, Icons.check_circle_rounded),
      'warn' => (AppColors.accentTint, AppColors.accentInk, Icons.warning_amber_rounded),
      _ => (AppColors.sunken, AppColors.meta, Icons.info_outline_rounded),
    };
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: bg, borderRadius: AppRadius.all(18)),
        child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 16, color: fg)),
          const SizedBox(width: 8),
          Flexible(child: Text(payload.text, style: AppFonts.body(size: 13.5, color: AppColors.ink2))),
        ]),
      ),
    );
  }
}

class OrdersCardView extends StatelessWidget {
  const OrdersCardView({super.key, required this.payload, required this.ctx});
  final OrdersCard payload;
  final CardCtx ctx;
  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
        child: Surface(
          padding: const EdgeInsets.fromLTRB(6, 14, 6, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(payload.text.isEmpty ? context.t('orders.title') : payload.text, style: AppFonts.head(size: 16.5, weight: FontWeight.w600)),
            ),
            const SizedBox(height: 4),
            for (final o in payload.items)
              InkWell(
                borderRadius: AppRadius.all(16),
                onTap: o.conversationId == null ? null : () => ctx.openConversation(o.conversationId!),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  child: Row(children: [
                    const IconTile(icon: Icons.inventory_2_rounded, size: 40, round: true),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(o.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 14.5, weight: FontWeight.w700)),
                        Text('${o.counterpart} · ${o.code}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 12.5, color: AppColors.meta)),
                        const SizedBox(height: 4),
                        Builder(builder: (context) {
                          final (key, tone) = orderStatusInfo(o.status, buyer: true);
                          return StatusPill(label: context.t(key), tone: tone);
                        }),
                      ]),
                    ),
                    Text(inr(o.total), style: AppFonts.money(size: 15)),
                    if (o.conversationId != null) const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
                  ]),
                ),
              ),
          ]),
        ),
      );
}

class RequirementCardView extends StatelessWidget {
  const RequirementCardView({super.key, required this.payload});
  final RequirementCard payload;
  @override
  Widget build(BuildContext context) {
    final facts = <String>[
      context.t('unit.qty_${unitKey(payload.unit)}', {'n': fmtNum(payload.qty)}),
      if (payload.budget != null) context.t('results.max_price', {'price': inr(payload.budget)}),
      if (payload.deadlineDays != null) context.t('results.in_days', {'n': payload.deadlineDays}),
      if (payload.city != null) payload.city!,
    ];
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
      child: Surface(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const IconTile(icon: Icons.request_quote_rounded, size: 36, round: true, bg: AppColors.accentTint, fg: AppColors.accentInk),
            const SizedBox(width: 10),
            Expanded(child: Text(context.t('deal.requirement'), style: AppFonts.body(size: 13, weight: FontWeight.w700, color: AppColors.meta))),
          ]),
          const SizedBox(height: 8),
          Text(payload.title, style: AppFonts.head(size: 16.5, weight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(facts.join(' · '), style: AppFonts.body(size: 14, color: AppColors.ink2)),
          const SizedBox(height: 8),
          Row(children: [
            Flexible(child: Text(payload.buyerName, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13.5, weight: FontWeight.w600))),
            const SizedBox(width: 8),
            TrustPill(score: payload.buyerTrust, compact: true),
          ]),
        ]),
      ),
    );
  }
}

class CarouselCardView extends StatelessWidget {
  const CarouselCardView({super.key, required this.payload, required this.ctx});
  final CarouselCard payload;
  final CardCtx ctx;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        QuestionBubble(text: payload.text),
        const SizedBox(height: 10),
        SizedBox(
          height: 172,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: payload.items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final it = payload.items[i];
              final art = it['art'] is Map ? Map<String, dynamic>.from(it['art'] as Map) : const <String, dynamic>{};
              return SizedBox(
                width: 150,
                child: Surface(
                  radius: 18,
                  padding: const EdgeInsets.all(10),
                  onTap: () => ctx.openDeal('${it['businessId'] ?? ''}', listingId: '${it['id'] ?? ''}'),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    GarmentThumb(shape: art['shape'] as String?, color: art['color'] as String?, size: 56),
                    const SizedBox(height: 8),
                    Text('${it['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, weight: FontWeight.w700, height: 1.3)),
                    const Spacer(),
                    Text(inr(num.tryParse('${it['price']}')), style: AppFonts.money(size: 15)),
                    Text('${it['businessName'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 12, color: AppColors.meta)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]);
}

class OtherCardView extends StatelessWidget {
  const OtherCardView({super.key, required this.payload});
  final OtherCard payload;
  @override
  Widget build(BuildContext context) {
    final text = payload.kind == 'agent_joined'
        ? context.t('cards.agent_joined', {'name': payload.raw['agentName'] ?? ''})
        : payload.kind == 'rating'
            ? context.t('cards.rating', {'name': payload.raw['rateeName'] ?? ''})
            : payload.text.isNotEmpty
                ? payload.text
                : context.t('cards.unsupported');
    return NoticeCardView(payload: NoticeCard(text: text));
  }
}
