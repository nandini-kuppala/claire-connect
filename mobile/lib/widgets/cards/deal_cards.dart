// Deal cards: offer (Accept / Counter / Decline), order (next action per role), Claire's private
// tip (CC:Hint) with a one-tap offer, and the user's chip reply bubble (CC:Reply).
import 'package:material_ui/material_ui.dart';

import '../../cards/card_payload.dart';
import '../../cards/format.dart';
import '../../i18n/i18n.dart';
import '../../theme/tokens.dart';
import '../brand.dart';
import '../ui.dart';
import 'basic_cards.dart';
import 'card_ctx.dart';

// ── Offer ───────────────────────────────────────────────────────────────────
class OfferCardView extends StatefulWidget {
  const OfferCardView({super.key, required this.payload, required this.ctx, required this.mine});
  final OfferCard payload;
  final CardCtx ctx;
  final bool mine;
  @override
  State<OfferCardView> createState() => _OfferCardViewState();
}

class _OfferCardViewState extends State<OfferCardView> {
  String? _localStatus;
  bool _confirming = false;
  bool _terms = false;
  String? _busy;
  String? _error;

  Future<void> _respond(String action) async {
    setState(() {
      _busy = action;
      _error = null;
    });
    try {
      await widget.ctx.api.post('/api/offers/${Uri.encodeComponent(widget.payload.offerId)}/respond', {'action': action});
      setState(() {
        _localStatus = action == 'accept' ? 'accepted' : 'declined';
        _confirming = false;
      });
      widget.ctx.refresh();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.payload;
    final live = widget.ctx.offerStatus[p.offerId];
    final status = _localStatus ?? (live != null && live != 'pending' ? live : p.status);
    final pending = status == 'pending';
    final mine = widget.mine || (widget.ctx.myBusinessId != null && widget.ctx.myBusinessId == p.fromBusinessId);
    final canAct = pending && !mine;
    final per = context.t('unit.per_${unitKey(p.unit)}');
    final qtyText = context.t('unit.qty_${unitKey(p.unit)}', {'n': fmtNum(p.qty)});

    if (!pending) {
      final (key, icon, tone) = switch (status) {
        'accepted' => ('offer.st_accepted', Icons.check_rounded, Tone.success),
        'countered' => ('offer.st_countered', Icons.repeat_rounded, Tone.clay),
        'declined' => ('offer.st_declined', Icons.close_rounded, Tone.danger),
        _ => ('offer.st_expired', Icons.schedule_rounded, Tone.neutral),
      };
      final (bg, fg) = toneColors(tone);
      return Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.all(18), border: Border.all(color: AppColors.line)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          IconTile(icon: icon, size: 28, round: true, bg: bg, fg: fg),
          const SizedBox(width: 8),
          Flexible(
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '${context.t(key)} · ', style: AppFonts.body(size: 13.5, weight: FontWeight.w700, color: fg)),
              TextSpan(text: '${inr(p.unitPrice)}/$per', style: AppFonts.money(size: 14)),
              TextSpan(text: ' · $qtyText', style: AppFonts.body(size: 13, color: AppColors.meta)),
            ])),
          ),
        ]),
      );
    }

    final heading = canAct
        ? context.t(p.isCounter ? 'offer.counter_received' : 'offer.offer_received')
        : context.t(p.isCounter ? 'offer.your_counter' : 'offer.your_offer');
    final diff = p.isCounter ? p.unitPrice - p.parentPrice! : 0.0;

    return Container(
      constraints: const BoxConstraints(maxWidth: 340),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.all(AppRadius.xl),
        border: Border.all(color: canAct ? AppColors.clay.withValues(alpha: 0.3) : AppColors.line),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconTile(icon: Icons.handshake_rounded, size: 34, round: true, bg: canAct ? AppColors.clayTint : AppColors.primaryTint, fg: canAct ? AppColors.clay : AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(heading, style: AppFonts.body(size: 13, weight: FontWeight.w700, color: canAct ? AppColors.clay : AppColors.meta)),
              Text(p.fromName, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, color: AppColors.meta)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        Text(p.title, style: AppFonts.body(size: 14.5, weight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text.rich(TextSpan(children: [
          TextSpan(text: inr(p.unitPrice), style: AppFonts.money(size: 24, color: canAct && p.isCounter ? AppColors.clay : AppColors.ink)),
          TextSpan(text: ' /$per', style: AppFonts.body(size: 14, color: AppColors.meta)),
        ])),
        Text('$qtyText · ${context.t('offer.total', {'amount': inr(p.total)})}', style: AppFonts.body(size: 13.5, color: AppColors.ink2)),
        if (p.isCounter && diff != 0)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: StatusPill(
              label: context.t(diff < 0 ? 'offer.less_than' : 'offer.more_than', {'amt': inr(diff.abs()), 'prev': inr(p.parentPrice)}),
              tone: diff < 0 ? Tone.success : Tone.clay,
            ),
          ),
        TextButton(
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36), foregroundColor: AppColors.primary),
          onPressed: () => setState(() => _terms = !_terms),
          child: Text(context.t(_terms ? 'offer.hide_terms' : 'offer.terms'), style: AppFonts.body(size: 13.5, weight: FontWeight.w700, color: AppColors.primary)),
        ),
        if (_terms) ...[
          _kv(context.t('offer.dispatch'), context.t('offer.in_days', {'n': p.dispatchDays})),
          _kv(context.t('offer.advance'), '${p.advancePct}%'),
          _kv(context.t('offer.credit'), p.creditDays > 0 ? context.t('offer.days', {'n': p.creditDays}) : context.t('offer.none')),
          if (p.freight.isNotEmpty) _kv(context.t('offer.freight'), _freightLabel(context, p.freight)),
        ],
        if (pending && mine)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(children: [
              const Icon(Icons.schedule_rounded, size: 15, color: AppColors.meta),
              const SizedBox(width: 6),
              Text(context.t('offer.waiting'), style: AppFonts.body(size: 13, color: AppColors.meta)),
            ]),
          ),
        if (canAct && !_confirming) ...[
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: PillButton(label: context.t('offer.accept'), icon: Icons.check_rounded, onPressed: _busy != null ? null : () => setState(() => _confirming = true))),
            const SizedBox(width: 8),
            Expanded(
              child: PillButton(
                label: context.t('offer.counter'),
                icon: Icons.repeat_rounded,
                variant: PillVariant.secondary,
                onPressed: _busy != null || widget.ctx.onCounter == null ? null : () => widget.ctx.onCounter!(p.offerId, p.unitPrice, p.unit),
              ),
            ),
          ]),
          Center(
            child: TextButton(
              onPressed: _busy != null ? null : () => _respond('decline'),
              child: Text(context.t('offer.decline'), style: AppFonts.body(size: 14, weight: FontWeight.w600, color: AppColors.meta)),
            ),
          ),
        ],
        if (canAct && _confirming) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.primaryTint, borderRadius: AppRadius.all(16)),
            child: Text(context.t('offer.confirm_accept', {'price': inr(p.unitPrice), 'total': inr(p.total)}), style: AppFonts.body(size: 14)),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: PillButton(label: context.t('common.cancel'), variant: PillVariant.secondary, onPressed: _busy != null ? null : () => setState(() => _confirming = false))),
            const SizedBox(width: 8),
            Expanded(child: PillButton(label: context.t('offer.yes_accept'), icon: Icons.check_rounded, loading: _busy == 'accept', onPressed: _busy != null ? null : () => _respond('accept'))),
          ]),
        ],
        if (_error != null) ErrorLine(_error!),
      ]),
    );
  }

  static String _freightLabel(BuildContext context, String f) {
    final key = 'offer.freight_${f.toLowerCase().replaceAll(RegExp(r'[-\s]+'), '_')}';
    return context.i18n.has(key) ? context.t(key) : f;
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(k, style: AppFonts.body(size: 13.5, color: AppColors.meta))),
          Text(v, style: AppFonts.body(size: 13.5, weight: FontWeight.w600)),
        ]),
      );
}

