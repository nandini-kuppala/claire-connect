// Normalised chat types shared by the engine, controllers and widgets (no SDK types here,
// so this file is unit-testable). Mirrors web/src/chat/engine.ts.
import '../api/json.dart';

const String ccCard = 'CC:Card';
const String ccHint = 'CC:Hint';
const String ccReply = 'CC:Reply';
const String ccVoice = 'CC:Voice';
const String rcText = 'RC:TxtMsg';
const String rcStream = 'RC:StreamMsg';
const String rcVoice = 'RC:HQVCMsg';

const String claireId = 'claire';
const String updatesId = 'claire_updates';
const String deskId = 'trade_desk';
const Set<String> botIds = {claireId, updatesId, deskId};

enum ChannelKind { direct, group, system }

class ChatChannel {
  const ChatChannel(this.kind, this.targetId);
  const ChatChannel.direct(this.targetId) : kind = ChannelKind.direct;
  const ChatChannel.group(this.targetId) : kind = ChannelKind.group;
  const ChatChannel.system(this.targetId) : kind = ChannelKind.system;

  static const claire = ChatChannel.direct(claireId);
  static const updates = ChatChannel.system(updatesId);

  final ChannelKind kind;
  final String targetId;

  String get key => '${kind.name}:$targetId';

  @override
  bool operator ==(Object other) => other is ChatChannel && other.kind == kind && other.targetId == targetId;

  @override
  int get hashCode => Object.hash(kind, targetId);

  @override
  String toString() => key;
}

enum SendStatus { sending, sent, failed }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.channel,
    required this.senderId,
    required this.type,
    required this.content,
    required this.sentAt,
    required this.mine,
    this.status = SendStatus.sent,
    this.localId,
  });

  final String id;
  final ChatChannel channel;
  final String senderId;

  /// 'RC:TxtMsg' | 'RC:StreamMsg' | 'CC:Card' | 'CC:Hint' | 'CC:Reply' | 'CC:Voice' | …
  final String type;

  /// Normalised: text messages always carry `content['text']`.
  final Map<String, dynamic> content;
  final int sentAt;
  final bool mine;
  final SendStatus status;

  /// Temporary id of the optimistic copy this message replaces.
  final String? localId;

  String get text => asStr(content['text']);
  bool get isLocal => id.startsWith('local_') || id.startsWith('tmp_');

  ChatMessage copyWith({String? id, Map<String, dynamic>? content, SendStatus? status, int? sentAt, String? localId, bool clearLocalId = false}) =>
      ChatMessage(
        id: id ?? this.id,
        channel: channel,
        senderId: senderId,
        type: type,
        content: content ?? this.content,
        sentAt: sentAt ?? this.sentAt,
        mine: mine,
        status: status ?? this.status,
        localId: clearLocalId ? null : (localId ?? this.localId),
      );
}

class TypingEvent {
  const TypingEvent(this.channel, this.userId, this.at);
  final ChatChannel channel;
  final String userId;
  final int at;
}

class ChannelSummary {
  const ChannelSummary({required this.channel, required this.unread, this.latest});
  final ChatChannel channel;
  final int unread;
  final ChatMessage? latest;
}

/// Brings any message content into one shape (see the web engine's `normalizeContent`):
/// - server REST sends `content: JSON.stringify(payload)` (sometimes wrapped once more in {content});
/// - native custom-message `fields` may hold nested JSON as strings;
/// - text arrives as `text` or `content`.
Map<String, dynamic> normalizeContent(String type, Object? raw) {
  Map<String, dynamic> c;
  if (raw is String) {
    final m = asMapOrNull(raw);
    c = m ?? {'text': raw};
  } else {
    c = asMap(raw);
  }
  if (type == rcText) return {...c, 'text': asStr(c['text'] ?? c['content'])};
  if (type == rcStream) {
    return {...c, 'text': asStr(c['text'] ?? c['content']), 'complete': c['complete'] == null ? true : asBool(c['complete'])};
  }
  if (type.startsWith('CC:')) {
    if (c.length == 1 && c.containsKey('content')) {
      final inner = asMapOrNull(c['content']);
      if (inner != null) c = inner;
    }
    // One level of JSON-in-string values (chips, lines, items… on platforms that stringify fields).
    return c.map((k, v) {
      if (v is String) {
        final s = v.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
          final m = asMapOrNull(s);
          if (m != null) return MapEntry(k, m);
          final l = asList(s);
          if (l.isNotEmpty || s == '[]') return MapEntry(k, l);
        }
      }
      return MapEntry(k, v);
    });
  }
  return c;
}

/// Plain-text preview of any message (inbox rows).
String previewText(ChatMessage? m, {String voice = 'Voice note', String card = 'Card'}) {
  if (m == null) return '';
  final c = m.content;
  switch (m.type) {
    case rcText:
    case rcStream:
      return asStr(c['text']);
    case ccReply:
      return asStr(c['label']);
    case ccHint:
      return asStr(c['text']);
    case ccVoice:
      final tr = asStr(c['transcript']);
      return tr.isEmpty ? voice : '$voice: $tr';
    case rcVoice:
      return voice;
    case ccCard:
      final s = asStr(c['text']).isNotEmpty ? asStr(c['text']) : asStr(c['title']);
      return s.isEmpty ? card : s;
    default:
      return asStr(c['text'] ?? c['message']);
  }
}
