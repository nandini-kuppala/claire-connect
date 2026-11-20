// Orders (GET /api/orders): one row per order with its status from my side; tap for the order
// card with the next action, or jump to the deal chat.
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../cards/card_payload.dart';
import '../cards/format.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import '../widgets/cards/deal_cards.dart';
import '../widgets/ui.dart';
import 'nav.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<Map<String, dynamic>>? _orders;
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final r = await AppServices.of(context).api.get('/api/orders');
      final list = r is List ? asMapList(r) : asMapList(asMap(r)['orders']);
      if (mounted) {
        setState(() {
          _orders = list;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _open(Map<String, dynamic> o) {
    final card = asMapOrNull(o['card']);
    final conv = asStrOrNull(o['conversationId'] ?? o['conversation_id']);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (c) => SheetBody(
        title: asStr(o['code']),
        children: [
          if (card != null)
            Center(
              child: OrderCardView(
                payload: OrderCard.fromJson(card),
                ctx: buildCardCtx(c, chip: (_, _) async {}, refresh: () {
                  Navigator.pop(c);
                  _load();
                }),
              ),
            ),
          if (conv != null) ...[
            const SizedBox(height: 12),
            PillButton(
              label: c.t('orders.open_chat'),
              icon: Icons.chat_bubble_rounded,
              variant: PillVariant.secondary,
              expand: true,
              onPressed: () {
                Navigator.pop(c);
                openConversation(context, conv).then((_) => _load());
              },
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final orders = _orders;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Text(context.t('orders.title'), style: AppFonts.head(size: 27)),
            const SizedBox(height: 14),
            if (orders == null && _error == null) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            if (orders == null && _error != null) EmptyState(title: context.t('orders.load_failed'), sub: errorText(context, _error), action: context.t('common.retry'), onAction: _load, icon: Icons.cloud_off_rounded),
            if (orders != null && orders.isEmpty)
              EmptyState(title: context.t('orders.empty_title'), sub: context.t('orders.empty_sub'), action: context.t('inbox.empty_cta'), onAction: () => openClaire(context), icon: Icons.inventory_2_outlined),
            if (orders != null)
              for (final o in orders) Padding(padding: const EdgeInsets.only(bottom: 10), child: _row(context, o)),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> o) {
    final buyer = o['side'] != 'seller';
    final (key, tone) = orderStatusInfo(asStr(o['status']), buyer: buyer);
    final cp = asMap(o['counterpart']);
    final unit = unitKey(asStrOrNull(o['unit']));
    final isSample = o['kind'] == 'sample';
    return Surface(
      radius: AppRadius.lg,
      padding: const EdgeInsets.all(14),
      onTap: () => _open(o),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconTile(icon: isSample ? Icons.science_rounded : Icons.inventory_2_rounded, size: 44, round: true, bg: buyer ? AppColors.primaryTint : AppColors.accentTint, fg: buyer ? AppColors.primary : AppColors.accentInk),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(asStr(o['title']), maxLines: 2, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 15, weight: FontWeight.w700, height: 1.3)),
            const SizedBox(height: 2),
            Text(
              '${buyer ? context.t('orders.from', {'name': asStr(cp['name'])}) : context.t('orders.to', {'name': asStr(cp['name'])})} · ${asStr(o['code'])}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppFonts.body(size: 13, color: AppColors.meta),
            ),
            Text(
              '${context.t('unit.qty_$unit', {'n': fmtNum(asNumOrNull(o['qty']))})}${isSample ? ' · ${context.t('orders.sample')}' : ''}',
              style: AppFonts.body(size: 13, color: AppColors.ink2),
            ),
            const SizedBox(height: 6),
            StatusPill(label: context.t(key), tone: tone),
          ]),
        ),
        const SizedBox(width: 8),
        Text(inr(asNumOrNull(o['total'])), style: AppFonts.money(size: 16)),
      ]),
    );
  }
}
