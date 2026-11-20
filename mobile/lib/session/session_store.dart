// Signed-in session: API token, user, business, trust and Nexconn chat credentials.
// Persisted in shared_preferences so the app reopens signed in.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/json.dart';

/// Chat credentials from the server (`chat` field of /api/auth/verify and /api/me).
/// The app never holds the Nexconn App Secret: only the public App Key and a per-user token.
class ChatCreds {
  const ChatCreds({required this.mode, required this.appKey, required this.area, required this.token});

  factory ChatCreds.fromJson(Map<String, dynamic> j) => ChatCreds(
        mode: asStr(j['mode'], 'local'),
        appKey: asStr(j['appKey']),
        area: asStr(j['area'], 'SG'),
        token: asStr(j['token']),
      );

  final String mode;
  final String appKey;
  final String area;
  final String token;

  bool get isNexconn => mode == 'nexconn' && appKey.isNotEmpty && token.isNotEmpty;

  Map<String, dynamic> toJson() => {'mode': mode, 'appKey': appKey, 'area': area, 'token': token};
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.phone,
    required this.language,
    required this.role,
    required this.onboarded,
    this.businessId,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: asStr(j['id']),
        name: asStr(j['name']),
        phone: asStr(j['phone']),
        language: asStr(j['language'], 'en'),
        role: asStr(j['role'], 'owner'),
        onboarded: asBool(j['onboarded']),
        businessId: asStrOrNull(j['business_id'] ?? j['businessId']),
      );

  final String id;
  final String name;
  final String phone;
  final String language;
  final String role;
  final bool onboarded;
  final String? businessId;

  bool get isAgent => role == 'agent';
  String get firstName => name.trim().split(RegExp(r'\s+')).first;

  AppUser copyWith({String? name, String? language, bool? onboarded, String? businessId}) => AppUser(
        id: id,
        name: name ?? this.name,
        phone: phone,
        language: language ?? this.language,
        role: role,
        onboarded: onboarded ?? this.onboarded,
        businessId: businessId ?? this.businessId,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'language': language,
        'role': role,
        'onboarded': onboarded ? 1 : 0,
        'business_id': businessId,
      };
}

class SessionStore extends ChangeNotifier {
  SessionStore(this._api);

  final ApiClient _api;

  static const _kToken = 'cc_token';
  static const _kUser = 'cc_user';
  static const _kBusiness = 'cc_business';
  static const _kChat = 'cc_chat';

  bool loaded = false;
  String? token;
  AppUser? user;
  Map<String, dynamic>? business;
  Map<String, dynamic>? trust;
  ChatCreds? chat;

  bool get signedIn => token != null && user != null;
  String get language => user?.language ?? 'en';

  Future<void> load() async {
    try {
      final p = await SharedPreferences.getInstance();
      token = p.getString(_kToken);
      final u = p.getString(_kUser);
      final b = p.getString(_kBusiness);
      final c = p.getString(_kChat);
      user = u == null ? null : AppUser.fromJson(asMap(jsonDecode(u)));
      business = b == null ? null : asMap(jsonDecode(b));
      chat = c == null ? null : ChatCreds.fromJson(asMap(jsonDecode(c)));
    } catch (_) {
      token = null;
      user = null;
    }
    _api.token = token;
    loaded = true;
    notifyListeners();
  }

  /// Applies a /api/auth/verify or /api/me response.
  Future<void> apply(Map<String, dynamic> r, {String? newToken}) async {
    if (newToken != null) token = newToken;
    if (r['user'] is Map) user = AppUser.fromJson(asMap(r['user']));
    if (r.containsKey('business')) business = asMapOrNull(r['business']);
    trust = asMapOrNull(r['trust']) ?? asMapOrNull(business?['trust']) ?? trust;
    if (r['chat'] is Map) chat = ChatCreds.fromJson(asMap(r['chat']));
    _api.token = token;
    await _persist();
    notifyListeners();
  }

  Future<void> refreshMe() async {
    final r = asMap(await _api.get('/api/me'));
    await apply(r);
  }

  Future<void> updateUser({String? language, String? name, bool? onboarded, String? businessId}) async {
    final u = user;
    if (u == null) return;
    user = u.copyWith(language: language, name: name, onboarded: onboarded, businessId: businessId);
    await _persist();
    notifyListeners();
  }

  Future<void> logout() async {
    token = null;
    user = null;
    business = null;
    trust = null;
    chat = null;
    _api.token = null;
    try {
      final p = await SharedPreferences.getInstance();
      await Future.wait([p.remove(_kToken), p.remove(_kUser), p.remove(_kBusiness), p.remove(_kChat)]);
    } catch (_) {/* storage unavailable: memory is already cleared */}
    notifyListeners();
  }

  Future<void> _persist() async {
    try {
      final p = await SharedPreferences.getInstance();
      final t = token;
      if (t != null) await p.setString(_kToken, t);
      final u = user;
      if (u != null) await p.setString(_kUser, jsonEncode(u.toJson()));
      final b = business;
      if (b != null) {
        await p.setString(_kBusiness, jsonEncode(b));
      } else {
        await p.remove(_kBusiness);
      }
      final c = chat;
      if (c != null) await p.setString(_kChat, jsonEncode(c.toJson()));
    } catch (_) {/* best effort */}
  }
}
