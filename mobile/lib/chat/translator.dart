// Translates other-language chat messages for the reader through the server
// (POST /api/translate: glossary-aware, keeps numbers, native script), with an in-memory cache.
import '../api/api_client.dart';
import '../api/json.dart';

class TranslateRequest {
  const TranslateRequest({required this.id, required this.text, this.from});
  final String id;
  final String text;
  final String? from;
}

class Translator {
  Translator(this._api);
  final ApiClient _api;
  final Map<String, String> _cache = {};

  /// Returns id → translated text for the requests that succeeded.
  Future<Map<String, String>> translate(List<TranslateRequest> items, String to) async {
    final out = <String, String>{};
    final pending = <String?, List<TranslateRequest>>{};
    for (final r in items) {
      final hit = _cache['$to|${r.text}'];
      if (hit != null) {
        out[r.id] = hit;
      } else {
        (pending[r.from] ??= []).add(r);
      }
    }
    for (final entry in pending.entries) {
      final group = entry.value;
      try {
        final res = asMap(await _api.post('/api/translate', {
          'texts': group.map((r) => r.text).toList(),
          'to': to,
          if (entry.key != null && entry.key != 'auto') 'from': entry.key,
        }));
        final list = asList(res['translations']);
        for (var i = 0; i < group.length && i < list.length; i++) {
          final tr = asStrOrNull(list[i]);
          if (tr == null) continue;
          _cache['$to|${group[i].text}'] = tr;
          out[group[i].id] = tr;
        }
      } catch (_) {
        // Leave these untranslated; the bubble offers a retry.
      }
    }
    return out;
  }
}

/// True when a translation adds something (not just case / spacing differences).
bool isDifferent(String translated, String original) {
  String norm(String s) => s.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();
  return norm(translated) != norm(original);
}
