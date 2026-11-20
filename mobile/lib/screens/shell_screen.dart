// Signed-in app shell: Home · Chats · Orders · Profile. Connects the Nexconn engine on entry.
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../app_services.dart';
import '../i18n/i18n.dart';
import 'home_screen.dart';
import 'inbox_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});
  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _tab = 0;
  final _visits = <int>{0};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    final services = AppServices.of(context);
    try {
      // Fresh chat token, language and trust from the server.
      await services.session.refreshMe();
      if (services.i18n.lang != services.session.language) await services.i18n.load(services.session.language);
    } catch (_) {/* offline: cached session still works */}
    unawaited(services.ensureChat().catchError((_) {}));
  }

  void _select(int i) => setState(() {
        _tab = i;
        _visits.add(i);
      });

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      HomeScreen(onOpenChats: () => _select(1)),
      _visits.contains(1) ? const InboxScreen() : const SizedBox.shrink(),
      _visits.contains(2) ? const OrdersScreen() : const SizedBox.shrink(),
      _visits.contains(3) ? const ProfileScreen() : const SizedBox.shrink(),
    ];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFE7E9EC)))),
        child: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: _select,
          destinations: [
            NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home_rounded), label: context.t('nav.home')),
            NavigationDestination(icon: const Icon(Icons.chat_bubble_outline_rounded), selectedIcon: const Icon(Icons.chat_bubble_rounded), label: context.t('nav.chats')),
            NavigationDestination(icon: const Icon(Icons.inventory_2_outlined), selectedIcon: const Icon(Icons.inventory_2_rounded), label: context.t('nav.orders')),
            NavigationDestination(icon: const Icon(Icons.person_outline_rounded), selectedIcon: const Icon(Icons.person_rounded), label: context.t('nav.profile')),
          ],
        ),
      ),
    );
  }
}