// ── Order ───────────────────────────────────────────────────────────────────
class OrderAction {
  const OrderAction(this.type, this.labelKey, this.icon, {this.primary = true, this.form});
  final String type;
  final String labelKey;
  final IconData icon;
  final bool primary;

  /// 'pay' | 'dispatch' | 'problem' | null
  final String? form;
}

/// Next actions for my side of the order (same rules as web/src/cards/Order.tsx).
List<OrderAction> orderActions(String role, OrderCard p) {
  final s = p.status;
  final out = <OrderAction>[];
  if (role == 'buyer') {
    if ((s == 'confirmed' || s == 'in_production') && p.advancePct > 0 && !p.advanceIsPaid) {
      out.add(const OrderAction('advance_paid', 'order.a_advance_paid', Icons.currency_rupee_rounded, form: 'pay'));
    }
    if (s == 'dispatched') out.add(const OrderAction('delivered', 'order.a_delivered', Icons.inventory_2_rounded));
    if (s == 'delivered') out.add(const OrderAction('balance_paid', 'order.a_balance_paid', Icons.currency_rupee_rounded, form: 'pay'));
    if (s == 'dispatched' || s == 'delivered') out.add(const OrderAction('problem', 'order.a_problem', Icons.report_problem_rounded, primary: false, form: 'problem'));
  } else if (role == 'seller') {
    final toConfirm = p.toConfirm ?? (p.advancePaid == null && s == 'advance_paid' ? 'advance' : null);
    if (toConfirm != null) out.add(const OrderAction('payment_confirmed', 'order.a_payment_confirmed', Icons.account_balance_wallet_rounded));
    if (s == 'confirmed' || s == 'advance_paid') {
      out.add(OrderAction('in_production', 'order.a_in_production', Icons.factory_rounded, primary: s == 'confirmed' && p.advancePct == 0));
    }
    if (s == 'in_production') out.add(const OrderAction('dispatched', 'order.a_dispatched', Icons.local_shipping_rounded, form: 'dispatch'));
  }
  return out;
}

