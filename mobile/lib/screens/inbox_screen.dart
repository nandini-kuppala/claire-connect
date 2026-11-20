// Inbox: Claire pinned, CLAIRE Updates, then deal chats (GET /api/conversations) with one status
// pill each; unread counts and previews come from the Nexconn channel list.
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../cards/format.dart';
import '../chat/chat_models.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/ui.dart';
import 'nav.dart';
import 'updates_screen.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<Map<String, dynamic>>? _rows;
  Map<String, ChannelSummary> _summaries = {};
  Object? _error;
  String _tab = 'all';
  StreamSubscription<ChatMessage>? _sub;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
      _sub = AppServices.of(context).engine.messages.listen((_) {
        _debounce?.cancel();
        _debounce = Timer(const Duration(milliseconds: 800), _load);
      });
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final services = AppServices.of(context);
    try {
      final r = await services.api.get('/api/conversations');
      final rows = r is List ? asMapList(r) : asMapList(asMap(r)['conversations']);
      if (mounted) {
        setState(() {
          _rows = rows;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
    try {
      await services.ensureChat();
      final list = await services.engine.listChannels();
      if (mounted) setState(() => _summaries = {for (final s in list) s.channel.key: s});
    } catch (_) {/* previews are optional */}
  }

  (String, Tone)? _status(BuildContext context, Map<String, dynamic> c) {
    if (c['kind'] == 'support' || asStrOrNull(c['agentUserId']) != null) return (context.t('status.support'), Tone.accent);
    final buyer = c['side'] == 'buyer';
    final o = asMapOrNull(c['latestOrder']);
    if (o != null) {
      final (key, tone) = orderStatusInfo(asStr(o['status']), buyer: buyer);
      return (context.t(key), tone);
    }
    final f = asMapOrNull(c['latestOffer']);
    if (f != null) {
      final price = '${inr(asNumOrNull(f['unitPrice']))}/${context.t('unit.per_${unitKey(asStrOrNull(f['unit']))}')}';
      final status = asStr(f['status']);
      final fromMe = asBool(f['fromMe']);
      if (status == 'pending' && !fromMe) return (context.t(asBool(f['counter']) ? 'status.counter' : 'status.offer_in', {'price': price}), Tone.clay);
      if (status == 'pending') return (context.t('status.offer_out', {'price': price}), Tone.neutral);
      if (status == 'accepted') return (context.t('status.confirmed', {'price': price}), Tone.success);
      return (context.t('status.negotiating'), Tone.neutral);
    }
    if (asBool(c['pendingOffer'])) return (context.t('status.offer_in', {'price': ''}).trim(), Tone.clay);
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    final buying = rows?.where((c) => c['side'] == 'buyer').length ?? 0;
    final selling = rows?.where((c) => c['side'] == 'seller').length ?? 0;
    final shown = rows?.where((c) => _tab == 'all' || (_tab == 'buying' ? c['side'] == 'buyer' : c['side'] == 'seller')).toList() ?? const [];
    final claire = _summaries[ChatChannel.claire.key];
    final updates = _summaries[ChatChannel.updates.key];

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Text(context.t('inbox.title'), style: AppFonts.head(size: 27)),
            const SizedBox(height: 14),
            if (rows != null && (buying > 0 && selling > 0))
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: SegmentedButton<String>(
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(selectedBackgroundColor: AppColors.primaryTint, selectedForegroundColor: AppColors.primary, side: const BorderSide(color: AppColors.line)),
                  segments: [
                    ButtonSegment(value: 'all', label: Text(context.t('inbox.tab_all', {'n': rows.length}))),
                    ButtonSegment(value: 'buying', label: Text(context.t('inbox.tab_buying', {'n': buying}))),
                    ButtonSegment(value: 'selling', label: Text(context.t('inbox.tab_selling', {'n': selling}))),
                  ],
                  selected: {_tab},
                  onSelectionChanged: (s) => setState(() => _tab = s.first),
                ),
              ),
            _pinnedRow(
              context,
              leading: const ClaireMark(size: 48),
              title: context.t('inbox.claire'),
              sub: claire?.latest != null ? previewText(claire!.latest, voice: context.t('chat.voice_note'), card: context.t('chat.card')) : context.t('inbox.claire_line'),
              unread: claire?.unread ?? 0,
              time: claire?.latest?.sentAt ?? 0,
              color: AppColors.plumTint,
              onTap: () => openClaire(context).then((_) => _load()),
            ),
            const SizedBox(height: 8),
            _pinnedRow(
              context,
              leading: const IconTile(icon: Icons.notifications_rounded, size: 48, round: true, bg: AppColors.accentTint, fg: AppColors.accentInk),
              title: context.t('inbox.updates'),
              sub: updates?.latest != null ? previewText(updates!.latest, voice: context.t('chat.voice_note'), card: context.t('chat.card')) : context.t('inbox.updates_sub'),
              unread: updates?.unread ?? 0,
              time: updates?.latest?.sentAt ?? 0,
              color: AppColors.surface,
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const UpdatesScreen())).then((_) => _load()),
            ),
            const SizedBox(height: 18),
            if (rows == null && _error == null) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            if (rows == null && _error != null) EmptyState(title: context.t('inbox.load_failed'), sub: errorText(context, _error), action: context.t('common.retry'), onAction: _load, icon: Icons.cloud_off_rounded),
            if (rows != null && rows.isEmpty)
              EmptyState(title: context.t('inbox.empty_title'), sub: context.t('inbox.empty_sub'), action: context.t('inbox.empty_cta'), onAction: () => openClaire(context)),
            for (final c in shown) _row(context, c),
          ],
        ),
      ),
    );
  }

  Widget _pinnedRow(BuildContext context, {required Widget leading, required String title, required String sub, required int unread, required int time, required Color color, required VoidCallback onTap}) =>
      Surface(
        radius: AppRadius.lg,
        color: color,
        padding: const EdgeInsets.all(12),
        onTap: onTap,
        child: Row(children: [
          leading,
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(title, style: AppFonts.body(size: 16, weight: FontWeight.w700))),
                if (time > 0) Text(shortTime(time, yesterday: context.t('common.yesterday')), style: AppFonts.body(size: 12, color: AppColors.meta)),
              ]),
              Row(children: [
                Expanded(child: Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13.5, color: AppColors.ink2))),
                if (unread > 0) _UnreadBadge(unread),
              ]),
            ]),
          ),
        ]),
      );

  Widget _row(BuildContext context, Map<String, dynamic> c) {
    final cp = asMap(c['counterpart']);
    final product = asMapOrNull(c['product']);
    final channelId = asStr(c['channelId'], asStr(c['id']));
    final sum = _summaries[ChatChannel.group(channelId).key];
    final at = (sum?.latest?.sentAt ?? 0) > asInt(c['lastAt']) ? sum!.latest!.sentAt : asInt(c['lastAt']);
    final status = _status(context, c);
    final art = asMap(product?['art']);
    final unread = sum?.unread ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: InkWell(
        borderRadius: AppRadius.all(18),
        onTap: () => openConversation(context, asStr(c['id'])).then((_) => _load()),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            InitialsAvatar(name: asStr(cp['name'], asStr(c['title'])), accent: asStrOrNull(cp['accent']), size: 48),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(asStr(cp['name'], asStr(c['title'])), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 16, weight: FontWeight.w700))),
                  const SizedBox(width: 6),
                  if (cp['trust'] != null) TrustPill(score: asInt(cp['trust']), compact: true),
                  const Spacer(),
                  Text(shortTime(at, yesterday: context.t('common.yesterday')), style: AppFonts.body(size: 12, color: unread > 0 ? AppColors.primary : AppColors.meta)),
                ]),
                const SizedBox(height: 3),
                if (product != null)
                  Row(children: [
                    GarmentThumb(shape: asStrOrNull(art['shape']), color: asStrOrNull(art['color']), size: 22),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${asStr(product['title'])} · ${context.t('unit.qty_${unitKey(asStrOrNull(product['unit']))}', {'n': fmtNum(asNumOrNull(product['qty']))})}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppFonts.body(size: 13, color: AppColors.ink2),
                      ),
                    ),
                  ])
                else
                  Text(sum?.latest != null ? previewText(sum!.latest, voice: context.t('chat.voice_note'), card: context.t('chat.card')) : asStr(c['lastText']), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, color: AppColors.ink2)),
                const SizedBox(height: 5),
                Row(children: [
                  if (status != null) Flexible(child: StatusPill(label: status.$1, tone: status.$2)),
                  const Spacer(),
                  if (unread > 0) _UnreadBadge(unread),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge(this.n);
  final int n;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 22),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: AppColors.clay, borderRadius: AppRadius.all(AppRadius.pill)),
        child: Text(n > 99 ? '99+' : '$n', textAlign: TextAlign.center, style: AppFonts.body(size: 12, weight: FontWeight.w700, color: AppColors.white, height: 1.3)),
      );
}
