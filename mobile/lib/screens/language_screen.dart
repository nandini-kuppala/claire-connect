// Language picker: ten languages by native name → PATCH /api/me {language}.
import 'package:material_ui/material_ui.dart';

import '../app_services.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/ui.dart';

class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key, this.onboarding = false, this.localOnly = false, this.onDone});

  /// First run for a new trader: no back button, continues with [onDone].
  final bool onboarding;

  /// Signed out: only switches the screen language.
  final bool localOnly;
  final VoidCallback? onDone;

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  String? _busy;
  String? _error;

  Future<void> _pick(String code) async {
    final services = AppServices.of(context);
    final nav = Navigator.of(context);
    setState(() {
      _busy = code;
      _error = null;
    });
    try {
      if (widget.localOnly) {
        await services.i18n.load(code);
      } else {
        await services.setLanguage(code);
      }
      if (widget.onboarding) {
        widget.onDone?.call();
      } else if (nav.canPop()) {
        nav.pop();
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(context, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = widget.localOnly ? context.i18n.lang : AppServices.of(context).session.language;
    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: !widget.onboarding, title: Text(context.t('language.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Text(context.t('language.sub'), style: AppFonts.body(color: AppColors.meta)),
          const SizedBox(height: 14),
          if (_error != null) ErrorLine(_error!),
          for (final l in kLanguages)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Surface(
                radius: 18,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                borderColor: l.code == current ? AppColors.primary : AppColors.line,
                color: l.code == current ? AppColors.primaryTint : AppColors.surface,
                onTap: _busy != null ? null : () => _pick(l.code),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.native, style: AppFonts.head(size: 18, weight: FontWeight.w600)),
                      Text(l.english, style: AppFonts.body(size: 13, color: AppColors.meta)),
                    ]),
                  ),
                  if (_busy == l.code)
                    const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  else if (l.code == current)
                    const Icon(Icons.check_circle_rounded, color: AppColors.primary),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}
