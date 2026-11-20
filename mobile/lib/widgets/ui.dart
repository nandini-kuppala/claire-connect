// Small shared building blocks: pill buttons, avatars, pills, surfaces, empty/error states.
import 'package:material_ui/material_ui.dart';

import '../api/api_client.dart';
import '../cards/format.dart';
import '../chat/chat_engine.dart';
import '../i18n/i18n.dart';
import '../theme/tokens.dart';

enum PillVariant { primary, secondary, tint, ghost, danger, accent }

class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.variant = PillVariant.primary,
    this.loading = false,
    this.expand = false,
    this.large = false,
    this.small = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final PillVariant variant;
  final bool loading;
  final bool expand;
  final bool large;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (variant) {
      PillVariant.primary => (AppColors.primary, AppColors.white, null),
      PillVariant.secondary => (AppColors.surface, AppColors.ink, AppColors.lineStrong),
      PillVariant.tint => (AppColors.primaryTint, AppColors.primary, null),
      PillVariant.ghost => (Colors.transparent, AppColors.primary, null),
      PillVariant.danger => (AppColors.dangerTint, AppColors.danger, null),
      PillVariant.accent => (AppColors.accent, AppColors.ink, null),
    };
    final disabled = onPressed == null || loading;
    final h = large ? 54.0 : small ? 38.0 : 46.0;
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: fg))
        else if (icon != null)
          Icon(icon, size: small ? 17 : 19, color: fg),
        if ((loading || icon != null) && label.isNotEmpty) const SizedBox(width: 8),
        Flexible(
          child: Text(label, textAlign: TextAlign.center, style: AppFonts.body(size: small ? 14 : 15.5, weight: FontWeight.w700, color: fg, height: 1.2)),
        ),
      ],
    );
    return Opacity(
      opacity: disabled && !loading ? 0.5 : 1,
      child: Material(
        color: bg,
        shape: StadiumBorder(side: border == null ? BorderSide.none : BorderSide(color: border)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: disabled ? null : onPressed,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: h),
            child: Padding(padding: EdgeInsets.symmetric(horizontal: small ? 14 : 20, vertical: 8), child: child),
          ),
        ),
      ),
    );
  }
}

Color parseHex(String? hex, [Color fallback = AppColors.primary]) {
  final h = (hex ?? '').replaceFirst('#', '');
  if (h.length != 6) return fallback;
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.accent, this.size = 44});
  final String name;
  final String? accent;
  final double size;
  @override
  Widget build(BuildContext context) {
    final c = parseHex(accent, AppColors.primary);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.withValues(alpha: 0.14), shape: BoxShape.circle),
      child: Text(initials(name), style: AppFonts.head(size: size * 0.36, weight: FontWeight.w700, color: Color.lerp(c, AppColors.ink, 0.35)!)),
    );
  }
}

/// Trust score pill: green ≥ 80, marigold ≥ 60, otherwise "new".
class TrustPill extends StatelessWidget {
  const TrustPill({super.key, required this.score, this.compact = false});
  final int score;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = score >= 80
        ? (AppColors.successTint, AppColors.success)
        : score >= 60
            ? (AppColors.accentTint, AppColors.accentInk)
            : (AppColors.sunken, AppColors.meta);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 7 : 9, vertical: compact ? 2 : 3),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.all(AppRadius.pill)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.verified_user_rounded, size: compact ? 12 : 14, color: fg),
        const SizedBox(width: 4),
        Text(context.t('common.trust_n', {'n': score}), style: AppFonts.body(size: compact ? 11.5 : 12.5, weight: FontWeight.w700, color: fg, height: 1.2)),
      ]),
    );
  }
}

enum Tone { neutral, primary, success, warning, danger, clay, accent }

(Color, Color) toneColors(Tone t) => switch (t) {
      Tone.neutral => (AppColors.sunken, AppColors.ink2),
      Tone.primary => (AppColors.primaryTint, AppColors.primary),
      Tone.success => (AppColors.successTint, AppColors.success),
      Tone.warning => (AppColors.accentTint, AppColors.warning),
      Tone.danger => (AppColors.dangerTint, AppColors.danger),
      Tone.clay => (AppColors.clayTint, AppColors.clay),
      Tone.accent => (AppColors.accentTint, AppColors.accentInk),
    };

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, this.tone = Tone.neutral});
  final String label;
  final Tone tone;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.all(AppRadius.pill)),
      child: Text(label, style: AppFonts.body(size: 12.5, weight: FontWeight.w700, color: fg, height: 1.35)),
    );
  }
}

