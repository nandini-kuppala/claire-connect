// Thin JSON client for the CLAIRE server (same REST API as the web app).
// Base URL comes from --dart-define=API_BASE (default: the deployed server).
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

const String kApiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://claire-connect.onrender.com');

enum ApiErrorKind { network, timeout, server, client, unauthorized }

class ApiException implements Exception {
  ApiException(this.status, this.kind, [this.serverMessage, this.body]);

  final int status;
  final ApiErrorKind kind;

  /// Message the server sent (already user-facing), if any.
  final String? serverMessage;
  final Object? body;

  @override
  String toString() => serverMessage ?? 'ApiException($status, $kind)';
}

class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = (baseUrl ?? kApiBase).replaceAll(RegExp(r'/+$'), ''),
        _http = client ?? http.Client();

  final String baseUrl;
  final http.Client _http;

  /// Bearer token of the signed-in user.
  String? token;

  /// Called once when the server rejects our token (401).
  void Function()? onUnauthorized;

  /// Render's free plan sleeps; the first request after a nap can take ~50 s.
  Duration timeout = const Duration(seconds: 75);

  Uri uri(String path) => Uri.parse(path.startsWith('http') ? path : '$baseUrl${path.startsWith('/') ? '' : '/'}$path');

  /// Absolute URL for server-relative paths such as `/uploads/…`.
  String absoluteUrl(String path) => path.startsWith('http') ? path : uri(path).toString();

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body ?? const <String, dynamic>{});
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body ?? const <String, dynamic>{});

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, uri(path));
    req.headers['Accept'] = 'application/json';
    final t = token;
    if (t != null && t.isNotEmpty) req.headers['Authorization'] = 'Bearer $t';
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }

    http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(timeout));
    } on TimeoutException {
      throw ApiException(0, ApiErrorKind.timeout);
    } catch (_) {
      throw ApiException(0, ApiErrorKind.network);
    }

    final text = utf8.decode(res.bodyBytes, allowMalformed: true);
    Object? data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } catch (_) {
        data = text;
      }
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;

    if (res.statusCode == 401 && t != null) onUnauthorized?.call();
    final kind = res.statusCode == 401
        ? ApiErrorKind.unauthorized
        : res.statusCode >= 500
            ? ApiErrorKind.server
            : ApiErrorKind.client;
    throw ApiException(res.statusCode, kind, _messageFrom(data), data);
  }

  static String? _messageFrom(Object? body) {
    if (body is Map) {
      for (final k in const ['error', 'message', 'msg']) {
        final m = body[k];
        if (m is String && m.isNotEmpty) return m;
      }
    }
    if (body is String && body.isNotEmpty && body.length < 200 && !body.trimLeft().startsWith('<')) return body;
    return null;
  }
}

/// App-wide client.
final ApiClient api = ApiClient();
