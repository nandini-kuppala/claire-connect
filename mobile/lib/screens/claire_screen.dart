// Claire, the AI trade assistant: Nexconn DirectChannel('claire'). The app sends through the SDK,
// then notifies the server (POST /api/claire/turn); Claire's replies arrive as chat messages.
// First open with empty history → POST /api/claire/welcome.
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../app_services.dart';
import '../chat/chat_controller.dart';
import '../chat/chat_models.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/chat_view.dart';
import 'language_screen.dart';
import 'nav.dart';

class ClaireScreen extends StatefulWidget {
  const ClaireScreen({super.key, this.initialText, this.initialChipId, this.initialChipLabel});

  /// Sent once as the user's message (Home search / examples).
  final String? initialText;

  /// Tapped once like a chip (Home quick actions).
  final String? initialChipId;
  final String? initialChipLabel;

  @override
  State<ClaireScreen> createState() => _ClaireScreenState();
}

class _ClaireScreenState extends State<ClaireScreen> {
  ChatController? _controller;
  bool _handoffDone = false;

  bool get _hasHandoff => (widget.initialText?.trim().isNotEmpty ?? false) || widget.initialChipId != null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller != null) return;
    final services = AppServices.of(context);
    final api = services.api;
    final c = ChatController(
      channel: ChatChannel.claire,
      myLang: services.session.language,
      engine: services.engine,
      aiReplies: true,
      prepare: services.ensureChat,
      onSend: (text, messageId) async => api.post('/api/claire/turn', {'text': text, 'messageId': messageId}),
      onChip: (chipId, label, messageId) async => api.post('/api/claire/turn', {'chipId': chipId, 'messageId': ?messageId}),
      // The welcome card resets Claire's session, so skip it when the user arrives with something to say.
      onEmpty: _hasHandoff ? null : () async => api.post('/api/claire/welcome', {}),
    );
    _controller = c;
    unawaited(c.start().then((_) => _runHandoff()));
  }

  Future<void> _runHandoff() async {
    if (_handoffDone || !_hasHandoff || !mounted) return;
    _handoffDone = true;
    final c = _controller!;
    final text = widget.initialText?.trim();
    if (text != null && text.isNotEmpty) {
      await c.sendText(text);
    } else if (widget.initialChipId != null) {
      await c.chip(widget.initialChipId!, widget.initialChipLabel ?? widget.initialChipId!);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final services = AppServices.of(context);
    final c = _controller!;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(children: [
          const ClaireMark(size: 40),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.t('claire.title'), style: AppFonts.head(size: 17, weight: FontWeight.w600)),
              Text(context.t('claire.sub'), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 12.5, color: AppColors.meta)),
            ]),
          ),
        ]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: ActionChip(
              avatar: const Icon(Icons.translate_rounded, size: 16, color: AppColors.meta),
              label: Text(langNative(services.session.language), style: AppFonts.body(size: 13, weight: FontWeight.w600)),
              shape: const StadiumBorder(side: BorderSide(color: AppColors.line)),
              backgroundColor: AppColors.surface,
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LanguageScreen())),
            ),
          ),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: AppColors.line)),
      ),
      body: ChatView(
        controller: c,
        placeholder: context.t('claire.placeholder'),
        ctx: buildCardCtx(context, chip: c.chip, refresh: c.load),
      ),
    );
  }
}