/// Order status → (label key, tone), from the reader's side.
(String, Tone) orderStatusInfo(String status, {required bool buyer}) => switch (status) {
      'confirmed' => buyer ? ('status.pay_advance', Tone.warning) : ('status.placed', Tone.success),
      'advance_paid' => buyer ? ('status.placed', Tone.success) : ('status.ready', Tone.primary),
      'in_production' => ('status.production', Tone.primary),
      'dispatched' => ('status.dispatched', Tone.primary),
      'delivered' => buyer ? ('status.pay_balance', Tone.warning) : ('status.delivered', Tone.success),
      'balance_paid' || 'closed' => ('status.completed', Tone.success),
      'cancelled' => ('status.cancelled', Tone.neutral),
      'disputed' => ('status.problem', Tone.danger),
      _ => ('status.negotiating', Tone.neutral),
    };

/// White rounded card with a hairline border.
class Surface extends StatelessWidget {
  const Surface({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.radius = AppRadius.xl, this.color = AppColors.surface, this.borderColor = AppColors.line, this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final Color color;
  final Color borderColor;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(borderRadius: AppRadius.all(radius), side: BorderSide(color: borderColor));
    return Material(
      color: color,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, this.bg = AppColors.primaryTint, this.fg = AppColors.primary, this.size = 44, this.round = false});
  final IconData icon;
  final Color bg;
  final Color fg;
  final double size;
  final bool round;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: bg, borderRadius: round ? null : AppRadius.all(size * 0.32), shape: round ? BoxShape.circle : BoxShape.rectangle),
        child: Icon(icon, size: size * 0.5, color: fg),
      );
}

/// Garment thumbnail: a soft tile with a garment glyph tinted in the listing colour.
class GarmentThumb extends StatelessWidget {
  const GarmentThumb({super.key, this.shape, this.color, this.size = 48});
  final String? shape;
  final String? color;
  final double size;

  static IconData iconFor(String? shape) => switch (shape) {
        'fabric' || 'yarn' => Icons.layers_rounded,
        'sewing' => Icons.content_cut_rounded,
        'print' => Icons.format_paint_rounded,
        'dye' => Icons.water_drop_rounded,
        'kidsset' => Icons.child_care_rounded,
        'brief' || 'vest' || 'nightwear' => Icons.dry_cleaning_rounded,
        _ => Icons.checkroom_rounded,
      };

  @override
  Widget build(BuildContext context) {
    var c = parseHex(color, AppColors.primary);
    if (c.computeLuminance() > 0.85) c = AppColors.meta; // white garments still need to be visible
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: AppColors.sunken, borderRadius: AppRadius.all(size * 0.3)),
      child: Icon(iconFor(shape), size: size * 0.56, color: c),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(children: [
          Expanded(child: Text(text, style: AppFonts.head(size: 17.5, weight: FontWeight.w700))),
          ?trailing,
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.sub, this.action, this.onAction, this.icon = Icons.chat_bubble_outline_rounded});
  final String title;
  final String? sub;
  final String? action;
  final VoidCallback? onAction;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          IconTile(icon: icon, size: 56, round: true),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: AppFonts.head(size: 18, weight: FontWeight.w700)),
          if (sub != null) ...[
            const SizedBox(height: 6),
            Text(sub!, textAlign: TextAlign.center, style: AppFonts.body(color: AppColors.meta)),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            PillButton(label: action!, onPressed: onAction),
          ],
        ]),
      );
}

class ErrorLine extends StatelessWidget {
  const ErrorLine(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(color: AppColors.dangerTint, borderRadius: AppRadius.all(14)),
        child: Text(text, style: AppFonts.body(size: 14, color: AppColors.danger)),
      );
}

/// User-facing text for any thrown value.
String errorText(BuildContext context, Object? e) {
  if (e is ApiException) {
    if (e.serverMessage != null && e.kind != ApiErrorKind.server) return e.serverMessage!;
    return switch (e.kind) {
      ApiErrorKind.network => context.t('error.network'),
      ApiErrorKind.timeout => context.t('error.timeout'),
      ApiErrorKind.server => context.t('error.server'),
      ApiErrorKind.unauthorized => context.t('error.signed_out'),
      ApiErrorKind.client => e.serverMessage ?? context.t('error.generic'),
    };
  }
  if (e is ChatException) return context.t('error.chat', {'code': e.code});
  return context.t('error.generic');
}

void showToast(BuildContext context, String text) {
  ScaffoldMessenger.maybeOf(context)
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

/// Language pill (native name + chevron).
class LanguagePill extends StatelessWidget {
  const LanguagePill({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        shape: const StadiumBorder(side: BorderSide(color: AppColors.lineStrong)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.translate_rounded, size: 16, color: AppColors.meta),
              const SizedBox(width: 6),
              Text(label, style: AppFonts.body(size: 14.5, weight: FontWeight.w600)),
              const Icon(Icons.expand_more_rounded, size: 18, color: AppColors.meta),
            ]),
          ),
        ),
      );
}
