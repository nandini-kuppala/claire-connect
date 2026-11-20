// Single chat facade over the official Nexconn Flutter Chat SDK (ai_nexconn_chat_plugin),
// mirroring web/src/chat/engine.ts: initialise once with the App Key + area, register the CLAIRE
// custom message types before connecting, connect with the per-user token from /api/me, then expose
// a broadcast stream of normalised messages for every channel (Claire direct channel, deal group
// channels, CLAIRE Updates system channel).
import 'dart:async';

import 'package:ai_nexconn_chat_plugin/ai_nexconn_chat_plugin.dart';
import 'package:flutter/foundation.dart';

import '../session/session_store.dart';
import 'chat_models.dart';

enum ConnState { idle, connecting, connected, disconnected, error }

class ChatException implements Exception {
  ChatException(this.code, [this.detail]);
  final int code;
  final String? detail;
  @override
  String toString() => 'ChatException($code${detail == null ? '' : ': $detail'})';
}

class ChatEngine {
  ChatEngine._();
  static final ChatEngine instance = ChatEngine._();

  // The SDK rejects pages above 20 for remote history (RCIMIWErrorCodeParamError -101).
  static const int historyPage = 20;

  /// CC:Card / CC:Reply / CC:Voice are stored and counted as unread; CC:Hint is stored only.
  static const Map<String, CustomMessagePersistentFlag> customTypes = {
    ccCard: CustomMessagePersistentFlag.counted,
    ccHint: CustomMessagePersistentFlag.persisted,
    ccReply: CustomMessagePersistentFlag.counted,
    ccVoice: CustomMessagePersistentFlag.counted,
  };

  final _messages = StreamController<ChatMessage>.broadcast();
  final _typing = StreamController<TypingEvent>.broadcast();
  final ValueNotifier<ConnState> state = ValueNotifier(ConnState.idle);

  Stream<ChatMessage> get messages => _messages.stream;
  Stream<TypingEvent> get typing => _typing.stream;

  String myId = '';
  String? _initializedKey;
  Future<void>? _connecting;
  String? _connectedToken;
  final Map<String, Message> _latestRaw = {};
  final Map<String, ChatMessage> _streams = {};
  final Map<String, int> _typingSentAt = {};

  bool get isConnected => state.value == ConnState.connected;

  // ── Connection ──────────────────────────────────────────────────────────
  Future<void> connect(ChatCreds creds, {required String userId, required String language}) {
    if (!creds.isNexconn) {
      state.value = ConnState.error;
      return Future.error(ChatException(-2, 'chat mode ${creds.mode} has no Nexconn token'));
    }
    if (_connecting != null && _connectedToken == creds.token) return _connecting!;
    _connectedToken = creds.token;
    myId = userId;
    final f = _connect(creds, language).catchError((Object e) {
      _connecting = null;
      _connectedToken = null;
      state.value = ConnState.error;
      throw e;
    });
    _connecting = f;
    return f;
  }

  Future<void> _connect(ChatCreds creds, String language) async {
    await _initialize(creds);
    state.value = ConnState.connecting;
    final done = Completer<String>();
    final code = await NCEngine.connect(ConnectParams(token: creds.token, timeout: 30), (userId, error) {
      if (done.isCompleted) return;
      if (error == null || (error.code ?? 0) == 0) {
        done.complete(userId ?? myId);
      } else {
        done.completeError(ChatException(error.code ?? -1, error.message ?? error.reason));
      }
    });
    if (code != 0 && !done.isCompleted) done.completeError(ChatException(code));
    final id = await done.future.timeout(const Duration(seconds: 40), onTimeout: () => throw ChatException(-3, 'connect timeout'));
    if (id.isNotEmpty) myId = id;
    state.value = ConnState.connected;
    setTranslationLanguage(language);
  }

