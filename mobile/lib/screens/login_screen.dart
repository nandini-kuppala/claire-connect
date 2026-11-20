// Phone + OTP sign-in with one-tap demo accounts (GET /api/demo-accounts).
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/ui.dart';
import 'language_screen.dart';

const String _demoOtp = '123456';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  bool _otpStep = false;
  String? _busy;
  String? _error;
  List<Map<String, dynamic>>? _demo;
  bool _demoOpen = false;
  final _demoKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    // Inherited services are readable once the first frame is built.
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDemo());
  }

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _loadDemo() async {
    try {
      final r = await AppServices.of(context).api.get('/api/demo-accounts');
      final list = r is List ? asMapList(r) : asMapList(asMap(r)['accounts']);
      if (mounted) setState(() => _demo = list);
    } catch (_) {
      if (mounted) setState(() => _demo = const []);
    }
  }

  String get _digits {
    final d = _phone.text.replaceAll(RegExp(r'\D'), '');
    return d.length > 10 ? d.substring(d.length - 10) : d;
  }

  bool get _phoneValid => RegExp(r'^[6-9]\d{9}$').hasMatch(_digits);

  Future<void> _requestOtp() async {
    if (!_phoneValid) return setState(() => _error = context.t('login.phone_invalid'));
    setState(() {
      _busy = 'otp';
      _error = null;
    });
    try {
      await AppServices.of(context).api.post('/api/auth/otp', {'phone': _digits});
      setState(() => _otpStep = true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _verify(String phone, String code, String busyKey) async {
    final services = AppServices.of(context);
    setState(() {
      _busy = busyKey;
      _error = null;
    });
    try {
      final r = asMap(await services.api.post('/api/auth/verify', {'phone': phone, 'otp': code}));
      final token = asStrOrNull(r['token']);
      if (token == null) throw StateError('no token');
      await services.session.apply(r, newToken: token);
      await services.i18n.load(services.session.language);
      // RootGate switches to the app shell.
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _demoLogin(Map<String, dynamic> a) async {
    final phone = asStr(a['phone']);
    setState(() => _busy = phone);
    try {
      await AppServices.of(context).api.post('/api/auth/otp', {'phone': phone});
    } catch (_) {/* verify reports any real problem */}
    if (mounted) await _verify(phone, _demoOtp, phone);
  }

  void _revealDemo() {
    setState(() => _demoOpen = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final c = _demoKey.currentContext;
      if (c != null) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
    });
  }

  @override
  Widget build(BuildContext context) {
    final i18n = context.i18n;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Row(children: [
              const BrandRow(size: 40),
              const Spacer(),
              LanguagePill(
                label: langNative(i18n.lang),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LanguageScreen(localOnly: true))),
              ),
            ]),
            const SizedBox(height: 28),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.t('login.headline'), style: AppFonts.head(size: 27, height: 1.18)),
                  const SizedBox(height: 10),
                  Text(context.t('login.sub'), style: AppFonts.body(size: 15.5, color: AppColors.ink2)),
                ]),
              ),
              const SizedBox(width: 6),
              const ClaireBot(size: 88),
            ]),
            const SizedBox(height: 22),
            _valueProps(context),
            const SizedBox(height: 18),
            Surface(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (!_otpStep) ..._phoneStep(context) else ..._otpStepView(context),
                if (_error != null) ErrorLine(_error!),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Row(children: [
                    const Expanded(child: Divider(color: AppColors.line)),
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Text(context.t('login.or'), style: AppFonts.body(size: 13, color: AppColors.meta))),
                    const Expanded(child: Divider(color: AppColors.line)),
                  ]),
                ),
                Material(
                  color: AppColors.primaryTint,
                  borderRadius: AppRadius.all(18),
                  child: InkWell(
                    borderRadius: AppRadius.all(18),
                    onTap: _revealDemo,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        const IconTile(icon: Icons.visibility_rounded, size: 44, round: true, bg: AppColors.surface),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(context.t('login.explore'), style: AppFonts.head(size: 16, weight: FontWeight.w600)),
                            Text(context.t('login.explore_sub'), style: AppFonts.body(size: 13, color: AppColors.ink2)),
                          ]),
                        ),
                        Icon(_demoOpen ? Icons.expand_more_rounded : Icons.chevron_right_rounded, color: AppColors.primary),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
            if (_demoOpen) ...[
              const SizedBox(height: 20),
              Padding(
                key: _demoKey,
                padding: const EdgeInsets.only(left: 4, bottom: 8),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.t('login.demo_title'), style: AppFonts.head(size: 17.5)),
                  Text(context.t('login.demo_hint'), style: AppFonts.body(size: 13.5, color: AppColors.meta)),
                ]),
              ),
              _demoList(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _valueProps(BuildContext context) {
    Widget item(IconData icon, Color bg, Color fg, String key) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Column(children: [
              IconTile(icon: icon, bg: bg, fg: fg),
              const SizedBox(height: 8),
              Text(context.t(key), textAlign: TextAlign.center, style: AppFonts.body(size: 13, weight: FontWeight.w600, color: AppColors.ink2, height: 1.3)),
            ]),
          ),
        );
    return Surface(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          item(Icons.search_rounded, AppColors.primaryTint, AppColors.primary, 'login.vp_find'),
          const VerticalDivider(color: AppColors.line, width: 1),
          item(Icons.handshake_rounded, AppColors.accentTint, AppColors.accentInk, 'login.vp_negotiate'),
          const VerticalDivider(color: AppColors.line, width: 1),
          item(Icons.local_shipping_rounded, AppColors.clayTint, AppColors.clay, 'login.vp_orders'),
        ]),
      ),
    );
  }

  List<Widget> _phoneStep(BuildContext context) => [
        Text(context.t('login.continue_phone'), style: AppFonts.head(size: 17, weight: FontWeight.w600)),
        const SizedBox(height: 12),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d ]')), LengthLimitingTextInputFormatter(12)],
          onChanged: (_) => setState(() => _error = null),
          onSubmitted: (_) => _requestOtp(),
          style: AppFonts.body(size: 18).copyWith(letterSpacing: 1),
          decoration: InputDecoration(
            hintText: '90000 00001',
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 16, right: 10),
              child: Text('+91', style: AppFonts.body(size: 17, weight: FontWeight.w700, color: AppColors.ink2)),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
            suffixIcon: _phoneValid ? const Icon(Icons.check_rounded, color: AppColors.success) : null,
          ),
        ),
        const SizedBox(height: 12),
        PillButton(label: context.t('login.send_otp'), icon: Icons.arrow_forward_rounded, large: true, expand: true, loading: _busy == 'otp', onPressed: !_phoneValid || _busy != null ? null : _requestOtp),
      ];

  List<Widget> _otpStepView(BuildContext context) => [
        Text(context.t('login.otp_title'), style: AppFonts.head(size: 17, weight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(context.t('login.otp_label', {'phone': '+91 $_digits'}), style: AppFonts.body(size: 14, color: AppColors.meta)),
        const SizedBox(height: 12),
        TextField(
          controller: _otp,
          autofocus: true,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          style: AppFonts.head(size: 26).copyWith(letterSpacing: 12),
          onChanged: (v) {
            setState(() {});
            if (v.length == 6) _verify(_digits, v, 'verify');
          },
          decoration: const InputDecoration(hintText: '••••••'),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: AppColors.accentTint, borderRadius: AppRadius.all(14)),
          child: Row(children: [
            const Icon(Icons.shield_rounded, size: 16, color: AppColors.accentInk),
            const SizedBox(width: 8),
            Expanded(child: Text(context.t('login.otp_hint', {'code': _demoOtp}), style: AppFonts.body(size: 13, color: AppColors.accentInk))),
          ]),
        ),
        const SizedBox(height: 12),
        PillButton(
          label: context.t('login.verify'),
          large: true,
          expand: true,
          loading: _busy == 'verify',
          onPressed: _otp.text.length != 6 || _busy != null ? null : () => _verify(_digits, _otp.text, 'verify'),
        ),
        TextButton(
          onPressed: () => setState(() {
            _otpStep = false;
            _otp.clear();
            _error = null;
          }),
          child: Text(context.t('login.change_number'), style: AppFonts.body(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
        ),
      ];

  Widget _demoList(BuildContext context) {
    final demo = _demo;
    if (demo == null) return const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator()));
    final traders = demo.where((a) => a['role'] != 'agent').toList();
    if (traders.isEmpty) return Text(context.t('login.demo_none'), style: AppFonts.body(color: AppColors.meta));
    return Surface(
      padding: EdgeInsets.zero,
      child: Column(children: [
        for (var i = 0; i < traders.length; i++) ...[
          if (i > 0) const Divider(height: 1, color: AppColors.line, indent: 72),
          _demoRow(context, traders[i]),
        ],
      ]),
    );
  }

  Widget _demoRow(BuildContext context, Map<String, dynamic> a) {
    final biz = asMap(a['business']);
    final phone = asStr(a['phone']);
    final name = asStr(biz['name'], asStr(a['name'], phone));
    final sub = <String>{
      asStr(a['label'], asStr(biz['roleLabel'])),
      asStr(biz['city']),
      langNative(asStrOrNull(a['language'])),
    }.where((s) => s.isNotEmpty).join(' · ');
    return InkWell(
      onTap: _busy != null ? null : () => _demoLogin(a),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(children: [
          InitialsAvatar(name: name, accent: asStrOrNull(biz['accent'])),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 16, weight: FontWeight.w700)),
              Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13, color: AppColors.meta)),
            ]),
          ),
          if (_busy == phone)
            const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
          else
            const Icon(Icons.chevron_right_rounded, color: AppColors.meta),
        ]),
      ),
    );
  }
}