class OrderCardView extends StatefulWidget {
  const OrderCardView({super.key, required this.payload, required this.ctx});
  final OrderCard payload;
  final CardCtx ctx;
  @override
  State<OrderCardView> createState() => _OrderCardViewState();
}

class _OrderCardViewState extends State<OrderCardView> {
  String? _busy;
  String? _sent;
  String? _error;

  static const _steps = ['confirmed', 'advance_paid', 'in_production', 'dispatched', 'delivered', 'balance_paid'];

  int _stepIndex(String status) {
    if (status == 'closed') return _steps.length;
    if (status == 'disputed') return 4;
    final i = _steps.indexOf(status);
    return i < 0 ? 0 : i;
  }

  String get _role {
    final b = widget.ctx.myBusinessId;
    if (b != null && b == widget.payload.buyerBusinessId) return 'buyer';
    if (b != null && b == widget.payload.sellerBusinessId) return 'seller';
    return 'viewer';
  }

  Future<void> _post(OrderAction a, [Map<String, dynamic> body = const {}]) async {
    setState(() {
      _busy = a.type;
      _error = null;
    });
    try {
      await widget.ctx.api.post('/api/orders/${Uri.encodeComponent(widget.payload.orderId)}/event', {'type': a.type, 'payload': body});
      setState(() => _sent = a.type);
      widget.ctx.refresh();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _start(OrderAction a) async {
    final p = widget.payload;
    final grand = p.grandTotal;
    final advanceAmt = (grand * p.advancePct / 100).roundToDouble();
    switch (a.form) {
      case 'pay':
        final amount = a.type == 'advance_paid' ? advanceAmt : (grand - (p.advanceIsPaid ? advanceAmt : 0)).clamp(0, double.infinity);
        final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text(c.t(a.labelKey), style: AppFonts.head(size: 18)),
            content: Text(c.t('order.pay_confirm', {'amount': inr(amount)}), style: AppFonts.body()),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: Text(c.t('common.cancel'))),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(c.t('common.confirm'))),
            ],
          ),
        );
        if (ok == true) await _post(a, {'amount': amount});
      case 'dispatch':
        final body = await showModalBottomSheet<Map<String, dynamic>>(context: context, isScrollControlled: true, builder: (_) => const _DispatchSheet());
        if (body != null) await _post(a, body);
      case 'problem':
        final body = await showModalBottomSheet<Map<String, dynamic>>(context: context, isScrollControlled: true, builder: (_) => const _ProblemSheet());
        if (body != null) await _post(a, body);
      default:
        await _post(a);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.payload;
    final role = _role;
    final actions = _sent != null ? const <OrderAction>[] : orderActions(role, p);
    final (statusKey, tone) = orderStatusInfo(p.status, buyer: role != 'seller');
    final idx = _stepIndex(p.status);
    final counterpart = role == 'buyer' ? p.sellerName : role == 'seller' ? p.buyerName : '${p.buyerName} · ${p.sellerName}';
    final per = context.t('unit.per_${unitKey(p.unit)}');
    final finished = p.status == 'closed' || p.status == 'balance_paid' || p.status == 'cancelled';

    return Container(
      constraints: const BoxConstraints(maxWidth: kCardMaxWidth),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.all(AppRadius.xl), border: Border.all(color: AppColors.line)),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const IconTile(icon: Icons.receipt_long_rounded, size: 36, round: true),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.t('order.title_code', {'code': p.code}), style: AppFonts.body(size: 13, weight: FontWeight.w700, color: AppColors.meta)),
              Text(counterpart, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, color: AppColors.meta)),
            ]),
          ),
          StatusPill(label: context.t(statusKey), tone: tone),
        ]),
        const SizedBox(height: 10),
        Text(p.title, style: AppFonts.body(size: 15, weight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text('${context.t('unit.qty_${unitKey(p.unit)}', {'n': fmtNum(p.qty)})} × ${inr(p.unitPrice)}/$per', style: AppFonts.body(size: 13.5, color: AppColors.ink2)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(child: Text(context.t('order.total_gst', {'pct': fmtNum(p.gstPct)}), style: AppFonts.body(size: 13.5, color: AppColors.meta))),
          Text(inr(p.grandTotal), style: AppFonts.money(size: 18)),
        ]),
        const SizedBox(height: 12),
        _Progress(index: idx, total: _steps.length),
        const SizedBox(height: 4),
        Text(
          idx >= _steps.length ? context.t('status.completed') : context.t('order.step_${_steps[idx.clamp(0, _steps.length - 1)]}'),
          style: AppFonts.body(size: 12.5, color: AppColors.meta),
        ),
        if (p.transporter != null || p.lr != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(context.t('order.dispatch_line', {'transporter': p.transporter ?? '', 'lr': p.lr ?? ''}), style: AppFonts.body(size: 13, color: AppColors.ink2)),
          ),
        if (actions.isNotEmpty) ...[
          const SizedBox(height: 12),
          for (final a in actions)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PillButton(
                label: context.t(a.labelKey),
                icon: a.icon,
                expand: true,
                variant: a.type == 'problem' ? PillVariant.danger : a.primary ? PillVariant.primary : PillVariant.secondary,
                loading: _busy == a.type,
                onPressed: _busy != null ? null : () => _start(a),
              ),
            ),
        ] else if (!finished && role != 'viewer')
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              const Icon(Icons.schedule_rounded, size: 15, color: AppColors.meta),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  _sent != null ? context.t('order.updated') : context.t('order.waiting_for', {'name': role == 'buyer' ? p.sellerName : p.buyerName}),
                  style: AppFonts.body(size: 13, color: AppColors.meta),
                ),
              ),
            ]),
          ),
        if (_error != null) ErrorLine(_error!),
      ]),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.index, required this.total});
  final int index;
  final int total;
  @override
  Widget build(BuildContext context) => Row(children: [
        for (var i = 0; i < total; i++) ...[
          Expanded(
            child: Container(
              height: 6,
              decoration: BoxDecoration(color: i <= index ? AppColors.primary : AppColors.sunken, borderRadius: AppRadius.all(3)),
            ),
          ),
          if (i < total - 1) const SizedBox(width: 4),
        ],
      ]);
}

