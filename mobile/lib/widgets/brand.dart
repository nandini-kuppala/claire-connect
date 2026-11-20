// CLAIRE brand marks, ported from web/src/components/Avatar.tsx (BotHead / LogoSymbol / ClaireMark):
// a teal price-tag blob with a white robot head, navy visor and teal smiling eyes.
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../theme/tokens.dart';

const String _botHead = '''
<path d="M60 30v-9" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
<circle cx="60" cy="18" r="6" fill="#FFFFFF"/>
<rect x="20" y="52" width="10" height="26" rx="5" fill="#FFFFFF"/>
<rect x="90" y="52" width="10" height="26" rx="5" fill="#FFFFFF"/>
<rect x="26" y="30" width="68" height="64" rx="26" fill="#FFFFFF"/>
<rect x="33" y="42" width="54" height="38" rx="17" fill="#13203B"/>
<path d="M43 61c3-5 8-5 11 0M66 61c3-5 8-5 11 0" stroke="#55D6B4" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="M53 69c4 4 10 4 14 0" stroke="#55D6B4" stroke-width="4" stroke-linecap="round" fill="none"/>
''';

const String logoSymbolSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 130" fill="none">
<path d="M30 16c22-12 64-14 88 2 14 9 17 40 12 66-5 25-30 40-62 42-26 2-50-8-58-30C2 72 4 30 30 16Z" fill="#3DB394"/>
<path d="M8 98c6 14 22 24 42 27-16 1-32-6-40-16-2-3-3-7-2-11Z" fill="#2E9C80"/>
<circle cx="30" cy="34" r="9" fill="#FFFFFF"/>
<path d="M113 4l-3 9M126 10l-7 7M132 24l-9 2" stroke="#3DB394" stroke-width="5" stroke-linecap="round"/>
<g transform="translate(14 22) scale(0.86)">$_botHead</g>
</svg>
''';

const String botHeadSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
<g transform="translate(0 6)">$_botHead</g>
</svg>
''';

const String claireBotSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 130" fill="none">
<ellipse cx="64" cy="72" rx="56" ry="52" fill="#3DB394"/>
<path d="M112 8l-3 9M125 14l-7 7M131 28l-9 2" stroke="#3DB394" stroke-width="5" stroke-linecap="round"/>
<path d="M98 88c9-4 13-12 12-21" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
<circle cx="110" cy="62" r="7.5" fill="#FFFFFF"/>
<g transform="translate(4 16)">$_botHead</g>
</svg>
''';

/// The full logo symbol (tag blob + robot).
class LogoSymbol extends StatelessWidget {
  const LogoSymbol({super.key, this.size = 40});
  final double size;
  @override
  Widget build(BuildContext context) =>
      SvgPicture.string(logoSymbolSvg, height: size, width: size * 140 / 130, excludeFromSemantics: true);
}

/// Claire's avatar: the robot head on a teal disc.
class ClaireMark extends StatelessWidget {
  const ClaireMark({super.key, this.size = 44});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
        child: SvgPicture.string(botHeadSvg, width: size * 0.8, height: size * 0.8, excludeFromSemantics: true),
      );
}

/// Waving Claire for hero areas.
class ClaireBot extends StatelessWidget {
  const ClaireBot({super.key, this.size = 92});
  final double size;
  @override
  Widget build(BuildContext context) =>
      SvgPicture.string(claireBotSvg, height: size, width: size * 140 / 130, excludeFromSemantics: true);
}

/// Logo + "CLAIRE Connect" wordmark.
class BrandRow extends StatelessWidget {
  const BrandRow({super.key, this.size = 38});
  final double size;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          LogoSymbol(size: size),
          const SizedBox(width: 10),
          Text.rich(
            TextSpan(children: [
              TextSpan(text: 'CLAIRE ', style: AppFonts.head(size: 19, weight: FontWeight.w800)),
              TextSpan(text: 'Connect', style: AppFonts.head(size: 19, weight: FontWeight.w800, color: AppColors.brand)),
            ]),
          ),
        ],
      );
}
