// CLAIRE Updates: order and payment notices on the Nexconn system channel (read-only).
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../app_services.dart';
import '../chat/chat_controller.dart';
import '../chat/chat_models.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import '../widgets/chat_view.dart';
import 'nav.dart';

class UpdatesScreen extends StatefulWidget {
  const UpdatesScreen({super.key});
  @override
  State<UpdatesScreen> createState() => _UpdatesScreenState();
}

class _UpdatesScreenState extends State<UpdatesScreen> {
  ChatController? _controller;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller != null) return;
    final services = AppServices.of(context);
    _controller = ChatController(channel: ChatChannel.updates, myLang: services.session.language, engine: services.engine, prepare: services.ensureChat);
    unawaited(_controller!.start());
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(context.t('inbox.updates')),
          bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: AppColors.line)),
        ),
        body: ChatView(
          controller: _controller!,
          readOnly: true,
          ctx: buildCardCtx(context, chip: (_, _) async {}, refresh: _controller!.load),
        ),
      );
}