class _DispatchSheet extends StatefulWidget {
  const _DispatchSheet();
  @override
  State<_DispatchSheet> createState() => _DispatchSheetState();
}

class _DispatchSheetState extends State<_DispatchSheet> {
  final _transporter = TextEditingController();
  final _lr = TextEditingController();
  final _bundles = TextEditingController();

  @override
  void dispose() {
    _transporter.dispose();
    _lr.dispose();
    _bundles.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final valid = _transporter.text.trim().isNotEmpty && _lr.text.trim().isNotEmpty;
    return SheetBody(
      title: context.t('order.dispatch_title'),
      children: [
        TextField(controller: _transporter, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: context.t('order.transporter'))),
        const SizedBox(height: 10),
        TextField(controller: _lr, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: context.t('order.lr'))),
        const SizedBox(height: 10),
        TextField(controller: _bundles, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: context.t('order.bundles'))),
        const SizedBox(height: 16),
        PillButton(
          label: context.t('order.a_dispatched'),
          large: true,
          expand: true,
          onPressed: !valid
              ? null
              : () => Navigator.pop(context, {
                    'transporter': _transporter.text.trim(),
                    'lr': _lr.text.trim(),
                    if (int.tryParse(_bundles.text.trim()) != null) 'bundles': int.parse(_bundles.text.trim()),
                  }),
        ),
      ],
    );
  }
}

