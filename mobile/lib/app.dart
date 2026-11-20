import 'package:material_ui/material_ui.dart';

import 'app_services.dart';
import 'i18n/i18n.dart';
import 'screens/language_screen.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/shell_screen.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';
import 'widgets/brand.dart';
import 'widgets/ui.dart';

class ClaireApp extends StatelessWidget {
  const ClaireApp({super.key, required this.services});
  final AppServices services;

  @override
  Widget build(BuildContext context) => AppScope(
        services: services,
        child: I18nScope(
          i18n: services.i18n,
          child: MaterialApp(
            title: 'CLAIRE Connect',
            debugShowCheckedModeBanner: false,
            theme: buildAppTheme(),
            home: const RootGate(),
          ),
        ),
      );
}

/// Signed out → Login; new trader → language → profile; trader → app shell.
class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final services = AppServices.of(context);
    return ListenableBuilder(
      listenable: services.session,
      builder: (context, _) {
        final s = services.session;
        if (!s.loaded) return const _Splash();
        final user = s.user;
        if (!s.signedIn || user == null) return const LoginScreen();
        if (user.isAgent) return const _AgentNotice();
        if (!user.onboarded) return const _NewTraderFlow();
        return ShellScreen(key: ValueKey(user.id));
      },
    );
  }
}

class _NewTraderFlow extends StatefulWidget {
  const _NewTraderFlow();
  @override
  State<_NewTraderFlow> createState() => _NewTraderFlowState();
}

class _NewTraderFlowState extends State<_NewTraderFlow> {
  bool _languageDone = false;
  @override
  Widget build(BuildContext context) =>
      _languageDone ? const OnboardingScreen() : LanguageScreen(onboarding: true, onDone: () => setState(() => _languageDone = true));
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: LogoSymbol(size: 72)));
}

/// Trade Desk agents use the desktop console on the web.
class _AgentNotice extends StatelessWidget {
  const _AgentNotice();
  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const LogoSymbol(size: 64),
                const SizedBox(height: 18),
                Text(context.t('agent.title'), textAlign: TextAlign.center, style: AppFonts.head(size: 22)),
                const SizedBox(height: 8),
                Text(context.t('agent.sub'), textAlign: TextAlign.center, style: AppFonts.body(color: AppColors.meta)),
                const SizedBox(height: 20),
                PillButton(label: context.t('profile.logout'), variant: PillVariant.secondary, onPressed: () => AppServices.of(context).logout()),
              ]),
            ),
          ),
        ),
      );
}
