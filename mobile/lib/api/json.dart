// Lenient JSON readers. Server JSON is mostly typed, but Nexconn custom-message fields can
// arrive with every value as a string on iOS (NSDictionary<NSString*, NSString*>), so numbers,
// booleans, lists and maps are all coerced here.
import 'dart:convert';

Object? _maybeJson(Object? v) {
  if (v is! String) return v;
  final s = v.trim();
  if (!(s.startsWith('{') || s.startsWith('['))) return v;
  try {
    return jsonDecode(s);
  } catch (_) {
    return v;
  }
}

Map<String, dynamic> asMap(Object? v) {
  final x = _maybeJson(v);
  if (x is Map) return x.map((k, val) => MapEntry('$k', val));
  return <String, dynamic>{};
}

Map<String, dynamic>? asMapOrNull(Object? v) {
  final x = _maybeJson(v);
  return x is Map ? asMap(x) : null;
}

List<dynamic> asList(Object? v) {
  final x = _maybeJson(v);
  return x is List ? x : const [];
}

List<Map<String, dynamic>> asMapList(Object? v) => asList(v).whereType<Map>().map(asMap).toList();

List<String> asStrList(Object? v) => asList(v).where((e) => e != null).map((e) => '$e').toList();

String asStr(Object? v, [String fallback = '']) {
  if (v == null) return fallback;
  return v is String ? v : '$v';
}

String? asStrOrNull(Object? v) {
  if (v == null) return null;
  final s = v is String ? v : '$v';
  return s.isEmpty ? null : s;
}

num? asNumOrNull(Object? v) {
  if (v is num) return v;
  if (v is String) return num.tryParse(v.trim());
  return null;
}

double asDouble(Object? v, [double fallback = 0]) => asNumOrNull(v)?.toDouble() ?? fallback;

int asInt(Object? v, [int fallback = 0]) => asNumOrNull(v)?.round() ?? fallback;

int? asIntOrNull(Object? v) => asNumOrNull(v)?.round();

bool asBool(Object? v) => v == true || v == 1 || v == 'true' || v == '1';