class _ProblemSheet extends StatefulWidget {
  const _ProblemSheet();
  @override
  State<_ProblemSheet> createState() => _ProblemSheetState();
}

class _ProblemSheetState extends State<_ProblemSheet> {
  static const _reasons = ['short', 'damaged', 'colour', 'quality', 'other'];
  String? _reason;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SheetBody(
        title: context.t('order.problem_title'),
        children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final r in _reasons)
              ChoiceChip(
                label: Text(context.t('order.p_$r')),
                selected: _reason == r,
                onSelected: (_) => setState(() => _reason = r),
                selectedColor: AppColors.primaryTint,
                shape: const StadiumBorder(side: BorderSide(color: AppColors.line)),
              ),
          ]),
          const SizedBox(height: 12),
          TextField(controller: _note, maxLines: 3, minLines: 2, decoration: InputDecoration(hintText: context.t('order.problem_note'))),
          const SizedBox(height: 16),
          PillButton(
            label: context.t('order.a_problem'),
            large: true,
            expand: true,
            variant: PillVariant.danger,
            onPressed: _reason == null ? null : () => Navigator.pop(context, {'reason': _reason, if (_note.text.trim().isNotEmpty) 'note': _note.text.trim()}),
          ),
        ],
      );
}

/// Padded bottom-sheet body with a title, safe for the keyboard.
class SheetBody extends StatelessWidget {
  const SheetBody({super.key, required this.title, required this.children, this.sub});
  final String title;
  final String? sub;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: AppFonts.head(size: 20, weight: FontWeight.w700)),
            if (sub != null) ...[const SizedBox(height: 4), Text(sub!, style: AppFonts.body(color: AppColors.meta))],
            const SizedBox(height: 16),
            ...children,
          ]),
        ),
      );
}

// ── Claire's private tip ────────────────────────────────────────────────────
class HintBubble extends StatefulWidget {
  const HintBubble({super.key, required this.payload, required this.ctx, required this.sentAt});
  final HintPayload payload;
  final CardCtx ctx;
  final int sentAt;
  @override
  State<HintBubble> createState() => _HintBubbleState();
}

