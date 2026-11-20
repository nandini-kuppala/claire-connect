// New trader profile: name, business, city and what they trade → POST /api/onboarding/complete.
// (The web app also offers a spoken onboarding; the phone app uses this short form.)
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/ui.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _categories = ['garment.tshirt', 'garment.trackpants', 'garment.innerwear', 'garment.kids', 'fabric.knit', 'service.stitching'];

  final _name = TextEditingController();
  final _business = TextEditingController();
  final _city = TextEditingController();
  String _role = 'buy';
  final Set<String> _cats = {};
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _business.dispose();
    _city.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final services = AppServices.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final cats = _cats.toList();
    try {
      final r = asMap(await services.api.post('/api/onboarding/complete', {
        'language': services.session.language,
        'draft': {
          'owner_name': _name.text.trim(),
          'business_name': _business.text.trim(),
          'city': _city.text.trim(),
          'sells': _role == 'buy' ? <String>[] : cats,
          'buys': _role == 'sell' ? <String>[] : cats,
        },
      }));
      await services.session.apply({'business': r['business'], if (r['user'] is Map) 'user': r['user']});
      await services.session.updateUser(onboarded: true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final valid = _name.text.trim().isNotEmpty && _business.text.trim().isNotEmpty;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            Row(children: [
              const ClaireMark(size: 52),
              const SizedBox(width: 12),
              Expanded(child: Text(context.t('onboarding.title'), style: AppFonts.head(size: 22))),
            ]),
            const SizedBox(height: 8),
            Text(context.t('onboarding.sub'), style: AppFonts.body(color: AppColors.ink2)),
            const SizedBox(height: 20),
            TextField(controller: _name, onChanged: (_) => setState(() {}), textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: context.t('onboarding.name'))),
            const SizedBox(height: 12),
            TextField(controller: _business, onChanged: (_) => setState(() {}), textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: context.t('onboarding.business'))),
            const SizedBox(height: 12),
            TextField(controller: _city, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: context.t('onboarding.city'))),
            const SizedBox(height: 20),
            Text(context.t('onboarding.role'), style: AppFonts.head(size: 16, weight: FontWeight.w600)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final r in const ['buy', 'sell', 'both'])
                ChoiceChip(
                  label: Text(context.t('onboarding.role_$r')),
                  selected: _role == r,
                  onSelected: (_) => setState(() => _role = r),
                  selectedColor: AppColors.primaryTint,
                  shape: const StadiumBorder(side: BorderSide(color: AppColors.line)),
                ),
            ]),
            const SizedBox(height: 20),
            Text(context.t('onboarding.what'), style: AppFonts.head(size: 16, weight: FontWeight.w600)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in _categories)
                FilterChip(
                  label: Text(context.t('category.$c')),
                  selected: _cats.contains(c),
                  onSelected: (on) => setState(() => on ? _cats.add(c) : _cats.remove(c)),
                  selectedColor: AppColors.primaryTint,
                  checkmarkColor: AppColors.primary,
                  shape: const StadiumBorder(side: BorderSide(color: AppColors.line)),
                ),
            ]),
            if (_error != null) ErrorLine(_error!),
            const SizedBox(height: 24),
            PillButton(label: context.t('onboarding.done'), large: true, expand: true, loading: _busy, onPressed: !valid || _busy ? null : _submit),
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () => AppServices.of(context).logout(),
                child: Text(context.t('profile.logout'), style: AppFonts.body(size: 14, color: AppColors.meta)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
