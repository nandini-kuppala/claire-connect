// Design tokens (docs/DESIGN_SYSTEM.md + web/src/index.css): white base, loom-teal primary,
// logo teal brand, navy ink, marigold accent, madder clay. Flat colour only, no default blue,
// no gradients, nothing sharp.
import 'package:flutter/widgets.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppColors {
  static const primary = Color(0xFF1F8C73);
  static const primaryHover = Color(0xFF19775F);
  static const primaryPress = Color(0xFF14614E);
  static const primaryTint = Color(0xFFE6F6F1);
  static const primarySoft = Color(0xFFBFE7DA);
  static const brand = Color(0xFF3DB394);
  static const brandDeep = Color(0xFF2E9C80);
  static const navy = Color(0xFF13203B);
  static const accent = Color(0xFFE9A23B);
  static const accentTint = Color(0xFFFDF4E3);
  static const accentInk = Color(0xFF8A5A12);
  static const clay = Color(0xFFB9502F);
  static const clayTint = Color(0xFFF7E4DB);
  static const plum = Color(0xFF6D4466);
  static const plumTint = Color(0xFFF1E8EF);
  static const bubbleOwn = Color(0xFFDFF3EC);
  static const bubbleOther = Color(0xFFF3F4F6);
  static const surface = Color(0xFFFFFFFF);
  static const sunken = Color(0xFFF3F4F6);
  static const page = Color(0xFFFFFFFF);
  static const ink = Color(0xFF13203B);
  static const ink2 = Color(0xFF3A465C);
  static const meta = Color(0xFF667085);
  static const faint = Color(0xFFA2A8AE);
  static const line = Color(0xFFE7E9EC);
  static const lineStrong = Color(0xFFD3D7DC);
  static const chipBorder = Color(0xFFB5E0D2);
  static const success = Color(0xFF2F7A47);
  static const successTint = Color(0xFFE2F0E5);
  static const danger = Color(0xFFB43A2E);
  static const dangerTint = Color(0xFFF8E2DE);
  static const warning = Color(0xFFA8650F);
  static const white = Color(0xFFFFFFFF);
}

abstract final class AppRadius {
  static const xs = 8.0;
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 18.0;
  static const xl = 22.0;
  static const xxl = 26.0;
  static const pill = 999.0;

  static BorderRadius all(double r) => BorderRadius.circular(r);
}

/// Bricolage Grotesque for headings, Figtree for body (fetched by google_fonts); Indic scripts fall
/// back to the platform's Noto / system fonts. Tests switch Google Fonts off.
abstract final class AppFonts {
  static bool useGoogleFonts = true;

  static const _fallback = ['Noto Sans Tamil', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam', 'Noto Sans Gujarati', 'Noto Sans Oriya'];

  static TextStyle head({double size = 17, FontWeight weight = FontWeight.w700, Color color = AppColors.ink, double? height}) {
    final base = TextStyle(fontSize: size, fontWeight: weight, color: color, height: height ?? 1.25, fontFamilyFallback: _fallback);
    return useGoogleFonts ? GoogleFonts.bricolageGrotesque(textStyle: base) : base;
  }

  static TextStyle body({double size = 15, FontWeight weight = FontWeight.w400, Color color = AppColors.ink, double? height}) {
    final base = TextStyle(fontSize: size, fontWeight: weight, color: color, height: height ?? 1.45, fontFamilyFallback: _fallback);
    return useGoogleFonts ? GoogleFonts.figtree(textStyle: base) : base;
  }

  /// Prices and totals: heading face, tabular figures.
  static TextStyle money({double size = 16, Color color = AppColors.ink}) =>
      head(size: size, weight: FontWeight.w700, color: color).copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
}