  Future<void> _initialize(ChatCreds creds) async {
    if (_initializedKey == creds.appKey && NCEngine.isInitialized) return;
    await NCEngine.initialize(InitParams(appKey: creds.appKey, areaCode: _area(creds.area), logLevel: LogLevel.none));
    // Custom types must be registered on the initialised engine and before connect.
    for (final e in customTypes.entries) {
      await NCEngine.registerCustomMessage(e.key, e.value);
    }
    _bindHandlers();
    _initializedKey = creds.appKey;
  }

  static AreaCode _area(String area) => switch (area.toUpperCase()) {
        'BJ' || 'CN' => AreaCode.bj,
        'NA' || 'US' => AreaCode.na,
        'SA' => AreaCode.sa,
        'OM' => AreaCode.om,
        _ => AreaCode.sg,
      };

  void _bindHandlers() {
    NCEngine.addConnectionStatusHandler('cc-conn', (event) {
      switch (event.status) {
        case ConnectionStatus.connected:
          state.value = ConnState.connected;
        case ConnectionStatus.connecting:
        case ConnectionStatus.suspend:
          state.value = ConnState.connecting;
        case ConnectionStatus.unknown:
          break;
        default:
          state.value = ConnState.disconnected;
      }
    });

    NCEngine.addMessageHandler(
      'cc-msg',
      MessageHandler(
        onMessageReceived: (event) {
          final cm = _fromNC(event.message);
          if (cm == null) return;
          _remember(event.message, cm);
          _messages.add(cm);
          _trackStream(event.message, cm);
        },
        onStreamMessageRequestDelta: (event) {
          final id = event.message?.messageId;
          final base = id == null ? null : _streams[id];
          if (base == null) return;
          final chunk = event.chunkInfo?.content ?? '';
          final text = chunk.startsWith(base.text) ? chunk : '${base.text}$chunk';
          final next = base.copyWith(content: {...base.content, 'text': text, 'complete': false});
          _streams[id!] = next;
          _messages.add(next);
        },
        onStreamMessageRequestComplete: (event) {
          final base = _streams.remove(event.messageId);
          if (base != null) _messages.add(base.copyWith(content: {...base.content, 'complete': true}));
        },
      ),
    );

    NCEngine.addChannelHandler(
      'cc-channel',
      ChannelHandler(
        onTypingStatusChanged: (event) {
          final channel = _channelOf(event.channelIdentifier.channelType, event.channelIdentifier.channelId);
          if (channel == null) return;
          for (final s in event.userTypingStatus ?? const <ChannelUserTypingStatusInfo>[]) {
            final uid = s.userId ?? '';
            if (uid.isEmpty || uid == myId) continue;
            _typing.add(TypingEvent(channel, uid, s.sentTime ?? DateTime.now().millisecondsSinceEpoch));
          }
        },
      ),
    );
  }

  Future<void> disconnect() async {
    _connecting = null;
    _connectedToken = null;
    _latestRaw.clear();
    _streams.clear();
    if (NCEngine.isInitialized) {
      try {
        await NCEngine.disconnect();
      } catch (_) {/* already offline */}
    }
    state.value = ConnState.idle;
  }

  // ── Normalisation ───────────────────────────────────────────────────────
  static ChatChannel? _channelOf(ChannelType? type, String? id) {
    if (type == null || id == null || id.isEmpty) return null;
    return switch (type) {
      ChannelType.direct => ChatChannel.direct(id),
      ChannelType.group => ChatChannel.group(id),
      ChannelType.system => ChatChannel.system(id),
      _ => null,
    };
  }

