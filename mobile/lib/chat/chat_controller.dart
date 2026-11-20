// Per-channel chat state: history, live messages, optimistic sends, chip taps, translations.
// Screens hook in with onSend / onChip / onEmpty to notify the server (client → server notify
// pattern from docs/BUILD_CONTRACT.md).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/json.dart';
import 'chat_engine.dart';
import 'chat_models.dart';
import 'translator.dart';

typedef SendHook = Future<void> Function(String text, String messageId);
typedef ChipHook = Future<void> Function(String chipId, String label, String? messageId);

class TranslationState {
  const TranslationState({this.text, this.failed = false});
  final String? text;
  final bool failed;
}

const Set<String> renderedTypes = {rcText, rcStream, rcVoice, ccCard, ccHint, ccReply, ccVoice};

class ChatController extends ChangeNotifier {
  ChatController({
    required this.channel,
    required this.myLang,
    ChatEngine? engine,
    this.translator,
    this.counterpartLang,
    this.onSend,
    this.onChip,
    this.onEmpty,
    this.echoChips = true,
    this.aiReplies = false,
    this.prepare,
  }) : engine = engine ?? ChatEngine.instance;

  final ChatChannel channel;
  final ChatEngine engine;
  final Translator? translator;
  final String myLang;

  /// Language the other side writes in; null or equal to [myLang] → no translation.
  String? counterpartLang;
  final SendHook? onSend;
  final ChipHook? onChip;
  final Future<void> Function()? onEmpty;

  /// Echo chip taps as a CC:Reply bubble (deal tips are private, so false there).
  final bool echoChips;

  /// Show a "thinking" indicator after sends (Claire chat).
  final bool aiReplies;

  /// Runs before every (re)load, e.g. to (re)connect the chat engine.
  final Future<void> Function()? prepare;

  List<ChatMessage> _messages = [];
  bool loading = true;
  bool loadingOlder = false;
  bool hasMore = true;
  Object? error;
  bool thinking = false;
  bool peerTyping = false;
  final Map<String, TranslationState> translations = {};
  final Set<String> showOriginal = {};
  final Set<String> _requested = {};

  StreamSubscription<ChatMessage>? _sub;
  StreamSubscription<TypingEvent>? _typingSub;
  Timer? _thinkingTimer;
  Timer? _typingTimer;
  bool _emptyCalled = false;
  bool _disposed = false;
  int _seq = 0;

  /// Fires for every message from the other side (screens refresh deal data on new cards).
  void Function(ChatMessage m)? onIncoming;

  List<ChatMessage> get messages => List.unmodifiable(_messages);

  Future<void> start() async {
    _sub = engine.messages.where((m) => m.channel == channel).listen(_onIncoming);
    _typingSub = engine.typing.where((e) => e.channel == channel).listen((_) {
      peerTyping = true;
      _typingTimer?.cancel();
      _typingTimer = Timer(const Duration(seconds: 6), () {
        peerTyping = false;
        _notify();
      });
      _notify();
    });
    await load();
  }

  Future<void> load() async {
    loading = true;
    error = null;
    _notify();
    try {
      final prep = prepare;
      if (prep != null) await prep();
      final page = await engine.history(channel);
      _messages = page.fold(_messages.where((m) => m.status == SendStatus.sending).toList(), upsertMessage);
      hasMore = page.length >= ChatEngine.historyPage;
      engine.markRead(channel, page.where((m) => !m.mine).map((m) => m.id).toList());
      if (page.isEmpty && onEmpty != null && !_emptyCalled) {
        _emptyCalled = true;
        _startThinking();
        unawaited(onEmpty!().catchError((_) => _stopThinking()));
      }
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      _notify();
      _translateVisible();
    }
  }

  Future<void> loadOlder() async {
    if (loadingOlder || !hasMore || _messages.isEmpty) return;
    loadingOlder = true;
    _notify();
    try {
      final oldest = _messages.firstWhere((m) => m.status != SendStatus.sending, orElse: () => _messages.first);
      final page = await engine.history(channel, before: oldest.sentAt);
      _messages = page.fold(_messages, upsertMessage);
      hasMore = page.length >= ChatEngine.historyPage;
    } catch (_) {
      hasMore = false;
    } finally {
      loadingOlder = false;
      _notify();
      _translateVisible();
    }
  }

