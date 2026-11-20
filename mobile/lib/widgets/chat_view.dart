// Message list + composer for any channel, driven by a ChatController.
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../cards/card_payload.dart';
import '../cards/format.dart';
import '../chat/chat_controller.dart';
import '../chat/chat_models.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import 'brand.dart';
import 'cards/card_ctx.dart';
import 'cards/card_renderer.dart';
import 'cards/deal_cards.dart';
import 'ui.dart';

class ChatView extends StatefulWidget {
  const ChatView({
    super.key,
    required this.controller,
    required this.ctx,
    this.placeholder,
    this.footer,
    this.names = const {},
    this.readOnly = false,
    this.showSenderNames = false,
  });

  final ChatController controller;
  final CardCtx ctx;
  final String? placeholder;

  /// Between the list and the composer (quick replies).
  final Widget? footer;

  /// Sender labels in group chats (Claire, Trade Desk agent…).
  final Map<String, String> names;
  final bool readOnly;
  final bool showSenderNames;

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  final _scroll = ScrollController();
  final _input = TextEditingController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      // Reversed list: the oldest messages are at the max extent.
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 120) widget.controller.loadOlder();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    _input.clear();
    setState(() {});
    widget.controller.sendText(text);
    if (_scroll.hasClients) _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = widget.controller;
        final items = c.visible.reversed.toList();
        final latest = c.latestCardBySender;
        return Column(children: [
          Expanded(
            child: c.loading && items.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : c.error != null && items.isEmpty
                    ? EmptyState(title: context.t('chat.load_failed'), sub: errorText(context, c.error), action: context.t('common.retry'), onAction: c.load, icon: Icons.cloud_off_rounded)
                    : ListView.builder(
                        controller: _scroll,
                        reverse: true,
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        itemCount: items.length + 2,
                        itemBuilder: (context, i) {
                          if (i == 0) return _typingRow(context, c);
                          if (i == items.length + 1) {
                            return c.loadingOlder
                                ? const Padding(padding: EdgeInsets.all(12), child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))))
                                : const SizedBox(height: 4);
                          }
                          final m = items[i - 1];
                          final older = i < items.length ? items[i] : null;
                          final grouped = older != null && older.senderId == m.senderId && m.sentAt - older.sentAt < 120000;
                          return Padding(
                            padding: EdgeInsets.only(top: grouped ? 4 : 12),
                            child: _message(context, m, latest[m.senderId], showName: !grouped),
                          );
                        },
                      ),
          ),
          ?widget.footer,
          if (!widget.readOnly) _composer(context),
        ]);
      },
    );
  }

  Widget _typingRow(BuildContext context, ChatController c) {
    if (!c.thinking && !c.peerTyping) return const SizedBox(height: 4);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(children: [
        if (c.thinking) const ClaireMark(size: 26),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(color: AppColors.bubbleOther, borderRadius: AppRadius.all(18)),
          child: Text(context.t(c.thinking ? 'chat.thinking' : 'chat.typing'), style: AppFonts.body(size: 13.5, color: AppColors.meta)),
        ),
      ]),
    );
  }

  Widget _message(BuildContext context, ChatMessage m, int? latestCardAt, {required bool showName}) {
    final c = widget.controller;
    final ctx = widget.ctx.withLatest(latestCardAt);
    final label = !m.mine && widget.showSenderNames && showName ? widget.names[m.senderId] : null;
    Widget body;
    var align = m.mine ? Alignment.centerRight : Alignment.centerLeft;
    switch (m.type) {
      case rcText:
      case rcStream:
        final tr = c.translations[m.id];
        body = MessageBubble(
          text: m.text,
          mine: m.mine,
          sentAt: m.sentAt,
          status: m.status,
          translation: tr,
          showOriginal: c.showOriginal.contains(m.id),
          onToggleOriginal: () => c.toggleOriginal(m.id),
          onRetryTranslation: () => c.retryTranslation(m),
          onRetrySend: () => c.retry(m),
        );
      case ccReply:
        body = ReplyBubble(label: asStr(m.content['label'], asStr(m.content['chipId'])), mine: m.mine);
      case ccHint:
        body = HintBubble(payload: HintPayload.fromJson(m.content), ctx: ctx, sentAt: m.sentAt);
      case ccVoice:
        final tr = c.translations['${m.id}:v'];
        final transcript = asStr(m.content['transcript']);
        body = MessageBubble(
          text: transcript.isEmpty ? context.t('chat.voice_note') : transcript,
          mine: m.mine,
          sentAt: m.sentAt,
          status: m.status,
          voice: true,
          translation: tr,
          showOriginal: c.showOriginal.contains('${m.id}:v'),
          onToggleOriginal: () => c.toggleOriginal('${m.id}:v'),
          onRetryTranslation: () => c.retryTranslation(m),
        );
      case rcVoice:
        body = MessageBubble(text: context.t('chat.voice_note'), mine: m.mine, sentAt: m.sentAt, voice: true);
      case ccCard:
        if (isSystemCard(m.content)) align = Alignment.center;
        body = CardRenderer(message: m, ctx: ctx);
      default:
        body = const SizedBox.shrink();
    }
    return Align(
      alignment: align,
      child: Column(
        crossAxisAlignment: m.mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (label != null)
            Padding(
              padding: const EdgeInsets.only(left: 6, bottom: 3),
              child: Text(label, style: AppFonts.body(size: 12, weight: FontWeight.w700, color: m.senderId == claireId ? AppColors.primary : AppColors.meta)),
            ),
          body,
        ],
      ),
    );
  }

  Widget _composer(BuildContext context) {
    final hasText = _input.text.trim().isNotEmpty;
    return Container(
      decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.line))),
      padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + MediaQuery.paddingOf(context).bottom),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: TextField(
            controller: _input,
            minLines: 1,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _send(),
            onChanged: (_) {
              setState(() {});
              widget.controller.typed();
            },
            style: AppFonts.body(size: 16),
            decoration: InputDecoration(
              hintText: widget.placeholder ?? context.t('chat.placeholder'),
              filled: true,
              fillColor: AppColors.sunken,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(borderRadius: AppRadius.all(22), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: AppRadius.all(22), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: AppRadius.all(22), borderSide: const BorderSide(color: AppColors.primary)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Material(
          color: hasText ? AppColors.primary : AppColors.primarySoft,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: hasText ? _send : null,
            child: SizedBox(
              width: 48,
              height: 48,
              child: Icon(Icons.arrow_upward_rounded, color: AppColors.white, semanticLabel: context.t('chat.send')),
            ),
          ),
        ),
      ]),
    );
  }
}

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.text,
    required this.mine,
    required this.sentAt,
    this.status = SendStatus.sent,
    this.translation,
    this.showOriginal = false,
    this.onToggleOriginal,
    this.onRetryTranslation,
    this.onRetrySend,
    this.voice = false,
  });

  final String text;
  final bool mine;
  final int sentAt;
  final SendStatus status;
  final TranslationState? translation;
  final bool showOriginal;
  final VoidCallback? onToggleOriginal;
  final VoidCallback? onRetryTranslation;
  final VoidCallback? onRetrySend;
  final bool voice;

  @override
  Widget build(BuildContext context) {
    final translated = translation?.text;
    final shown = translated != null && !showOriginal ? translated : text;
    final fg = mine ? AppColors.ink : AppColors.ink;
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 9, 14, 7),
        decoration: BoxDecoration(
          color: mine ? AppColors.bubbleOwn : AppColors.bubbleOther,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: Radius.circular(mine ? 6 : 20),
            bottomLeft: Radius.circular(mine ? 20 : 6),
            bottomRight: const Radius.circular(20),
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (voice)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.mic_rounded, size: 15, color: AppColors.primary),
                const SizedBox(width: 4),
                Text(context.t('chat.voice_note'), style: AppFonts.body(size: 12, weight: FontWeight.w700, color: AppColors.primary)),
              ]),
            ),
          Text(shown, style: AppFonts.body(size: 15.5, color: fg)),
          const SizedBox(height: 3),
          Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
            if (translated != null)
              GestureDetector(
                onTap: onToggleOriginal,
                child: Text(
                  showOriginal ? context.t('chat.show_translation') : context.t('chat.translated_show_original'),
                  style: AppFonts.body(size: 12, weight: FontWeight.w600, color: AppColors.primary),
                ),
              ),
            if (translation?.failed == true)
              GestureDetector(
                onTap: onRetryTranslation,
                child: Text(context.t('chat.translate_retry'), style: AppFonts.body(size: 12, weight: FontWeight.w600, color: AppColors.clay)),
              ),
            if (status == SendStatus.failed)
              GestureDetector(
                onTap: onRetrySend,
                child: Text(context.t('chat.send_failed'), style: AppFonts.body(size: 12, weight: FontWeight.w700, color: AppColors.danger)),
              )
            else
              Text(
                status == SendStatus.sending ? context.t('chat.sending') : clockTime(sentAt),
                style: AppFonts.body(size: 11.5, color: AppColors.meta),
              ),
          ]),
        ]),
      ),
    );
  }
}