  /// Returns null for message kinds the app does not render (group notifications, commands…).
  ChatMessage? _fromNC(Message m, {ChatChannel? channel}) {
    final ch = channel ?? _channelOf(m.channelType, m.channelId);
    if (ch == null) return null;
    String type;
    Object? raw;
    if (m is TextMessage) {
      type = rcText;
      raw = {'text': m.text ?? ''};
    } else if (m is StreamMessage) {
      type = rcStream;
      raw = {'text': m.content ?? '', 'complete': m.complete ?? true};
    } else if (m is CustomMessage) {
      type = m.messageIdentifier ?? 'CC:Unknown';
      raw = m.fields ?? const {};
    } else if (m is UnknownMessage) {
      // Unregistered type: the SDK hands over the raw JSON content.
      type = m.objectName ?? 'unknown';
      raw = m.rawData;
    } else if (m is HDVoiceMessage) {
      type = rcVoice;
      raw = const {};
    } else {
      return null;
    }
    final sender = m.senderUserId ?? '';
    final mine = (myId.isNotEmpty && sender == myId) || m.direction == MessageDirection.send;
    return ChatMessage(
      id: (m.messageId?.isNotEmpty ?? false) ? m.messageId! : 'tmp_${m.clientId ?? DateTime.now().microsecondsSinceEpoch}',
      channel: ch,
      senderId: sender.isEmpty && mine ? myId : sender,
      type: type,
      content: normalizeContent(type, raw),
      sentAt: m.sentTime ?? DateTime.now().millisecondsSinceEpoch,
      mine: mine,
    );
  }

  void _remember(Message raw, ChatMessage cm) {
    final prev = _latestRaw[cm.channel.key];
    if (prev == null || (prev.sentTime ?? 0) <= cm.sentAt) _latestRaw[cm.channel.key] = raw;
  }

  /// RC:StreamMsg arrives with the first chunk only; ask the SDK for the rest.
  void _trackStream(Message m, ChatMessage cm) {
    if (m is! StreamMessage || cm.type != rcStream || asBoolContent(cm.content['complete'])) return;
    _streams[cm.id] = cm;
    m.requestStreamMessage((err) {
      if (err != null && (err.code ?? 0) != 0) _streams.remove(cm.id);
    });
  }

  static bool asBoolContent(Object? v) => v == true || v == 'true' || v == 1;

  BaseChannel _nc(ChatChannel c) {
    final latest = _latestRaw[c.key];
    return switch (c.kind) {
      ChannelKind.group => GroupChannel(c.targetId, latestMessage: latest),
      ChannelKind.system => SystemChannel(c.targetId, latestMessage: latest),
      ChannelKind.direct => DirectChannel(c.targetId, latestMessage: latest),
    };
  }

  // ── Facade ──────────────────────────────────────────────────────────────
  /// Newest page before [before] (ms; null = latest), returned oldest → newest.
  Future<List<ChatMessage>> history(ChatChannel channel, {int? before}) async {
    await _ready();
    final query = BaseChannel.createMessagesQuery(MessagesQueryParams(
      channelIdentifier: _nc(channel).channelIdentifier,
      startTime: before ?? 0,
      pageSize: historyPage,
      isAscending: false,
      policy: MessageOperationPolicy.localRemote,
    ));
    final done = Completer<List<Message>>();
    final code = await query.loadNextPage((page, error) {
      if (done.isCompleted) return;
      if (page != null && (error == null || (error.code ?? 0) == 0)) {
        done.complete(page.data);
      } else {
        done.completeError(ChatException(error?.code ?? -1, error?.message));
      }
    });
    if (code != 0 && !done.isCompleted) done.completeError(ChatException(code));
    final raw = await done.future;
    final out = <ChatMessage>[];
    for (final m in raw) {
      final cm = _fromNC(m, channel: channel);
      if (cm == null) continue;
      _remember(m, cm);
      _trackStream(m, cm);
      out.add(cm);
    }
    out.sort((a, b) => a.sentAt.compareTo(b.sentAt));
    return out;
  }

  Future<ChatMessage> sendText(ChatChannel channel, String text) =>
      _send(channel, rcText, {'text': text}, TextMessageParams(text: text));

  /// Sends a CLAIRE custom message (e.g. CC:Reply {chipId, label}).
  Future<ChatMessage> sendCustom(ChatChannel channel, String type, Map<String, String> fields) =>
      _send(channel, type, fields, CustomMessageParams(messageIdentifier: type, fields: fields));