  void _onIncoming(ChatMessage m) {
    _messages = upsertMessage(_messages, m);
    if (!m.mine) {
      _stopThinking();
      peerTyping = false;
      engine.markRead(channel, [m.id]);
      onIncoming?.call(m);
    }
    _notify();
    _translateVisible();
  }

  // ── Visible list ────────────────────────────────────────────────────────
  /// Known types only, newest order card per orderId, no empty texts.
  List<ChatMessage> get visible => visibleMessages(_messages);

  /// Newest card time per sender: older chip cards from the same sender can no longer be tapped.
  Map<String, int> get latestCardBySender {
    final out = <String, int>{};
    for (final m in visible) {
      if (m.type == ccCard) out[m.senderId] = m.sentAt > (out[m.senderId] ?? 0) ? m.sentAt : out[m.senderId]!;
    }
    return out;
  }

  // ── Sending ─────────────────────────────────────────────────────────────
  String _localId() => 'local_${DateTime.now().microsecondsSinceEpoch}_${++_seq}';

  Future<void> sendText(String text, {String? retryId}) async {
    final t = text.trim();
    if (t.isEmpty) return;
    final localId = retryId ?? _localId();
    if (retryId != null) {
      _messages = _messages.map((m) => m.id == retryId ? m.copyWith(status: SendStatus.sending) : m).toList();
    } else {
      _messages = [
        ..._messages,
        ChatMessage(id: localId, channel: channel, senderId: engine.myId, type: rcText, content: {'text': t}, sentAt: DateTime.now().millisecondsSinceEpoch, mine: true, status: SendStatus.sending),
      ];
    }
    _notify();
    ChatMessage sent;
    try {
      sent = await engine.sendText(channel, t);
    } catch (_) {
      _markFailed(localId);
      return;
    }
    _messages = upsertMessage(_messages, sent.copyWith(localId: localId));
    _startThinking();
    _notify();
    final hook = onSend;
    if (hook != null) await _runHook(() => hook(t, sent.id));
  }

  Future<void> chip(String chipId, String label) async {
    String? messageId;
    if (echoChips) {
      final localId = _localId();
      _messages = [
        ..._messages,
        ChatMessage(id: localId, channel: channel, senderId: engine.myId, type: ccReply, content: {'chipId': chipId, 'label': label}, sentAt: DateTime.now().millisecondsSinceEpoch, mine: true, status: SendStatus.sending),
      ];
      _notify();
      try {
        final sent = await engine.sendCustom(channel, ccReply, {'chipId': chipId, 'label': label});
        messageId = sent.id;
        _messages = upsertMessage(_messages, sent.copyWith(localId: localId));
      } catch (_) {
        _markFailed(localId);
      }
    }
    _startThinking();
    _notify();
    // The chip's action matters more than its echo bubble, so notify the server either way.
    final hook = onChip;
    if (hook != null) await _runHook(() => hook(chipId, label, messageId));
  }

  void retry(ChatMessage m) {
    if (m.type == rcText) unawaited(sendText(m.text, retryId: m.id));
  }

  void typed() => engine.sendTyping(channel);

  Future<void> _runHook(Future<void> Function() fn) async {
    try {
      await fn();
    } catch (e) {
      _stopThinking();
      error = e;
      _notify();
    }
  }

  void _markFailed(String localId) {
    _messages = _messages.map((m) => m.id == localId ? m.copyWith(status: SendStatus.failed) : m).toList();
    _notify();
  }

  void _startThinking() {
    if (!aiReplies) return;
    thinking = true;
    _thinkingTimer?.cancel();
    _thinkingTimer = Timer(const Duration(seconds: 45), _stopThinking);
  }

  void _stopThinking() {
    _thinkingTimer?.cancel();
    if (!thinking) return;
    thinking = false;
    _notify();
  }

  // ── Translation ─────────────────────────────────────────────────────────
  bool get needsTranslation {
    final c = counterpartLang;
    return translator != null && c != null && c.isNotEmpty && c != myLang;
  }

