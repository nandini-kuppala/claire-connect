// Profile (GET /api/me): business, trust score with its parts, badges, language, log out.
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/ui.dart';
import 'language_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Object? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      await AppServices.of(context).session.refreshMe();
      if (mounted) setState(() => _error = null);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _logout() async {
    final services = AppServices.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(c.t('profile.logout_title'), style: AppFonts.head(size: 18)),
        content: Text(c.t('profile.logout_sub'), style: AppFonts.body()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(c.t('common.cancel'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(c.t('profile.logout'))),
        ],
      ),
    );
    if (ok == true) await services.logout();
  }

  @override
  Widget build(BuildContext context) {
    final session = AppServices.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final user = session.user;
        final biz = session.business ?? const <String, dynamic>{};
        final trust = session.trust ?? asMap(biz['trust']);
        final score = asInt(trust['score']);
        final comps = asMap(trust['components']);
        final badges = asStrList(trust['badges']);
        return SafeArea(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                Text(context.t('profile.title'), style: AppFonts.head(size: 27)),
                const SizedBox(height: 16),
                Surface(
                  child: Row(children: [
                    InitialsAvatar(name: asStr(biz['name'], user?.name ?? ''), accent: asStrOrNull(biz['accent']), size: 56),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(asStr(biz['name'], user?.name ?? ''), style: AppFonts.head(size: 18, weight: FontWeight.w600)),
                        Text(
                          [user?.name ?? '', asStr(biz['role']), asStr(biz['city'])].where((s) => s.isNotEmpty).join(' · '),
                          style: AppFonts.body(size: 13.5, color: AppColors.meta),
                        ),
                        if (user != null) Text('+91 ${user.phone}', style: AppFonts.body(size: 13, color: AppColors.meta)),
                      ]),
                    ),
                  ]),
                ),
                if (_error != null) ErrorLine(errorText(context, _error)),
                if (trust.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Surface(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        _ScoreRing(score: score),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(context.t('profile.trust'), style: AppFonts.head(size: 17, weight: FontWeight.w600)),
                            Text(context.t('profile.trust_sub'), style: AppFonts.body(size: 13, color: AppColors.meta)),
                            if (trust['ratingAvg'] != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Row(children: [
                                  const Icon(Icons.star_rounded, size: 16, color: AppColors.accent),
                                  const SizedBox(width: 4),
                                  Text(
                                    context.t('profile.rating', {'rating': asDouble(trust['ratingAvg']).toStringAsFixed(1), 'n': asInt(trust['ratingCount'])}),
                                    style: AppFonts.body(size: 13.5, color: AppColors.ink2),
                                  ),
                                ]),
                              ),
                          ]),
                        ),
                      ]),
                      const SizedBox(height: 16),
                      for (final (k, max) in const [('verification', 20), ('ratings', 40), ('reliability', 25), ('responsiveness', 10), ('disputes', 5)])
                        _Bar(label: context.t('profile.c_$k'), value: asDouble(comps[k]), max: max.toDouble()),
                      if (badges.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Wrap(spacing: 6, runSpacing: 6, children: [for (final b in badges) StatusPill(label: context.badge(b), tone: Tone.success)]),
                      ],
                    ]),
                  ),
                ],
                const SizedBox(height: 14),
                Surface(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    ListTile(
                      leading: const IconTile(icon: Icons.translate_rounded, size: 40, round: true),
                      title: Text(context.t('profile.language'), style: AppFonts.body(weight: FontWeight.w600)),
                      subtitle: Text(langNative(session.language), style: AppFonts.body(size: 13, color: AppColors.meta)),
                      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LanguageScreen())),
                    ),
                    const Divider(height: 1, color: AppColors.line, indent: 72),
                    ListTile(
                      leading: const IconTile(icon: Icons.logout_rounded, size: 40, round: true, bg: AppColors.dangerTint, fg: AppColors.danger),
                      title: Text(context.t('profile.logout'), style: AppFonts.body(weight: FontWeight.w600, color: AppColors.danger)),
                      onTap: _logout,
                    ),
                  ]),
                ),
                const SizedBox(height: 18),
                Center(child: Text(context.t('profile.powered'), style: AppFonts.body(size: 12, color: AppColors.faint))),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ScoreRing extends StatelessWidget {
  const _ScoreRing({required this.score});
  final int score;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 76,
        height: 76,
        child: Stack(alignment: Alignment.center, children: [
          SizedBox.expand(
            child: CircularProgressIndicator(
              value: (score / 100).clamp(0, 1).toDouble(),
              strokeWidth: 8,
              strokeCap: StrokeCap.round,
              backgroundColor: AppColors.sunken,
              color: score >= 80 ? AppColors.success : score >= 60 ? AppColors.accent : AppColors.meta,
            ),
          ),
          Text('$score', style: AppFonts.money(size: 24)),
        ]),
      );
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.max});
  final String label;
  final double value;
  final double max;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(label, style: AppFonts.body(size: 13.5, color: AppColors.ink2))),
            Text('${value.round()}/${max.round()}', style: AppFonts.body(size: 13, weight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: AppRadius.all(4),
            child: LinearProgressIndicator(value: max == 0 ? 0 : (value / max).clamp(0, 1), minHeight: 7, backgroundColor: AppColors.sunken, color: AppColors.primary),
          ),
        ]),
      );
}