  Future<ChatMessage> _send(ChatChannel channel, String type, Map<String, dynamic> content, MessageParams params) async {
    await _ready();
    final done = Completer<Message>();
    final code = await _nc(channel).sendMessage(
      SendMessageParams(messageParams: params),
      callback: SendMessageCallback(onMessageSent: (code, msg) {
        if (done.isCompleted) return;
        if ((code ?? 0) == 0 && msg != null) {
          done.complete(msg);
        } else {
          done.completeError(ChatException(code ?? -1));
        }
      }),
    );
    if (code != 0 && !done.isCompleted) done.completeError(ChatException(code));
    final msg = await done.future.timeout(const Duration(seconds: 20), onTimeout: () => throw ChatException(-4, 'send timeout'));
    final cm = _fromNC(msg, channel: channel);
    final sent = ChatMessage(
      id: cm?.id ?? 'tmp_${DateTime.now().microsecondsSinceEpoch}',
      channel: channel,
      senderId: myId,
      type: type,
      content: (cm == null || cm.content.isEmpty) ? normalizeContent(type, content) : cm.content,
      sentAt: cm?.sentAt ?? DateTime.now().millisecondsSinceEpoch,
      mine: true,
    );
    _remember(msg, sent);
    // The SDK does not deliver own sends back: echo to every listener.
    _messages.add(sent);
    return sent;
  }

  /// Throttled typing indicator. Nexconn supports it on direct channels.
  void sendTyping(ChatChannel channel) {
    if (!isConnected || channel.kind != ChannelKind.direct) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - (_typingSentAt[channel.key] ?? 0) < 4000) return;
    _typingSentAt[channel.key] = now;
    final ch = _nc(channel);
    if (ch is DirectChannel) ch.sendTypingStatus(rcText).catchError((_) => 0);
  }

  /// Clears the unread badge and sends read receipts where the channel supports them.
  void markRead(ChatChannel channel, List<String> messageIds) {
    if (!isConnected) return;
    final ch = _nc(channel);
    ch.clearUnreadCount((_) {}).catchError((_) => 0);
    final ids = messageIds.where((id) => id.isNotEmpty && !id.startsWith('local_') && !id.startsWith('tmp_')).toList();
    if (ids.isNotEmpty && channel.kind != ChannelKind.system) {
      final last = ids.length > 50 ? ids.sublist(ids.length - 50) : ids;
      ch.sendReadReceiptResponse(last, (_) {}).catchError((_) => 0);
    }
  }

  /// Channel list with unread counts and latest message (inbox badges).
  Future<List<ChannelSummary>> listChannels() async {
    await _ready();
    final query = BaseChannel.createChannelsQuery(
      ChannelsQueryParams(channelTypes: const [ChannelType.direct, ChannelType.group, ChannelType.system], pageSize: 50),
    );
    final done = Completer<List<BaseChannel>>();
    final code = await query.loadNextPage((page, error) {
      if (done.isCompleted) return;
      done.complete(page?.data ?? const []);
    });
    if (code != 0 && !done.isCompleted) done.complete(const []);
    final out = <ChannelSummary>[];
    for (final c in await done.future) {
      final ch = _channelOf(c.channelType, c.channelId);
      if (ch == null) continue;
      final latestRaw = c.latestMessage;
      out.add(ChannelSummary(channel: ch, unread: c.unreadCount ?? 0, latest: latestRaw == null ? null : _fromNC(latestRaw, channel: ch)));
    }
    return out;
  }

  /// Built-in Nexconn translation language (best effort; the app also translates on demand).
  void setTranslationLanguage(String lang) {
    if (!NCEngine.isInitialized) return;
    NCEngine.translate.setTranslationLanguage(lang, (_) {}).catchError((_) => 0);
  }

  Future<void> _ready() async {
    final f = _connecting;
    if (f == null) throw ChatException(-5, 'not connected');
    await f;
  }
}
