import { useId, type CSSProperties, type ReactNode } from 'react';
import clsx from 'clsx';

// Flat, lightly shaded SVG illustrations used for listings without photos.
// Every shape is drawn in a 100×100 box; the tinted background fills whatever box the parent gives.

export type GarmentShape =
  | 'tshirt' | 'polo' | 'trackpants' | 'shorts' | 'brief' | 'vest' | 'kidsset' | 'nightwear' | 'leggings' | 'hoodie'
  | 'fabric' | 'yarn' | 'sewing' | 'print' | 'dye';

export type GarmentPattern = 'stripe' | 'print' | 'dots' | 'pocket' | 'piping' | 'tipped';

export interface GarmentArtProps {
  shape: GarmentShape | string;
  color?: string;
  pattern?: GarmentPattern | string | null;
  /** Square size in px. Omit to fill the parent box (any aspect ratio). */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; decorative when omitted. */
  title?: string;
}

// ── colour helpers ─────────────────────────────────────────────────────────
type RGB = [number, number, number];

function parseHex(c: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function mix(a: string, b: string, t: number): string {
  const x = parseHex(a) ?? [31, 42, 68];
  const y = parseHex(b) ?? [255, 255, 255];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function luminance(c: string): number {
  const rgb = parseHex(c) ?? [31, 42, 68];
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

interface Pal {
  id: string;
  base: string;
  dark: string;
  deep: string;
  light: string;
  outline: string;
  stitch: string;
  /** Contrast colour for stripes, tipping, prints. */
  accent: string;
  /** Light trim colour (drawstrings, buttons). */
  trim: string;
  isLight: boolean;
}

function palette(id: string, color: string): Pal {
  const base = parseHex(color) ? color : '#1F2A44';
  const lum = luminance(base);
  const isLight = lum > 0.62;
  return {
    id,
    base,
    dark: mix(base, '#000000', isLight ? 0.12 : 0.24),
    deep: mix(base, '#000000', isLight ? 0.3 : 0.48),
    light: mix(base, '#FFFFFF', isLight ? 0.5 : 0.2),
    outline: isLight ? mix(base, '#1F2A44', 0.3) : mix(base, '#000000', 0.38),
    stitch: isLight ? mix(base, '#1F2A44', 0.38) : mix(base, '#FFFFFF', 0.42),
    accent: lum > 0.4 ? '#1F2A44' : '#F8FAFC',
    trim: isLight ? '#94A3B8' : '#F1F5F9',
    isLight,
  };
}

const TOPS = new Set(['tshirt', 'polo', 'hoodie', 'vest', 'nightwear']);

// ── primitives ─────────────────────────────────────────────────────────────
function Defs({ p, fill }: { p: Pal; fill: string | null }) {
  return (
    <>
      <linearGradient id={`${p.id}-sh`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.16" />
        <stop offset="0.28" stopColor="#000" stopOpacity="0" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.07" />
        <stop offset="0.78" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id={`${p.id}-v`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.14" />
      </linearGradient>
      <linearGradient id={`${p.id}-drape`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.22" />
        <stop offset="0.25" stopColor="#000" stopOpacity="0.04" />
        <stop offset="1" stopColor="#000" stopOpacity="0.1" />
      </linearGradient>
      {fill === 'stripe' && (
        <pattern id={`${p.id}-pat`} width="100" height="9" patternUnits="userSpaceOnUse">
          <rect y="0" width="100" height="3.2" fill={p.accent} opacity="0.85" />
        </pattern>
      )}
      {fill === 'dots' && (
        <pattern id={`${p.id}-pat`} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.15" fill={p.accent} opacity="0.55" />
          <circle cx="6" cy="6" r="1.15" fill={p.accent} opacity="0.55" />
        </pattern>
      )}
      {fill === 'rib' && (
        <pattern id={`${p.id}-pat`} width="2.2" height="10" patternUnits="userSpaceOnUse">
          <rect width="0.7" height="10" fill={p.isLight ? '#1F2A44' : '#000'} opacity={p.isLight ? 0.05 : 0.12} />
        </pattern>
      )}
      {fill === 'knit' && (
        <pattern id={`${p.id}-pat`} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0 L1.5 1.5 L3 0" fill="none" stroke={p.isLight ? '#1F2A44' : '#000'} strokeWidth="0.35" opacity={p.isLight ? 0.08 : 0.16} />
        </pattern>
      )}
      {fill === 'wind' && (
        <pattern id={`${p.id}-pat`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <rect width="5" height="0.45" fill={p.isLight ? '#1F2A44' : '#000'} opacity={p.isLight ? 0.08 : 0.2} />
        </pattern>
      )}
    </>
  );
}

/** A filled garment panel: base colour, optional pattern, soft shading, outline. */
function Panel({ d, p, fill, shade = 'h', outline = true }: { d: string; p: Pal; fill?: boolean; shade?: 'h' | 'v' | 'drape' | null; outline?: boolean }) {
  return (
    <g>
      <path d={d} fill={p.base} />
      {fill && <path d={d} fill={`url(#${p.id}-pat)`} />}
      {shade && <path d={d} fill={`url(#${p.id}-${shade === 'h' ? 'sh' : shade})`} />}
      {outline && <path d={d} fill="none" stroke={p.outline} strokeWidth="0.7" strokeLinejoin="round" />}
    </g>
  );
}

function Stitch({ d, p, color }: { d: string; p: Pal; color?: string }) {
  return <path d={d} fill="none" stroke={color ?? p.stitch} strokeWidth="0.55" strokeDasharray="1.4 1.1" strokeLinecap="round" opacity="0.9" />;
}

function Line({ d, color, w = 0.7, op = 1, cap = 'round' }: { d: string; color: string; w?: number; op?: number; cap?: 'round' | 'butt' }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap={cap} strokeLinejoin="round" opacity={op} />;
}

function Fold({ d }: { d: string }) {
  return <Line d={d} color="#000" w={1.4} op={0.06} />;
}

// ── shapes ─────────────────────────────────────────────────────────────────
interface ShapeProps {
  p: Pal;
  pat: string | null;
  fill: boolean;
}

function TeeShape({ p, pat, fill, kids = false }: ShapeProps & { kids?: boolean }) {
  const body = 'M37 17 Q50 25 63 17 L77 21 L93 37 L84 49 L75 42 L75 87 Q50 90 25 87 L25 42 L16 49 L7 37 L23 21 Z';
  const band = pat === 'tipped' ? p.accent : p.dark;
  return (
    <g>
      <path d="M37 17 Q50 13 63 17 Q50 25 37 17 Z" fill={p.deep} />
      <Panel d={body} p={p} fill={fill} />
      <path d="M23 21 L7 37 L16 49 L25 42 Q26 32 23 21 Z" fill="#000" opacity="0.06" />
      <path d="M77 21 L93 37 L84 49 L75 42 Q74 32 77 21 Z" fill="#000" opacity="0.08" />
      <Line d="M23 21 Q26 32 25 42" color={p.outline} w={0.5} op={0.6} />
      <Line d="M77 21 Q74 32 75 42" color={p.outline} w={0.5} op={0.6} />
      <Fold d="M40 50 Q38 66 41 82" />
      <Fold d="M61 48 Q63 64 60 80" />
      <Line d="M37 17 Q50 25 63 17" color={band} w={2.2} />
      <Stitch d="M38.6 19.6 Q50 27.6 61.4 19.6" p={p} />
      {pat === 'tipped' ? (
        <>
          <Line d="M9.4 35.2 L18.4 47.2" color={p.accent} w={1.3} cap="butt" />
          <Line d="M90.6 35.2 L81.6 47.2" color={p.accent} w={1.3} cap="butt" />
        </>
      ) : (
        <>
          <Stitch d="M9.4 35.2 L18.4 47.2" p={p} />
          <Stitch d="M90.6 35.2 L81.6 47.2" p={p} />
        </>
      )}
      {pat === 'piping' && (
        <>
          <Line d="M23.6 22.6 L8.8 37.4" color={p.accent} w={1.1} />
          <Line d="M76.4 22.6 L91.2 37.4" color={p.accent} w={1.1} />
        </>
      )}
      <Stitch d="M25.5 83.6 Q50 86.6 74.5 83.6" p={p} />
      {pat === 'pocket' && (
        <>
          <path d="M56 38 L67 38 L67 49 Q61.5 51 56 49 Z" fill="#000" opacity="0.05" />
          <Line d="M56 38 L67 38 L67 49 Q61.5 51 56 49 Z" color={p.outline} w={0.55} op={0.8} />
          <Stitch d="M57.2 40 L65.8 40" p={p} />
        </>
      )}
      {pat === 'print' && !kids && (
        <g>
          <circle cx="50" cy="46" r="9" fill="none" stroke={p.accent} strokeWidth="1.6" />
          <path d="M43.4 49.6 L47 44.6 L49.6 47.4 L53 42.6 L56.6 49.6 Z" fill={p.accent} />
          <rect x="40.5" y="58" width="19" height="2.4" rx="1.2" fill={p.accent} opacity="0.9" />
          <rect x="44" y="62" width="12" height="1.7" rx="0.85" fill={p.accent} opacity="0.65" />
        </g>
      )}
      {pat === 'print' && kids && (
        <g>
          <path d="M50 37 L53.2 43.6 L60.4 44.4 L55 49.2 L56.6 56.4 L50 52.6 L43.4 56.4 L45 49.2 L39.6 44.4 L46.8 43.6 Z" fill={p.accent} opacity="0.95" />
          <circle cx="36" cy="64" r="2.2" fill={p.accent} opacity="0.6" />
          <circle cx="63" cy="68" r="1.6" fill={p.accent} opacity="0.6" />
        </g>
      )}
    </g>
  );
}

function PoloShape({ p, pat, fill }: ShapeProps) {
  const body = 'M38 16 Q50 20 62 16 L77 21 L93 37 L84 49 L75 42 L75 87 Q50 90 25 87 L25 42 L16 49 L7 37 L23 21 Z';
  const tip = pat === 'tipped';
  return (
    <g>
      <Panel d={body} p={p} fill={fill} />
      <path d="M23 21 L7 37 L16 49 L25 42 Q26 32 23 21 Z" fill="#000" opacity="0.06" />
      <path d="M77 21 L93 37 L84 49 L75 42 Q74 32 77 21 Z" fill="#000" opacity="0.08" />
      <Line d="M23 21 Q26 32 25 42" color={p.outline} w={0.5} op={0.6} />
      <Line d="M77 21 Q74 32 75 42" color={p.outline} w={0.5} op={0.6} />
      <Fold d="M39 52 Q37 68 40 83" />
      <Fold d="M62 50 Q64 66 61 81" />
      {/* rib cuffs */}
      <Line d="M8.4 37.9 L16.6 48.4" color={p.dark} w={2.6} cap="butt" />
      <Line d="M91.6 37.9 L83.4 48.4" color={p.dark} w={2.6} cap="butt" />
      {tip && (
        <>
          <Line d="M10 36.4 L18 46.8" color={p.accent} w={0.9} cap="butt" />
          <Line d="M90 36.4 L82 46.8" color={p.accent} w={0.9} cap="butt" />
        </>
      )}
      {/* placket */}
      <path d="M47.6 23 L52.4 23 L52.4 41 L47.6 41 Z" fill={p.base} />
      <path d="M47.6 23 L52.4 23 L52.4 41 L47.6 41 Z" fill="#000" opacity="0.05" />
      <Line d="M47.6 23 L47.6 41 L52.4 41 L52.4 23" color={p.outline} w={0.5} />
      <circle cx="50" cy="29" r="0.95" fill={p.trim} stroke={p.outline} strokeWidth="0.3" />
      <circle cx="50" cy="35.5" r="0.95" fill={p.trim} stroke={p.outline} strokeWidth="0.3" />
      {/* collar */}
      <path d="M38 16 Q50 11 62 16 L60 19 Q50 15 40 19 Z" fill={p.dark} />
      <Panel d="M38 16 L35.6 22.4 L45 31 L50 23.6 Q44 21 38 16 Z" p={p} shade="v" />
      <Panel d="M62 16 L64.4 22.4 L55 31 L50 23.6 Q56 21 62 16 Z" p={p} shade="v" />
      {tip && (
        <>
          <Line d="M36.6 21.2 L44.8 28.8" color={p.accent} w={1} />
          <Line d="M63.4 21.2 L55.2 28.8" color={p.accent} w={1} />
        </>
      )}
      <Stitch d="M25.5 83.6 Q50 86.6 74.5 83.6" p={p} />
      {pat === 'print' && (
        <g>
          <circle cx="62" cy="34" r="3.2" fill="none" stroke={p.accent} strokeWidth="0.9" />
          <path d="M60.4 34.9 L61.6 33.2 L62.6 34.2 L63.6 32.8 L64.2 34.9 Z" fill={p.accent} />
        </g>
      )}
      {pat === 'pocket' && <Line d="M56 40 L66 40 L66 50 Q61 51.6 56 50 Z" color={p.outline} w={0.55} op={0.8} />}
    </g>
  );
}

function HoodieShape({ p, pat, fill }: ShapeProps) {
  const body = 'M37 21 L24 25 Q15 29 13 44 L9 79 L20 81 L26 52 L26 85 L74 85 L74 52 L80 81 L91 79 L87 44 Q85 29 76 25 L63 21 Z';
  return (
    <g>
      <Panel d={body} p={p} fill={fill} />
      <path d="M24 25 Q15 29 13 44 L9 79 L20 81 L26 52 Q28 38 24 25 Z" fill="#000" opacity="0.06" />
      <path d="M76 25 Q85 29 87 44 L91 79 L80 81 L74 52 Q72 38 76 25 Z" fill="#000" opacity="0.08" />
      <Line d="M24 25 Q28 38 26 52" color={p.outline} w={0.5} op={0.6} />
      <Line d="M76 25 Q72 38 74 52" color={p.outline} w={0.5} op={0.6} />
      {/* cuffs + hem band */}
      <path d="M9.6 74 L20.8 76 L20 81 L9 79 Z" fill={p.dark} />
      <path d="M90.4 74 L79.2 76 L80 81 L91 79 Z" fill={p.dark} />
      <rect x="26" y="80" width="48" height="5" fill={p.dark} />
      <Line d="M26 80 L74 80" color={p.outline} w={0.4} op={0.6} />
      {pat === 'piping' && (
        <>
          <Line d="M24.6 26.4 Q16.4 30 14.6 44 L10.8 74.4" color={p.accent} w={1} />
          <Line d="M75.4 26.4 Q83.6 30 85.4 44 L89.2 74.4" color={p.accent} w={1} />
        </>
      )}
      {/* kangaroo pocket */}
      <path d="M35 61 L65 61 L70 80 L30 80 Z" fill="#000" opacity="0.06" />
      <Line d="M35 61 L65 61" color={p.outline} w={0.5} op={0.7} />
      <Line d="M35 61 L30 80" color={p.deep} w={1.1} />
      <Line d="M65 61 L70 80" color={p.deep} w={1.1} />
      <Stitch d="M36 63 L64 63" p={p} />
      {pat === 'print' && (
        <g>
          <rect x="39" y="41" width="22" height="3.2" rx="1.6" fill={p.accent} />
          <rect x="42.5" y="46.5" width="15" height="2" rx="1" fill={p.accent} opacity="0.7" />
        </g>
      )}
      {/* hood */}
      <Panel d="M35 25 Q31 8 50 6.5 Q69 8 65 25 Q58 34 50 34 Q42 34 35 25 Z" p={p} shade="v" />
      <path d="M39 23 Q38 12 50 11.5 Q62 12 61 23 Q56 30 50 30 Q44 30 39 23 Z" fill={p.deep} />
      <Line d="M39 23 Q38 12 50 11.5 Q62 12 61 23 Q56 30 50 30 Q44 30 39 23 Z" color={p.dark} w={1.4} />
      {/* drawstrings */}
      <Line d="M46.2 30.4 L45.2 46" color={p.trim} w={0.9} />
      <Line d="M53.8 30.4 L54.8 46" color={p.trim} w={0.9} />
      <rect x="44.4" y="45.6" width="1.6" height="3" rx="0.6" fill={p.trim} />
      <rect x="54" y="45.6" width="1.6" height="3" rx="0.6" fill={p.trim} />
    </g>
  );
}

function VestShape({ p, pat, fill }: ShapeProps) {
  const body = 'M36 12 L42 12 Q44 31 50 31 Q56 31 58 12 L64 12 Q64.5 27 73 35 Q77 39 77 46 L77 88 Q50 90 23 88 L23 46 Q23 39 27 35 Q35.5 27 36 12 Z';
  return (
    <g>
      <path d="M42 12 Q50 16.5 58 12 Q56 31 50 31 Q44 31 42 12 Z" fill={p.deep} />
      <Panel d={body} p={p} fill={fill} />
      <Fold d="M40 46 Q38 64 41 84" />
      <Fold d="M60 46 Q62 64 59 84" />
      <Stitch d="M43.3 13 Q45.4 29.4 50 29.4 Q54.6 29.4 56.7 13" p={p} />
      <Stitch d="M37.5 13 Q37.3 28.5 28.4 36.6 Q24.8 40 24.6 46" p={p} />
      <Stitch d="M62.5 13 Q62.7 28.5 71.6 36.6 Q75.2 40 75.4 46" p={p} />
      <Stitch d="M23.6 84.6 Q50 86.6 76.4 84.6" p={p} />
      {pat === 'piping' && <Line d="M42 12 Q44 31 50 31 Q56 31 58 12" color={p.accent} w={1} />}
      {pat === 'print' && <rect x="44" y="44" width="12" height="2.4" rx="1.2" fill={p.accent} opacity="0.8" />}
    </g>
  );
}

function NightwearShape({ p, pat, fill }: ShapeProps) {
  const body = 'M38 16 L24 20 Q16 25 14 39 L10 74 L19.5 76 L25.5 45 L25.5 88 L74.5 88 L74.5 45 L80.5 76 L90 74 L86 39 Q84 25 76 20 L62 16 Q56 21 50 33 Q44 21 38 16 Z';
  const pipe = p.isLight ? mix(p.base, '#1F2A44', 0.55) : p.light;
  return (
    <g>
      <path d="M38 16 Q50 12 62 16 Q56 21 50 33 Q44 21 38 16 Z" fill={p.deep} />
      <Panel d={body} p={p} fill={fill} />
      <path d="M24 20 Q16 25 14 39 L10 74 L19.5 76 L25.5 45 Q27 30 24 20 Z" fill="#000" opacity="0.06" />
      <path d="M76 20 Q84 25 86 39 L90 74 L80.5 76 L74.5 45 Q73 30 76 20 Z" fill="#000" opacity="0.08" />
      <Line d="M24 20 Q27 30 25.5 45" color={p.outline} w={0.5} op={0.6} />
      <Line d="M76 20 Q73 30 74.5 45" color={p.outline} w={0.5} op={0.6} />
      <Line d="M50 40 L50 88" color={p.outline} w={0.55} op={0.8} />
      {[49, 59, 69, 79].map((y) => (
        <circle key={y} cx="52.2" cy={y} r="1.05" fill={p.trim} stroke={p.outline} strokeWidth="0.3" />
      ))}
      <path d="M57 46 L68 46 L68 57 Q62.5 59 57 57 Z" fill="#000" opacity="0.05" />
      <Line d="M57 46 L68 46 L68 57 Q62.5 59 57 57 Z" color={p.outline} w={0.5} op={0.8} />
      <Line d="M57 46.6 L68 46.6" color={pipe} w={1.1} cap="butt" />
      <Line d="M10.7 71.6 L20 73.6" color={pipe} w={1.3} cap="butt" />
      <Line d="M89.3 71.6 L80 73.6" color={pipe} w={1.3} cap="butt" />
      {/* notched collar */}
      <Panel d="M38 16 L34 23 L39.5 25 L38 29 L49.5 41 Q46 28 38 16 Z" p={p} shade="v" />
      <Panel d="M62 16 L66 23 L60.5 25 L62 29 L50.5 41 Q54 28 62 16 Z" p={p} shade="v" />
      <Line d="M38 16 L34 23 L39.5 25 L38 29 L49.5 41" color={pipe} w={1.1} />
      <Line d="M62 16 L66 23 L60.5 25 L62 29 L50.5 41" color={pipe} w={1.1} />
      <Stitch d="M26.5 85 L73.5 85" p={p} />
      {pat === 'print' && <path d="M33 56 l2 3 l3.4 .3 l-2.6 2.2 l.8 3.3 l-3 -1.8 l-3 1.8 l.8 -3.3 l-2.6 -2.2 l3.4 -.3 Z" fill={p.accent} opacity="0.8" />}
    </g>
  );
}

function TrackShape({ p, pat, fill }: ShapeProps) {
  const legs = 'M29 20 L71 20 Q73.5 52 72 83 L56 83 Q54.5 56 50 37 Q45.5 56 44 83 L28 83 Q26.5 52 29 20 Z';
  return (
    <g>
      <Panel d={legs} p={p} fill={fill} />
      <path d="M50 37 Q54.5 56 56 83 L64 83 Q61 58 50 37 Z" fill="#000" opacity="0.07" />
      <Fold d="M41 40 Q39 58 37.5 76" />
      <Fold d="M60 42 Q62 60 63 78" />
      <Line d="M32 21 Q37 27 36.5 34" color={p.outline} w={0.55} op={0.7} />
      <Line d="M68 21 Q63 27 63.5 34" color={p.outline} w={0.55} op={0.7} />
      <Stitch d="M50 20.5 L50 36" p={p} />
      {pat === 'stripe' && (
        <>
          <Line d="M30.8 20.5 Q28.4 52 29.8 82.5" color={p.accent} w={1.5} cap="butt" />
          <Line d="M33.4 20.5 Q31.2 52 32.4 82.5" color={p.accent} w={1.5} cap="butt" />
          <Line d="M69.2 20.5 Q71.6 52 70.2 82.5" color={p.accent} w={1.5} cap="butt" />
          <Line d="M66.6 20.5 Q68.8 52 67.6 82.5" color={p.accent} w={1.5} cap="butt" />
        </>
      )}
      {pat === 'piping' && (
        <>
          <Line d="M31.3 20.5 Q29 52 30.4 82.5" color={p.accent} w={0.95} cap="butt" />
          <Line d="M68.7 20.5 Q71 52 69.6 82.5" color={p.accent} w={0.95} cap="butt" />
        </>
      )}
      {pat === 'pocket' && (
        <>
          <Line d="M33.2 40 L40 38.6" color={p.deep} w={1.3} />
          <rect x="39.4" y="37.4" width="1.6" height="2.8" rx="0.5" fill={p.trim} />
          <Line d="M66.8 40 L60 38.6" color={p.deep} w={1.3} />
          <rect x="59" y="37.4" width="1.6" height="2.8" rx="0.5" fill={p.trim} />
        </>
      )}
      {pat === 'print' && <rect x="59.5" y="27" width="6.5" height="2.6" rx="0.8" fill={p.accent} opacity="0.85" />}
      {/* cuffs */}
      <path d="M28 83 L44 83 L43.4 89.5 L28.6 89.5 Z" fill={p.dark} />
      <path d="M56 83 L72 83 L71.4 89.5 L56.6 89.5 Z" fill={p.dark} />
      <Line d="M28 83 L44 83 L43.4 89.5 L28.6 89.5 Z M56 83 L72 83 L71.4 89.5 L56.6 89.5 Z" color={p.outline} w={0.5} />
      {[31, 34, 37, 40, 59, 62, 65, 68].map((x) => (
        <Line key={x} d={`M${x + 0.5} 84 L${x + 0.5} 88.6`} color="#000" w={0.4} op={0.15} />
      ))}
      {/* waistband + drawstring */}
      <path d="M29 12 L71 12 L71 20 L29 20 Z" fill={p.dark} />
      <Line d="M29 12 L71 12 L71 20 L29 20 Z" color={p.outline} w={0.6} />
      <Stitch d="M30 14.6 L70 14.6" p={p} />
      <Stitch d="M30 17.4 L70 17.4" p={p} />
      <Line d="M48.4 17 Q47.4 24 45.6 29.5" color={p.trim} w={0.9} />
      <Line d="M51.6 17 Q52.6 24 54.4 29.5" color={p.trim} w={0.9} />
      <rect x="44.6" y="29" width="1.6" height="2.8" rx="0.6" fill={p.trim} transform="rotate(18 45.4 30.4)" />
      <rect x="53.8" y="29" width="1.6" height="2.8" rx="0.6" fill={p.trim} transform="rotate(-18 54.6 30.4)" />
    </g>
  );
}

function ShortsShape({ p, pat, fill }: ShapeProps) {
  const legs = 'M28 29 L72 29 Q74.5 52 77 71 L54.5 73 Q53 58 50 47 Q47 58 45.5 73 L23 71 Q25.5 52 28 29 Z';
  return (
    <g>
      <Panel d={legs} p={p} fill={fill} />
      <path d="M50 47 Q53 58 54.5 73 L62 72.4 Q59 58 50 47 Z" fill="#000" opacity="0.07" />
      <Fold d="M40 46 Q37 58 35 69" />
      <Fold d="M61 48 Q64 60 66 70" />
      <Line d="M31 30 Q36 36 35.4 42" color={p.outline} w={0.55} op={0.7} />
      <Line d="M69 30 Q64 36 64.6 42" color={p.outline} w={0.55} op={0.7} />
      <Stitch d="M50 29.5 L50 45" p={p} />
      <Stitch d="M23.7 68.2 L45.7 70.2" p={p} />
      <Stitch d="M54.3 70.2 L76.3 68.2" p={p} />
      {pat === 'stripe' && (
        <>
          <Line d="M29.8 29.5 Q27.5 50 25 70.4" color={p.accent} w={1.4} cap="butt" />
          <Line d="M32.3 29.5 Q30.2 50 27.6 70.6" color={p.accent} w={1.4} cap="butt" />
          <Line d="M70.2 29.5 Q72.5 50 75 70.4" color={p.accent} w={1.4} cap="butt" />
          <Line d="M67.7 29.5 Q69.8 50 72.4 70.6" color={p.accent} w={1.4} cap="butt" />
        </>
      )}
      {pat === 'piping' && (
        <>
          <Line d="M30.4 29.5 Q28.1 50 25.6 70.4" color={p.accent} w={0.95} cap="butt" />
          <Line d="M69.6 29.5 Q71.9 50 74.4 70.4" color={p.accent} w={0.95} cap="butt" />
        </>
      )}
      {pat === 'pocket' && (
        <>
          <Line d="M58 50 L69 49 L69.8 60 L58.8 61 Z" color={p.outline} w={0.55} op={0.8} />
          <Line d="M58 50 L69 49" color={p.deep} w={1} />
        </>
      )}
      {pat === 'print' && <rect x="31.5" y="52" width="6" height="2.4" rx="0.8" fill={p.accent} opacity="0.85" />}
      <path d="M28 22 L72 22 L72 29 L28 29 Z" fill={p.dark} />
      <Line d="M28 22 L72 22 L72 29 L28 29 Z" color={p.outline} w={0.6} />
      <Stitch d="M29 25.5 L71 25.5" p={p} />
      <Line d="M48.4 26.5 Q47.6 31 46.2 35" color={p.trim} w={0.85} />
      <Line d="M51.6 26.5 Q52.4 31 53.8 35" color={p.trim} w={0.85} />
    </g>
  );
}

function BriefShape({ p, pat, fill }: ShapeProps) {
  const body = 'M22.5 39 L77.5 39 Q76 46 73 48 Q60 53 56.5 73 L43.5 73 Q40 53 27 48 Q24 46 22.5 39 Z';
  const band = pat === 'stripe' ? p.accent : p.deep;
  return (
    <g>
      <Panel d={body} p={p} fill={fill} />
      <path d="M40 39.5 Q40 58 50 63 Q60 58 60 39.5 Z" fill="#000" opacity="0.06" />
      <Line d="M40 39.5 Q40 58 50 63 Q60 58 60 39.5" color={p.outline} w={0.5} op={0.7} />
      <Stitch d="M41.8 39.8 Q42 56.4 50 61 Q58 56.4 58.2 39.8" p={p} />
      <Line d="M22.5 39 Q24 46 27 48 Q40 53 43.5 73" color={p.dark} w={1.8} />
      <Line d="M77.5 39 Q76 46 73 48 Q60 53 56.5 73" color={p.dark} w={1.8} />
      <Line d="M43.5 73 L56.5 73" color={p.dark} w={1.4} />
      <path d="M22 30 L78 30 L77.5 39 L22.5 39 Z" fill={band} />
      <Line d="M22 30 L78 30 L77.5 39 L22.5 39 Z" color={p.outline} w={0.6} />
      <rect x="42" y="33.4" width="16" height="2.2" rx="1.1" fill={pat === 'stripe' ? p.base : p.light} opacity="0.85" />
      <Stitch d="M23 31.6 L77 31.6" p={p} color={pat === 'stripe' ? p.base : p.light} />
      <Stitch d="M23 37.4 L77 37.4" p={p} color={pat === 'stripe' ? p.base : p.light} />
    </g>
  );
}

function LeggingsShape({ p, pat, fill }: ShapeProps) {
  const legs = 'M32.4 18 L67.6 18 Q67 42 63.5 62 L61.5 90 L53.5 90 Q53 62 50 33 Q47 62 46.5 90 L38.5 90 L36.5 62 Q33 42 32.4 18 Z';
  return (
    <g>
      <Panel d={legs} p={p} fill={fill} />
      <path d="M50 33 Q53 62 53.5 90 L57 90 Q56 60 50 33 Z" fill="#000" opacity="0.08" />
      <Line d="M40.5 32 Q39.5 50 41 66" color="#fff" w={2} op={0.07} />
      <Line d="M59.5 32 Q60.5 50 59 66" color="#fff" w={2} op={0.05} />
      <Stitch d="M38.9 87.6 L46.3 87.6" p={p} />
      <Stitch d="M53.7 87.6 L61.1 87.6" p={p} />
      {(pat === 'stripe' || pat === 'piping') && (
        <>
          <Line d="M33.8 18.5 Q34.6 42 37.8 62 L39.8 89.5" color={p.accent} w={pat === 'stripe' ? 1.4 : 0.9} cap="butt" />
          <Line d="M66.2 18.5 Q65.4 42 62.2 62 L60.2 89.5" color={p.accent} w={pat === 'stripe' ? 1.4 : 0.9} cap="butt" />
        </>
      )}
      <path d="M32 10 L68 10 L67.6 18 L32.4 18 Z" fill={p.dark} />
      <Line d="M32 10 L68 10 L67.6 18 L32.4 18 Z" color={p.outline} w={0.6} />
      <Stitch d="M33 12.6 L67 12.6" p={p} />
      <Stitch d="M33 15.6 L67 15.6" p={p} />
    </g>
  );
}

function FabricShape({ p, fill }: ShapeProps) {
  const core = '#C9A27E';
  return (
    <g>
      <Panel d="M20 24 L76 24 A9 15 0 0 1 76 54 L20 54 A9 15 0 0 1 20 24 Z" p={p} shade="v" />
      <Line d="M22 30 L74 30" color="#fff" w={2.2} op={0.12} />
      <ellipse cx="76" cy="39" rx="9" ry="15" fill={p.light} stroke={p.outline} strokeWidth="0.6" />
      <ellipse cx="76" cy="39" rx="6.8" ry="11.4" fill="none" stroke={p.dark} strokeWidth="0.5" opacity="0.45" />
      <ellipse cx="76" cy="39" rx="4.6" ry="7.8" fill="none" stroke={p.dark} strokeWidth="0.5" opacity="0.45" />
      <ellipse cx="76" cy="39" rx="2.5" ry="4.3" fill={core} />
      <ellipse cx="76" cy="39" rx="1.3" ry="2.3" fill="#7A5C40" />
      <Panel d="M18 50 L78 50 Q81 68 84 86 Q70 81.5 56 87 Q41 92 24 86 Q21 68 18 50 Z" p={p} fill={fill} shade="drape" />
      <Fold d="M34 52 Q33 70 36 88.6" />
      <Fold d="M52 52 Q54 70 52 88" />
      <Fold d="M68 52 Q70 68 72 84" />
      <Line d="M36.4 52 Q35.6 70 38.4 88.4" color="#fff" w={1.2} op={0.1} />
      <Line d="M54.6 52 Q56.4 70 54.6 87.6" color="#fff" w={1.2} op={0.1} />
    </g>
  );
}

function YarnShape({ p, fill }: ShapeProps) {
  const body = 'M38 22 A12 3.6 0 0 0 62 22 L73 80 A23 6 0 0 1 27 80 Z';
  return (
    <g>
      <path d="M46 9.5 L54 9.5 L54.8 22 L45.2 22 Z" fill="#C9A27E" />
      <ellipse cx="50" cy="9.5" rx="4" ry="1.3" fill="#8F6E50" />
      <Panel d={body} p={p} fill={fill} />
      <ellipse cx="50" cy="22" rx="12" ry="3.6" fill={p.light} stroke={p.outline} strokeWidth="0.6" />
      <ellipse cx="50" cy="22" rx="4.8" ry="1.45" fill="#8F6E50" />
      <Line d="M33 50 Q50 54 67 50" color="#000" w={0.5} op={0.12} />
      <Line d="M30.5 66 Q50 71 69.5 66" color="#000" w={0.5} op={0.12} />
      <Line d="M72.6 72 Q82 66 84.5 74 Q86.5 82 80 86.5" color={p.dark} w={0.9} />
    </g>
  );
}

function SewingShape({ p }: ShapeProps) {
  const head = 'M22 26 Q22 18 30 18 L74 18 Q80 18 80 24 L80 62 L62 62 L62 32 L34 32 L34 50 Q34 52 32 52 L24 52 Q22 52 22 50 Z';
  return (
    <g>
      <Panel d="M10 66 Q10 62 14 62 L86 62 Q90 62 90 66 L90 72 Q90 75 87 75 L13 75 Q10 75 10 72 Z" p={{ ...p, base: p.deep }} shade="v" />
      <path d="M15 64.6 L58 63 L62 70.4 L19 72.6 Z" fill="#F4F6FA" stroke="#C7CED9" strokeWidth="0.5" />
      <Stitch d="M18.4 69 L28 68.4" p={p} color={p.base} />
      <Panel d={head} p={p} />
      <Line d="M26 23.6 L76 23.6" color="#fff" w={1.3} op={0.22} />
      <rect x="42" y="25.4" width="13" height="3.6" rx="1" fill={p.light} opacity="0.85" />
      <path d="M64 36 L78 36 L78 58 L64 58 Z" fill="#000" opacity="0.06" />
      <circle cx="82.5" cy="30" r="7" fill={p.deep} stroke={p.outline} strokeWidth="0.5" />
      <circle cx="82.5" cy="30" r="4" fill={p.dark} />
      <circle cx="82.5" cy="30" r="1.3" fill={p.light} />
      <rect x="26.6" y="52" width="2.8" height="6.4" fill="#A3ABB8" />
      <Line d="M28 58.4 L28 64.2" color="#6B7280" w={0.7} />
      <path d="M24.5 61 L32 61 L32 62.6 L24.5 62.6 Z" fill="#6B7280" />
      <rect x="52" y="11" width="5" height="7" rx="1.2" fill={p.accent === '#F8FAFC' ? '#F59E0B' : p.accent} />
      <Line d="M54.5 11 L54.5 9" color="#6B7280" w={0.8} />
      <Line d="M53 13 Q42 9.6 36 18" color={p.accent === '#F8FAFC' ? '#F59E0B' : p.accent} w={0.5} op={0.9} />
    </g>
  );
}

function PrintShape({ p }: ShapeProps) {
  return (
    <g>
      <Panel d="M14 21 Q14 18 17 18 L83 18 Q86 18 86 21 L86 67 Q86 70 83 70 L17 70 Q14 70 14 67 Z" p={p} shade="v" />
      <rect x="20" y="24" width="60" height="40" rx="1.2" fill="#F4F6FA" stroke={p.outline} strokeWidth="0.5" />
      <path d="M20 24 L80 24 L80 64 L20 64 Z" fill={`url(#${p.id}-mesh)`} />
      <circle cx="50" cy="39" r="8" fill={p.base} />
      <path d="M45.2 41.6 L48 37.8 L50 40 L52.6 36.4 L55 41.6 Z" fill="#F4F6FA" />
      <rect x="38" y="50" width="24" height="3" rx="1.5" fill={p.base} />
      <rect x="42" y="55.4" width="16" height="2" rx="1" fill={p.base} opacity="0.7" />
      <path d="M22 82 Q40 79 56 82 Q70 84.4 80 81 L80 84.6 Q60 88.4 40 86.4 Q28 85.4 22 84.6 Z" fill={p.base} />
      <g transform="rotate(-6 50 74)">
        <rect x="20" y="67" width="60" height="7.5" rx="3.75" fill="#2B3140" />
        <rect x="24" y="68.6" width="52" height="1.4" rx="0.7" fill="#fff" opacity="0.18" />
        <rect x="23" y="74.5" width="54" height="4" rx="1" fill={p.deep} />
      </g>
    </g>
  );
}

function DyeShape({ p }: ShapeProps) {
  return (
    <g>
      <path d="M24 54 L76 54 L71 88 Q50 91 29 88 Z" fill="#A7B1C0" />
      <path d="M24 54 L76 54 L71 88 Q50 91 29 88 Z" fill={`url(#${p.id}-sh)`} />
      <Line d="M24 54 L76 54 L71 88 Q50 91 29 88 Z" color="#6B7686" w={0.6} />
      <Line d="M26.5 66 Q50 69 73.5 66" color="#6B7686" w={1.1} op={0.55} />
      <Line d="M28.2 78 Q50 81 71.8 78" color="#6B7686" w={1.1} op={0.55} />
      <ellipse cx="50" cy="54" rx="26" ry="5.6" fill="#D5DCE5" stroke="#6B7686" strokeWidth="0.6" />
      <ellipse cx="50" cy="54.5" rx="22.6" ry="4.2" fill={p.base} />
      <ellipse cx="50" cy="54.5" rx="22.6" ry="4.2" fill={`url(#${p.id}-v)`} />
      <ellipse cx="50" cy="54.6" rx="9" ry="1.6" fill="none" stroke={p.light} strokeWidth="0.6" opacity="0.8" />
      <ellipse cx="50" cy="54.6" rx="15" ry="2.7" fill="none" stroke={p.light} strokeWidth="0.5" opacity="0.45" />
      <Panel d="M50 9 C50 9 37 26 37 35 C37 42.2 42.8 48 50 48 C57.2 48 63 42.2 63 35 C63 26 50 9 50 9 Z" p={p} />
      <Line d="M43.6 34 Q43.6 28.6 47 24" color="#fff" w={2} op={0.5} />
    </g>
  );
}

function renderShape(shape: string, p: Pal, pat: string | null, fill: boolean, kidsPal?: Pal): ReactNode {
  const props = { p, pat, fill };
  switch (shape) {
    case 'polo': return <PoloShape {...props} />;
    case 'hoodie': return <HoodieShape {...props} />;
    case 'vest': return <VestShape {...props} />;
    case 'nightwear': return <NightwearShape {...props} />;
    case 'trackpants': return <TrackShape {...props} />;
    case 'shorts': return <ShortsShape {...props} />;
    case 'brief': return <BriefShape {...props} />;
    case 'leggings': return <LeggingsShape {...props} />;
    case 'fabric': return <FabricShape {...props} />;
    case 'yarn': return <YarnShape {...props} />;
    case 'sewing': return <SewingShape {...props} />;
    case 'print': return <PrintShape {...props} />;
    case 'dye': return <DyeShape {...props} />;
    case 'kidsset':
      return (
        <g>
          <g transform="translate(21 44) scale(0.58)">
            <ShortsShape p={kidsPal ?? p} pat={pat === 'stripe' ? 'stripe' : null} fill={false} />
          </g>
          <g transform="translate(19 2) scale(0.62)">
            <TeeShape p={p} pat={pat} fill={fill} kids />
          </g>
        </g>
      );
    case 'tshirt':
    default:
      return <TeeShape {...props} />;
  }
}

export function GarmentArt({ shape, color = '#1F2A44', pattern, size, className, style, title }: GarmentArtProps) {
  const raw = useId();
  const uid = 'ga' + raw.replace(/[^a-zA-Z0-9]/g, '');
  const pat = pattern ?? null;
  const p = palette(uid, color);
  const kidsPal = shape === 'kidsset' ? palette(uid + 'k', mix(p.base, '#1F2A44', p.isLight ? 0.75 : 0.55)) : undefined;

  // Overlay fills: dots everywhere they make sense, stripes on tops, rib on vests/briefs, knit on fabric.
  let fillKind: string | null = null;
  if (pat === 'dots' && !['sewing', 'print', 'dye', 'yarn'].includes(shape)) fillKind = 'dots';
  else if (pat === 'stripe' && (TOPS.has(shape) || shape === 'kidsset')) fillKind = 'stripe';
  else if (!pat && (shape === 'vest' || shape === 'brief')) fillKind = 'rib';
  else if (shape === 'fabric') fillKind = pat === 'stripe' ? 'stripe' : pat === 'dots' ? 'dots' : 'knit';
  else if (shape === 'yarn') fillKind = 'wind';

  // Flat warm tint behind the garment (light garments sit on sunken cotton, others on a pale wash of their own colour).
  const bgA = p.isLight ? '#F3F4F6' : mix(p.base, '#FFFFFF', 0.86);

  return (
    <div
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={clsx('relative overflow-hidden', className)}
      style={{
        width: size ?? '100%',
        height: size ?? '100%',
        background: bgA, // flat tint, no gradients
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="block">
        <defs>
          <Defs p={p} fill={fillKind} />
          {kidsPal && <Defs p={kidsPal} fill={null} />}
          {shape === 'print' && (
            <pattern id={`${p.id}-mesh`} width="2" height="2" patternUnits="userSpaceOnUse">
              <path d="M0 0 L2 0 M0 0 L0 2" stroke="#1F2A44" strokeWidth="0.15" opacity="0.18" />
            </pattern>
          )}
        </defs>
        <ellipse cx="50" cy="93" rx="30" ry="2.8" fill="#0B1220" opacity="0.08" />
        {renderShape(shape, p, pat, fillKind !== null, kidsPal)}
      </svg>
    </div>
  );
}

export default GarmentArt;
