// Home: Claire greets, one big "tell me what you need" box, quick actions, example asks and
// recent searches (GET /api/requirements?limit=6).
import 'package:material_ui/material_ui.dart';

import '../api/json.dart';
import '../app_services.dart';
import '../cards/format.dart';
import '../i18n/i18n.dart';
import '../i18n/languages.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import '../widgets/cards/deal_cards.dart';
import '../widgets/ui.dart';
import 'language_screen.dart';
import 'nav.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onOpenChats});
  final VoidCallback onOpenChats;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _text = TextEditingController();
  List<Map<String, dynamic>>? _recent;

  static const _examples = [('home.ex1', 'tshirt', '#1F8C73'), ('home.ex2', 'trackpants', '#3A465C'), ('home.ex3', 'polo', '#B9502F')];
  static const _templates = [
    ('home.t_tee', 'home.t_tee_s', 'tshirt'),
    ('home.t_polo', 'home.t_polo_s', 'polo'),
    ('home.t_track', 'home.t_track_s', 'trackpants'),
    ('home.t_kids', 'home.t_kids_s', 'kidsset'),
    ('home.t_inner', 'home.t_inner_s', 'brief'),
    ('home.t_fabric', 'home.t_fabric_s', 'fabric'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRecent());
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _loadRecent() async {
    try {
      final r = asMap(await AppServices.of(context).api.get('/api/requirements?limit=6'));
      if (mounted) setState(() => _recent = asMapList(r['requirements']).take(6).toList());
    } catch (_) {
      if (mounted) setState(() => _recent = const []);
    }
  }

  void _ask(String value) {
    final v = value.trim();
    if (v.isEmpty) return;
    _text.clear();
    FocusScope.of(context).unfocus();
    openClaire(context, text: v).then((_) => _loadRecent());
  }

  void _openTemplates() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (c) => SheetBody(
        title: c.t('home.tpl_title'),
        sub: c.t('home.tpl_sub'),
        children: [
          for (final (key, sentence, shape) in _templates)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Surface(
                radius: 18,
                padding: const EdgeInsets.all(12),
                onTap: () {
                  Navigator.pop(c);
                  _ask(c.t(sentence));
                },
                child: Row(children: [
                  GarmentThumb(shape: shape, size: 44),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(c.t(key), style: AppFonts.body(weight: FontWeight.w700)),
                      Text(c.t(sentence), style: AppFonts.body(size: 13, color: AppColors.meta)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
                ]),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final services = AppServices.of(context);
    return ListenableBuilder(
      listenable: services.session,
      builder: (context, _) {
        final user = services.session.user;
        final name = user?.firstName ?? '';
        return SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadRecent,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
              children: [
                Row(children: [
                  const BrandRow(size: 36),
                  const Spacer(),
                  LanguagePill(
                    label: langNative(services.session.language),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LanguageScreen())),
                  ),
                ]),
                const SizedBox(height: 24),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(name.isEmpty ? context.t('home.hi') : context.t('home.hi_name', {'name': name}), style: AppFonts.head(size: 28, height: 1.15)),
                      const SizedBox(height: 8),
                      Text(context.t('home.purpose'), style: AppFonts.body(size: 15.5, color: AppColors.ink2)),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  const ClaireMark(size: 60),
                ]),
                const SizedBox(height: 20),
                _searchBox(context),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _quick(context, Icons.grid_view_rounded, AppColors.clayTint, AppColors.clay, 'home.qa_browse', () => openClaire(context, chipId: 'home:buy', chipLabel: context.t('home.qa_browse')))),
                  const SizedBox(width: 10),
                  Expanded(child: _quick(context, Icons.description_rounded, AppColors.accentTint, AppColors.accentInk, 'home.qa_template', _openTemplates)),
                  const SizedBox(width: 10),
                  Expanded(child: _quick(context, Icons.forum_rounded, AppColors.primaryTint, AppColors.primary, 'home.qa_chats', widget.onOpenChats)),
                ]),
                const SizedBox(height: 26),
                SectionTitle(context.t('home.try_title')),
                for (final (key, shape, color) in _examples)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Surface(
                      radius: 18,
                      padding: const EdgeInsets.all(12),
                      onTap: () => _ask(context.t(key)),
                      child: Row(children: [
                        GarmentThumb(shape: shape, color: color, size: 40),
                        const SizedBox(width: 12),
                        Expanded(child: Text(context.t(key), style: AppFonts.body(size: 15, weight: FontWeight.w600))),
                        const Icon(Icons.north_east_rounded, size: 18, color: AppColors.primary),
                      ]),
                    ),
                  ),
                const SizedBox(height: 18),
                SectionTitle(context.t('home.recent_title')),
                ..._recentList(context),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _searchBox(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(16, 6, 6, 6),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.all(AppRadius.xl), border: Border.all(color: AppColors.lineStrong)),
        child: Row(children: [
          const Icon(Icons.search_rounded, color: AppColors.meta),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _text,
              textInputAction: TextInputAction.send,
              onSubmitted: _ask,
              onChanged: (_) => setState(() {}),
              style: AppFonts.body(size: 16),
              decoration: InputDecoration(
                hintText: context.t('home.search_ph'),
                hintStyle: AppFonts.body(size: 16, color: AppColors.meta),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          Material(
            color: AppColors.primary,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _text.text.trim().isEmpty ? openClaire(context) : _ask(_text.text),
              child: SizedBox(
                width: 48,
                height: 48,
                child: Icon(_text.text.trim().isEmpty ? Icons.auto_awesome_rounded : Icons.arrow_forward_rounded, color: AppColors.white, semanticLabel: context.t('home.send')),
              ),
            ),
          ),
        ]),
      );

  Widget _quick(BuildContext context, IconData icon, Color bg, Color fg, String key, VoidCallback onTap) => Surface(
        radius: AppRadius.xl,
        padding: const EdgeInsets.fromLTRB(8, 14, 8, 12),
        onTap: onTap,
        child: Column(children: [
          IconTile(icon: icon, bg: bg, fg: fg),
          const SizedBox(height: 8),
          SizedBox(
            height: 38,
            child: Text(context.t(key), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppFonts.body(size: 13.5, weight: FontWeight.w700, height: 1.3)),
          ),
        ]),
      );

  List<Widget> _recentList(BuildContext context) {
    final recent = _recent;
    if (recent == null) return const [Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))];
    if (recent.isEmpty) return [Text(context.t('home.recent_none'), style: AppFonts.body(color: AppColors.meta))];
    return [
      for (final r in recent)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Surface(
            radius: 18,
            padding: const EdgeInsets.all(12),
            onTap: () => openResults(context, asStr(r['id'])),
            child: Row(children: [
              GarmentThumb(shape: asStrOrNull(r['shape']) ?? _shapeOf(asStr(r['categoryId'])), size: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(asStr(r['title']), style: AppFonts.body(size: 15, weight: FontWeight.w700)),
                  Text(
                    [
                      if (r['qty'] != null) context.t('unit.qty_${unitKey(asStrOrNull(r['unit']))}', {'n': fmtNum(asNumOrNull(r['qty']))}),
                      if (r['budget'] != null) context.t('results.max_price', {'price': inr(asNumOrNull(r['budget']))}),
                      if (asInt(r['matchCount']) > 0) context.t('home.matches_n', {'n': asInt(r['matchCount'])}),
                    ].join(' · '),
                    style: AppFonts.body(size: 13, color: AppColors.meta),
                  ),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.faint),
            ]),
          ),
        ),
    ];
  }

  static String _shapeOf(String categoryId) => switch (categoryId) {
        'garment.trackpants' => 'trackpants',
        'garment.polo' => 'polo',
        'garment.innerwear' => 'brief',
        'garment.kids' => 'kidsset',
        'fabric.knit' => 'fabric',
        'yarn.cotton' => 'yarn',
        'service.stitching' => 'sewing',
        _ => 'tshirt',
      };
}