class _HintBubbleState extends State<HintBubble> {
  bool _used = false;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.payload;
    final deal = widget.ctx.deal;
    final draft = p.draft;
    final actedLater = deal?.offers.any((o) => o.mine && o.createdAt > widget.sentAt) ?? false;
    final showAction = p.actionChipId != null && !_used && !actedLater && !widget.ctx.isStale(widget.sentAt);
    final qty = deal?.qty ?? (deal != null && deal.offers.isNotEmpty ? deal.offers.last.qty : null);
    final unit = deal?.unit ?? 'piece';
    final ref = deal?.theirPrice;
    final savings = draft != null && draft.kind != 'quote' && qty != null && ref != null && ref > draft.price ? ((ref - draft.price) * qty).round() : 0;

    return Container(
      constraints: const BoxConstraints(maxWidth: 340),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.accentTint, borderRadius: AppRadius.all(AppRadius.xl)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const ClaireMark(size: 30),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.text, style: AppFonts.body(size: 14.5)),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.lock_rounded, size: 13, color: AppColors.accentInk),
                const SizedBox(width: 4),
                Text(context.t('deal.only_you'), style: AppFonts.body(size: 12, weight: FontWeight.w600, color: AppColors.accentInk)),
              ]),
            ]),
          ),
        ]),
        if (showAction && draft != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.all(16)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.t('deal.draft_${draft.kind}'), style: AppFonts.body(size: 12.5, weight: FontWeight.w700, color: AppColors.meta)),
                  Text('${inr(draft.price)}/${context.t('unit.per_${unitKey(unit)}')}', style: AppFonts.money(size: 18)),
                  if (qty != null) Text(context.t('unit.qty_${unitKey(unit)}', {'n': fmtNum(qty)}), style: AppFonts.body(size: 12.5, color: AppColors.meta)),
                ]),
              ),
              if (savings > 0)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(context.t('deal.savings'), style: AppFonts.body(size: 12, color: AppColors.meta)),
                  Text(inr(savings), style: AppFonts.money(size: 16, color: AppColors.success)),
                ]),
            ]),
          ),
        ],
        if (showAction) ...[
          const SizedBox(height: 10),
          PillButton(
            label: draft == null
                ? cleanLabel(p.actionLabel ?? '')
                : context.t(draft.kind == 'counter' ? 'deal.send_counter' : draft.kind == 'quote' ? 'deal.send_quote' : 'deal.send_offer'),
            icon: Icons.send_rounded,
            expand: true,
            loading: _busy,
            onPressed: _busy
                ? null
                : () async {
                    setState(() => _busy = true);
                    try {
                      await widget.ctx.chip(p.actionChipId!, cleanLabel(p.actionLabel ?? ''));
                      if (mounted) setState(() => _used = true);
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
          ),
        ],
        if (p.actionChipId != null && (_used || actedLater))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(children: [
              const Icon(Icons.check_rounded, size: 15, color: AppColors.success),
              const SizedBox(width: 4),
              Text(context.t('deal.sent'), style: AppFonts.body(size: 13, weight: FontWeight.w600, color: AppColors.success)),
            ]),
          ),
      ]),
    );
  }
}

/// A chip tap shown as the user's own bubble.
class ReplyBubble extends StatelessWidget {
  const ReplyBubble({super.key, required this.label, required this.mine});
  final String label;
  final bool mine;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(maxWidth: 300),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: mine ? AppColors.primary : AppColors.bubbleOther,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: Radius.circular(mine ? 6 : 20),
            bottomLeft: Radius.circular(mine ? 20 : 6),
            bottomRight: const Radius.circular(20),
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.touch_app_rounded, size: 16, color: mine ? AppColors.white : AppColors.meta),
          const SizedBox(width: 6),
          Flexible(child: Text(cleanLabel(label), style: AppFonts.body(size: 15, weight: FontWeight.w600, color: mine ? AppColors.white : AppColors.ink))),
        ]),
      );
}