  TranslateRequest? translationRequest(ChatMessage m) {
    if (translator == null || m.mine || m.status == SendStatus.sending) return null;
    if (m.type == ccVoice) {
      final tr = asStr(m.content['transcript']);
      final lang = asStr(m.content['lang']);
      if (tr.trim().isEmpty || lang.isEmpty || lang == myLang) return null;
      return TranslateRequest(id: '${m.id}:v', text: tr, from: lang);
    }
    if (!needsTranslation || botIds.contains(m.senderId)) return null;
    if (m.type == rcText && m.text.trim().isNotEmpty) return TranslateRequest(id: m.id, text: m.text, from: counterpartLang);
    return null;
  }

  void _translateVisible() {
    final tr = translator;
    if (tr == null) return;
    final reqs = <TranslateRequest>[];
    for (final m in visible) {
      final r = translationRequest(m);
      if (r == null) continue;
      final k = '${r.id}|${r.text.length}';
      if (_requested.add(k)) reqs.add(r);
    }
    if (reqs.isEmpty) return;
    unawaited(_runTranslations(reqs));
  }

  Future<void> _runTranslations(List<TranslateRequest> reqs) async {
    final result = await translator!.translate(reqs, myLang);
    for (final r in reqs) {
      final t = result[r.id];
      translations[r.id] = t == null ? const TranslationState(failed: true) : TranslationState(text: isDifferent(t, r.text) ? t : null);
    }
    _notify();
  }

  void retryTranslation(ChatMessage m) {
    final r = translationRequest(m);
    if (r == null) return;
    translations.remove(r.id);
    _notify();
    unawaited(_runTranslations([r]));
  }

  void toggleOriginal(String id) {
    if (!showOriginal.remove(id)) showOriginal.add(id);
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _sub?.cancel();
    _typingSub?.cancel();
    _thinkingTimer?.cancel();
    _typingTimer?.cancel();
    super.dispose();
  }
}

String _signature(ChatMessage m) {
  if (m.type == rcText) return 't:${m.text}';
  if (m.type == ccReply) return 'r:${m.content['chipId']}';
  return '${m.type}:${m.content}';
}

/// Insert or replace by id / optimistic local id / pending signature; keeps ascending order.
List<ChatMessage> upsertMessage(List<ChatMessage> list, ChatMessage m) {
  final next = List<ChatMessage>.of(list);
  final byId = next.indexWhere((x) => x.id == m.id);
  final byLocal = m.localId == null ? -1 : next.indexWhere((x) => x.id == m.localId);
  if (byLocal >= 0) {
    next[byLocal] = m.copyWith(clearLocalId: true);
    if (byId >= 0 && byId != byLocal) next.removeAt(byId);
  } else if (byId >= 0) {
    next[byId] = m.copyWith(clearLocalId: true);
  } else {
    final pending = m.mine ? next.indexWhere((x) => x.status == SendStatus.sending && x.type == m.type && _signature(x) == _signature(m)) : -1;
    if (pending >= 0) {
      next[pending] = m;
    } else {
      next.add(m);
    }
  }
  // Stable insertion sort by time (lists are almost sorted).
  for (var i = 1; i < next.length; i++) {
    final cur = next[i];
    var j = i - 1;
    while (j >= 0 && next[j].sentAt > cur.sentAt && next[j].status != SendStatus.sending) {
      next[j + 1] = next[j];
      j--;
    }
    next[j + 1] = cur;
  }
  return next;
}

/// Known types only, newest order card per orderId, no empty texts.
List<ChatMessage> visibleMessages(List<ChatMessage> messages) {
  final seenOrders = <String>{};
  final out = <ChatMessage>[];
  for (var i = messages.length - 1; i >= 0; i--) {
    final m = messages[i];
    if (!renderedTypes.contains(m.type)) continue;
    if (m.type == ccCard && m.content['kind'] == 'order') {
      final id = asStr(m.content['orderId']);
      if (id.isNotEmpty && !seenOrders.add(id)) continue;
    }
    if ((m.type == rcText || m.type == rcStream) && m.text.trim().isEmpty) continue;
    out.add(m);
  }
  return out.reversed.toList();
}
