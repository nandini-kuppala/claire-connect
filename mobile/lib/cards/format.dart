// Number, money and label helpers shared by cards and screens.

/// Indian digit grouping: 1234567 → 12,34,567.
String groupIndian(int n) {
  final neg = n < 0;
  var s = n.abs().toString();
  if (s.length > 3) {
    final last3 = s.substring(s.length - 3);
    var rest = s.substring(0, s.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    s = '${parts.join(',')},$last3';
  }
  return neg ? '-$s' : s;
}

/// ₹ with Indian grouping. Small amounts keep up to 2 decimals (₹167.8), large ones are whole.
String inr(num? n) {
  if (n == null || !n.isFinite) return '—';
  if (n.abs() < 1000 && n != n.roundToDouble()) {
    var s = n.toStringAsFixed(2);
    s = s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
    return '₹$s';
  }
  return '₹${groupIndian(n.round())}';
}

String fmtNum(num? n) => n == null || !n.isFinite ? '—' : (n == n.roundToDouble() ? groupIndian(n.round()) : n.toString());

/// Strip leading emoji from server-provided labels (the UI uses its own icons).
String cleanLabel(String s) {
  // ignore: valid_regexps
  final out = s.replaceFirst(RegExp(r'^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\s]+', unicode: true), '').trim();
  return out.isEmpty ? s : out;
}

String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '·';
  String first(String w) => String.fromCharCodes(w.runes.take(1));
  return (first(parts[0]) + (parts.length > 1 ? first(parts[1]) : '')).toUpperCase();
}

/// Short time for chat rows: 14:05 today, otherwise 20/11.
String shortTime(int ms, {String yesterday = 'Yesterday'}) {
  if (ms <= 0) return '';
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  final now = DateTime.now();
  String two(int v) => v.toString().padLeft(2, '0');
  if (d.year == now.year && d.month == now.month && d.day == now.day) return '${two(d.hour)}:${two(d.minute)}';
  final y = now.subtract(const Duration(days: 1));
  if (d.year == y.year && d.month == y.month && d.day == y.day) return yesterday;
  return '${d.day}/${d.month}';
}

String clockTime(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

/// Unit key for i18n: piece | kg | dozen.
String unitKey(String? unit) => unit == 'kg' ? 'kg' : unit == 'dozen' ? 'dozen' : 'piece';

/// MatchCard carries no unit; infer it from the garment art shape.
String unitFromShape(String? shape) {
  if (shape == 'fabric' || shape == 'yarn' || shape == 'dye') return 'kg';
  if (shape == 'brief' || shape == 'vest') return 'dozen';
  return 'piece';
}

/// Server trust badges (server/src/trust.ts) are English labels; map the known ones to i18n keys.
/// Returns the key and its {n} value, or null for a label we don't know (shown as sent).
({String key, Object? n})? badgeKey(String label) {
  const fixed = {
    'GST verified': 'badge.gst_verified',
    'Manufacturer': 'badge.manufacturer',
    'Unit visited': 'badge.unit_visited',
    'Replies in < 10 min': 'badge.fast_reply',
    'Pays on time': 'badge.pays_on_time',
    'Top quality': 'badge.top_quality',
  };
  final k = fixed[label.trim()];
  if (k != null) return (key: k, n: null);
  final m = RegExp(r'^(\d+) repeat buyers?$').firstMatch(label.trim());
  if (m != null) return (key: 'badge.repeat_buyers', n: int.parse(m.group(1)!));
  return null;
}
