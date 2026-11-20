/*
 * CLAIRE Connect icon set.
 *
 * Bespoke 24x24 line icons drawn for the Tiruppur knitwear trade: 1.75 stroke,
 * round caps and joins, soft corners, and one translucent "fabric patch"
 * (currentColor at 16% opacity) behind most drawings. Drop-in compatible with
 * the subset of the lucide-react API this app uses (size, strokeWidth,
 * absoluteStrokeWidth, color, fill, className, style, aria-*).
 */
import { createContext, useContext, type JSX, type ReactNode, type SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  color?: string;
}

/** Kept under the lucide name so existing `type LucideIcon` imports compile unchanged. */
export type LucideIcon = (props: IconProps) => JSX.Element;
export type IconType = LucideIcon;

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/** Colour used by patches and dots, so they follow the `color` prop like the stroke does. */
const Tone = createContext<string>('currentColor');
const PATCH_OPACITY = 0.16;

type PathProps = SVGProps<SVGPathElement>;

/** Fabric patch: a soft filled path behind the line drawing. */
function Patch(props: PathProps) {
  const tone = useContext(Tone);
  return <path fill={tone} stroke="none" opacity={PATCH_OPACITY} {...props} />;
}
/** Circular fabric patch. */
function PatchCircle(props: SVGProps<SVGCircleElement>) {
  const tone = useContext(Tone);
  return <circle fill={tone} stroke="none" opacity={PATCH_OPACITY} {...props} />;
}
/** Rounded-rect fabric patch. */
function PatchRect(props: SVGProps<SVGRectElement>) {
  const tone = useContext(Tone);
  return <rect fill={tone} stroke="none" opacity={PATCH_OPACITY} {...props} />;
}
/** Solid dot (still stroked, so it scales with strokeWidth). */
function Dot({ cx, cy, r = 0.35 }: { cx: number; cy: number; r?: number }) {
  const tone = useContext(Tone);
  return <circle cx={cx} cy={cy} r={r} fill={tone} />;
}

function toNumber(v: number | string | undefined, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function createIcon(name: string, body: ReactNode): LucideIcon {
  function Icon({
    size = 24,
    strokeWidth = 1.75,
    absoluteStrokeWidth,
    color,
    children,
    ...rest
  }: IconProps): JSX.Element {
    const sw = absoluteStrokeWidth
      ? (toNumber(strokeWidth, 1.75) * 24) / toNumber(size, 24)
      : strokeWidth;
    const labelled = rest['aria-label'] != null || rest['aria-labelledby'] != null;
    const tone = color ?? 'currentColor';
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tone}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? 'img' : undefined}
        data-icon={name}
        {...rest}
      >
        <Tone.Provider value={tone}>
          {body}
          {children}
        </Tone.Provider>
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers (they only produce path data)                      */
/* ------------------------------------------------------------------ */

const f = (n: number) => String(Math.round(n * 100) / 100);
const rad = (d: number) => (d * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos(rad(deg)),
  cy + r * Math.sin(rad(deg)),
];

/** Four-point "Claire" star with softly pinched sides. */
function star4(cx: number, cy: number, r: number, k = 0.3): string {
  const n = 0.06 * r;
  const kr = k * r;
  return [
    `M${f(cx)} ${f(cy - r)}`,
    `C${f(cx + n)} ${f(cy - kr)} ${f(cx + kr)} ${f(cy - n)} ${f(cx + r)} ${f(cy)}`,
    `C${f(cx + kr)} ${f(cy + n)} ${f(cx + n)} ${f(cy + kr)} ${f(cx)} ${f(cy + r)}`,
    `C${f(cx - n)} ${f(cy + kr)} ${f(cx - kr)} ${f(cy + n)} ${f(cx - r)} ${f(cy)}`,
    `C${f(cx - kr)} ${f(cy - n)} ${f(cx - n)} ${f(cy - kr)} ${f(cx)} ${f(cy - r)}Z`,
  ].join('');
}

/** Five-point star; corners are softened by the round join. */
function star5(cx: number, cy: number, R: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const [x, y] = polar(cx, cy, i % 2 ? r : R, -90 + i * 36);
    d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  }
  return d + 'Z';
}

/** Scalloped rosette (badge). */
function scallop(cx: number, cy: number, r: number, n: number, bulge: number): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const [x, y] = polar(cx, cy, r, -90 + (i * 360) / n);
    d += i === 0 ? `M${f(x)} ${f(y)}` : `A${bulge} ${bulge} 0 0 1 ${f(x)} ${f(y)}`;
  }
  return d + 'Z';
}

/** Gear with rounded tooth tops. */
function gear(cx: number, cy: number, ro: number, ri: number, n: number): string {
  const step = 360 / n;
  const base = step * 0.3;
  const top = step * 0.18;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = -90 + i * step;
    const p1 = polar(cx, cy, ri, a - base);
    const p2 = polar(cx, cy, ro, a - top);
    const p3 = polar(cx, cy, ro, a + top);
    const p4 = polar(cx, cy, ri, a + base);
    const p5 = polar(cx, cy, ri, a + step - base);
    d += `${i ? 'L' : 'M'}${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}`;
    d += `A${ro} ${ro} 0 0 1 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}`;
    d += `A${ri} ${ri} 0 0 1 ${f(p5[0])} ${f(p5[1])}`;
  }
  return d + 'Z';
}

/** Circular arc from a0 to a1 (degrees, 0 = 3 o'clock, positive = clockwise) with a chevron head at a1. */
function arcArrow(cx: number, cy: number, r: number, a0: number, a1: number, head = 3.4): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const cw = a1 > a0;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const t = rad(a1);
  // direction of travel at the end point, then pointing back
  const bx = cw ? Math.sin(t) : -Math.sin(t);
  const by = cw ? -Math.cos(t) : Math.cos(t);
  const g = rad(42);
  const rot = (s: number): [number, number] => [
    bx * Math.cos(s * g) - by * Math.sin(s * g),
    bx * Math.sin(s * g) + by * Math.cos(s * g),
  ];
  const [ax, ay] = rot(1);
  const [cx2, cy2] = rot(-1);
  return (
    `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} ${cw ? 1 : 0} ${f(x1)} ${f(y1)}` +
    `M${f(x1 + head * ax)} ${f(y1 + head * ay)}L${f(x1)} ${f(y1)}L${f(x1 + head * cx2)} ${f(y1 + head * cy2)}`
  );
}

/* ------------------------------------------------------------------ */
/* Shared drawings                                                     */
/* ------------------------------------------------------------------ */

const spinner = (
  <>
    <circle cx={12} cy={12} r={8.5} opacity={0.16} />
    <path d="M12 3.5A8.5 8.5 0 1 1 3.5 12" />
  </>
);

const shieldD =
  'M11.3 3.25a2 2 0 0 1 1.4 0l5.6 2.1c.75.28 1.2.95 1.2 1.72v4.43c0 4.3-2.85 7.55-7 9.25-4.15-1.7-7-4.95-7-9.25V7.07c0-.77.45-1.44 1.2-1.72z';

const circleCheck = (
  <>
    <PatchCircle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={8.75} />
    <path d="M8.2 12.4l2.6 2.6c1.5-2 3.1-3.8 5-5.4" />
  </>
);

const triangleD =
  'M10.25 4.6c.78-1.33 2.72-1.33 3.5 0l7 12.1c.77 1.33-.2 3-1.75 3H5c-1.55 0-2.52-1.67-1.75-3z';
const alertTriangle = (
  <>
    <Patch d={triangleD} />
    <path d={triangleD} />
    <path d="M12 9.25v4" />
    <Dot cx={12} cy={16.4} r={0.45} />
  </>
);

const clockFace = (
  <>
    <PatchCircle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={8.75} />
  </>
);

const headsetBase = (
  <>
    <PatchRect x={3.75} y={12.25} width={4.25} height={7} rx={2.1} />
    <PatchRect x={16} y={12.25} width={4.25} height={7} rx={2.1} />
    <path d="M5 12.6V12a7 7 0 0 1 14 0v.6" />
    <rect x={3.75} y={12.25} width={4.25} height={7} rx={2.1} />
    <rect x={16} y={12.25} width={4.25} height={7} rx={2.1} />
  </>
);

const bubbleRoundD =
  'M12 3.75c4.7 0 8.5 3.5 8.5 7.85S16.7 19.45 12 19.45c-1.2 0-2.35-.22-3.4-.63L4.4 20.2c-.5.17-.97-.32-.78-.8l1.2-3.05C3.97 15 3.5 13.35 3.5 11.6c0-4.35 3.8-7.85 8.5-7.85z';

const bubbleSquareD =
  'M7 3.75h10c1.93 0 3.5 1.57 3.5 3.5v7c0 1.93-1.57 3.5-3.5 3.5h-4.1l-4.15 3.02c-.5.36-1.2 0-1.2-.6v-2.42H7c-1.93 0-3.5-1.57-3.5-3.5v-7c0-1.93 1.57-3.5 3.5-3.5z';

const thumbUp = (
  <>
    <PatchRect x={3} y={10} width={4} height={10} rx={1.5} />
    <rect x={3} y={10} width={4} height={10} rx={1.5} />
    <path d="M7 10.5l3.4-5.9c.4-.7 1.2-1 2-.8 1 .3 1.6 1.3 1.4 2.3L13.2 10H18c1.4 0 2.5 1.3 2.1 2.7l-1.6 5.6c-.3 1-1.2 1.7-2.3 1.7H7" />
  </>
);

const globeBody = (
  <>
    <PatchCircle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={8.75} />
    <ellipse cx={12} cy={12} rx={3.6} ry={8.75} />
    <path d="M4.3 8.4c4.9 1.5 10.5 1.5 15.4 0M4.3 15.6c4.9-1.5 10.5-1.5 15.4 0" />
  </>
);

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

// Spinners (3/4 arc on a faint track; centred so animate-spin turns on the spot)
export const Loader2 = createIcon('Loader2', spinner);
export const LoaderCircle = createIcon('LoaderCircle', spinner);

// Claire's mark: four-point star with a thread loop
export const Sparkle = createIcon(
  'Sparkle',
  <>
    <Patch d={star4(10, 13.5, 7.75, 0.3)} />
    <path d={star4(10, 13.5, 7.75, 0.3)} />
    <path d="M14.6 8.6c2.7-.9 5.6-2.8 5.5-4.7-.05-1.1-1.5-1.4-2.1-.5-.9 1.4.6 3.4 3.5 3.9" fill="none" />
  </>,
);

export const Sparkles = createIcon(
  'Sparkles',
  <>
    <Patch d={star4(9.75, 14, 7.25, 0.3)} />
    <path d={star4(9.75, 14, 7.25, 0.3)} />
    <path d={star4(18, 5.75, 3.25, 0.32)} />
    <Dot cx={19} cy={15.5} r={0.6} />
  </>,
);

export const Check = createIcon('Check', <path d="M4.75 12.75l4.5 4.4c2.9-4.2 6-7.6 10-10.4" />);
export const X = createIcon('X', <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);

const sendD = 'M20.4 3.6L3.9 10.1c-.83.33-.85 1.5-.03 1.86L10 14.6l2.64 6.12c.36.82 1.53.8 1.86-.03L20.4 3.6z';
export const Send = createIcon(
  'Send',
  <>
    <Patch d="M20.4 3.6L10 14l2.64 6.72c.36.82 1.53.8 1.86-.03z" />
    <path d={sendD} />
    <path d="M10 14.6l4.6-4.6" />
  </>,
);

const sendHD = 'M20.6 11.2L5.1 4.1c-.82-.37-1.68.45-1.33 1.28L6.3 12l-2.53 6.62c-.35.83.5 1.65 1.33 1.28l15.5-7.1c.6-.28.6-1.32 0-1.6z';
const sendHorizontal = (
  <>
    <Patch d="M21.05 12H6.3l-2.53 6.62c-.35.83.5 1.65 1.33 1.28l15.5-7.1c.3-.14.45-.47.45-.8z" />
    <path d={sendHD} />
    <path d="M6.3 12h6.2" />
  </>
);
export const SendHorizontal = createIcon('SendHorizontal', sendHorizontal);

// Cotton bale: pillowy pressed block held by two straps
const baleD =
  'M6.1 5.9c3.9-.75 7.9-.75 11.8 0 1.6.3 2.6 1.6 2.6 3.2v5.8c0 1.6-1 2.9-2.6 3.2-3.9.75-7.9.75-11.8 0-1.6-.3-2.6-1.6-2.6-3.2V9.1c0-1.6 1-2.9 2.6-3.2z';
const bale = (
  <>
    <Patch d={baleD} />
    <path d={baleD} />
    <path d="M8.75 5.5v13M15.25 5.5v13" />
  </>
);
export const Package = createIcon('Package', bale);

export const ShieldCheck = createIcon(
  'ShieldCheck',
  <>
    <Patch d={shieldD} />
    <path d={shieldD} />
    <path
      d="M12 5.9l4.85 1.8v3.8c0 3.05-1.85 5.45-4.85 6.85-3-1.4-4.85-3.8-4.85-6.85V7.7z"
      strokeWidth={1}
      strokeDasharray="1.2 1.6"
      opacity={0.7}
    />
    <path d="M9.4 11.9l1.8 1.8c1-1.45 2-2.55 3.4-3.6" />
  </>,
);

export const ShieldAlert = createIcon(
  'ShieldAlert',
  <>
    <Patch d={shieldD} />
    <path d={shieldD} />
    <path d="M12 8.25v4.25" />
    <Dot cx={12} cy={15.6} r={0.45} />
  </>,
);

export const CircleCheck = createIcon('CircleCheck', circleCheck);
export const CheckCircle2 = createIcon('CheckCircle2', circleCheck);

const clipboardBody = (
  <>
    <PatchRect x={4.75} y={4.5} width={14.5} height={16.5} rx={3} />
    <path d="M8.5 4.5H7.75c-1.66 0-3 1.34-3 3V18c0 1.66 1.34 3 3 3h8.5c1.66 0 3-1.34 3-3V7.5c0-1.66-1.34-3-3-3H15.5" />
    <rect x={8.5} y={2.75} width={7} height={3.5} rx={1.5} />
  </>
);
export const ClipboardCheck = createIcon(
  'ClipboardCheck',
  <>
    {clipboardBody}
    <path d="M9 13.6l2.1 2.1c1.2-1.65 2.4-2.95 3.9-4.1" />
  </>,
);
export const ClipboardList = createIcon(
  'ClipboardList',
  <>
    {clipboardBody}
    <path d="M12 11h3.5M12 15h3.5" />
    <Dot cx={8.9} cy={11} />
    <Dot cx={8.9} cy={15} />
  </>,
);

export const ArrowLeft = createIcon('ArrowLeft', <path d="M19 12H5.5M10.5 6.5L5 12l5.5 5.5" />);
export const ArrowRight = createIcon('ArrowRight', <path d="M5 12h13.5M13.5 6.5L19 12l-5.5 5.5" />);
export const ArrowDown = createIcon('ArrowDown', <path d="M12 5v13.5M6.5 13.5L12 19l5.5-5.5" />);

export const ChevronRight = createIcon('ChevronRight', <path d="M9.5 6l5.6 5.3c.4.4.4 1 0 1.4L9.5 18" />);
export const ChevronLeft = createIcon('ChevronLeft', <path d="M14.5 6l-5.6 5.3c-.4.4-.4 1 0 1.4l5.6 5.3" />);
export const ChevronDown = createIcon('ChevronDown', <path d="M6 9.5l5.3 5.6c.4.4 1 .4 1.4 0L18 9.5" />);
export const ChevronUp = createIcon('ChevronUp', <path d="M6 14.5l5.3-5.6c.4-.4 1-.4 1.4 0l5.3 5.6" />);

export const Mic = createIcon(
  'Mic',
  <>
    <PatchRect x={8.5} y={3} width={7} height={11} rx={3.5} />
    <rect x={8.5} y={3} width={7} height={11} rx={3.5} />
    <path d="M13 7h2.5M13 9.75h2.5" opacity={0.85} />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M9 20.75h6" />
  </>,
);

export const Headphones = createIcon('Headphones', headsetBase);
export const Headset = createIcon(
  'Headset',
  <>
    {headsetBase}
    <path d="M18.1 19.25c0 1.3-1 2-2.4 2h-2.2" />
    <Dot cx={12.6} cy={21.25} r={0.5} />
  </>,
);

// Shop with a scalloped awning
const awningD =
  'M3 9.25l1.4-3.6c.3-.75 1-1.15 1.75-1.15h11.7c.75 0 1.45.4 1.75 1.15L21 9.25a2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0 2.25 2.25 0 0 1-4.5 0z';
export const Store = createIcon(
  'Store',
  <>
    <Patch d={awningD} />
    <path d={awningD} />
    <path d="M7.5 9.25l.55-4.75M12 9.25V4.5M16.5 9.25l-.55-4.75" />
    <path d="M4.75 12.9V18c0 1.38 1.12 2.5 2.5 2.5h9.5c1.38 0 2.5-1.12 2.5-2.5v-5.1" />
    <path d="M9.9 20.5v-3.4a2.1 2.1 0 0 1 4.2 0v3.4" />
  </>,
);

const starD = star5(12, 12.75, 9.25, 4.6);
export const Star = createIcon(
  'Star',
  <>
    <Patch d={starD} />
    <path d={starD} />
  </>,
);

const heartD =
  'M12 20c-5-3.4-8.5-6.55-8.5-10.75C3.5 6.6 5.5 4.5 8 4.5c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4 2.5 0 4.5 2.1 4.5 4.75C20.5 13.45 17 16.6 12 20z';
export const Heart = createIcon(
  'Heart',
  <>
    <Patch d={heartD} />
    <path d={heartD} />
  </>,
);

export const Share2 = createIcon(
  'Share2',
  <>
    <PatchCircle cx={17.5} cy={5.75} r={2.6} />
    <PatchCircle cx={6} cy={12} r={2.6} />
    <PatchCircle cx={17.5} cy={18.25} r={2.6} />
    <circle cx={17.5} cy={5.75} r={2.6} />
    <circle cx={6} cy={12} r={2.6} />
    <circle cx={17.5} cy={18.25} r={2.6} />
    <path d="M8.3 10.75l6.9-3.75M8.3 13.25l6.9 3.75" />
  </>,
);

export const RefreshCw = createIcon(
  'RefreshCw',
  <>
    <PatchCircle cx={12} cy={12} r={4} />
    <path d={arcArrow(12, 12, 8, 190, 330)} />
    <path d={arcArrow(12, 12, 8, 10, 150)} />
  </>,
);

export const Repeat = createIcon(
  'Repeat',
  <>
    <PatchRect x={7} y={9} width={10} height={6} rx={2} />
    <path d="M4.5 11.5V10c0-1.93 1.57-3.5 3.5-3.5h11.5M16.25 3.25l3.25 3.25-3.25 3.25" />
    <path d="M19.5 12.5V14c0 1.93-1.57 3.5-3.5 3.5H4.5M7.75 14.25L4.5 17.5l3.25 3.25" />
  </>,
);

export const ImagePlus = createIcon(
  'ImagePlus',
  <>
    <Patch d="M3 17.5l4.7-4.7c.6-.6 1.5-.6 2.1 0l5.7 5.7-1 2.5H6.5C4.6 21 3 19.4 3 17.5z" />
    <path d="M13 5H6.5C4.57 5 3 6.57 3 8.5v9C3 19.43 4.57 21 6.5 21h9c1.93 0 3.5-1.57 3.5-3.5V11" />
    <path d="M3.4 17.1l4.3-4.3c.6-.6 1.5-.6 2.1 0l5.7 5.7M14 16.5l1.3-1.3c.6-.6 1.5-.6 2.1 0l1.5 1.5" />
    <circle cx={8.5} cy={9.25} r={1.5} />
    <path d="M19 2.5v5M16.5 5h5" />
  </>,
);

const cameraD =
  'M5.5 7.25h2.2l1.35-2c.4-.6 1.05-.95 1.75-.95h2.4c.7 0 1.35.35 1.75.95l1.35 2h2.2c1.52 0 2.75 1.23 2.75 2.75v7.25c0 1.52-1.23 2.75-2.75 2.75h-13c-1.52 0-2.75-1.23-2.75-2.75V10c0-1.52 1.23-2.75 2.75-2.75z';
export const Camera = createIcon(
  'Camera',
  <>
    <PatchCircle cx={12} cy={13.4} r={3.6} />
    <path d={cameraD} />
    <circle cx={12} cy={13.4} r={3.6} />
    <Dot cx={17.6} cy={10.3} r={0.4} />
  </>,
);

export const Globe = createIcon('Globe', globeBody);

export const Languages = createIcon(
  'Languages',
  <>
    <PatchCircle cx={8} cy={15.75} r={5.5} />
    <circle cx={8} cy={15.75} r={5.5} />
    <ellipse cx={8} cy={15.75} rx={2.2} ry={5.5} />
    <path d="M2.6 14.75h10.8" />
    {/* अ: headline, double bowl, connector, stem */}
    <path d="M12.75 3.5h8.75M19.75 3.5v9" />
    <path d="M13.5 5.9c.5-.4 1.1-.65 1.75-.65 1.05 0 1.85.65 1.85 1.55s-.8 1.55-1.85 1.55c1.15 0 2.05.7 2.05 1.7s-.9 1.75-2.05 1.75c-.65 0-1.25-.25-1.7-.6M17.05 8.35h2.7" />
  </>,
);

export const Clock = createIcon(
  'Clock',
  <>
    {clockFace}
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const Clock3 = createIcon(
  'Clock3',
  <>
    {clockFace}
    <path d="M12 7.5V12h4" />
  </>,
);

const bellD =
  'M12 4.5c-3.04 0-5.5 2.46-5.5 5.5v3.3c0 1.2-.5 2.35-1.4 3.15l-.3.27c-.36.33-.13.93.36.93h13.68c.49 0 .72-.6.36-.93l-.3-.27c-.9-.8-1.4-1.95-1.4-3.15V10c0-3.04-2.46-5.5-5.5-5.5z';
export const Bell = createIcon(
  'Bell',
  <>
    <Patch d={bellD} />
    <path d={bellD} />
    <path d="M12 4.5V3M10 20a2 2 0 0 0 4 0" />
  </>,
);

const speakerD =
  'M3.75 9.75c0-.83.67-1.5 1.5-1.5H7.6l4.05-3.3c.65-.53 1.6-.07 1.6.77v12.56c0 .84-.95 1.3-1.6.77L7.6 15.75H5.25c-.83 0-1.5-.67-1.5-1.5z';
export const Volume2 = createIcon(
  'Volume2',
  <>
    <Patch d={speakerD} />
    <path d={speakerD} />
    <path d="M16.25 9.25c.75.75 1.2 1.7 1.2 2.75s-.45 2-1.2 2.75M18.9 6.6c1.5 1.45 2.35 3.35 2.35 5.4s-.85 3.95-2.35 5.4" />
  </>,
);

export const User = createIcon(
  'User',
  <>
    <PatchCircle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={10} r={3.1} />
    <path d="M6.4 18.5c1.2-2.05 3.25-3.35 5.6-3.35s4.4 1.3 5.6 3.35" />
  </>,
);

export const Users = createIcon(
  'Users',
  <>
    <Patch d="M3.5 19.5c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5z" />
    <PatchCircle cx={9} cy={9} r={3.2} />
    <circle cx={9} cy={9} r={3.2} />
    <path d="M3.5 19.5c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" />
    <path d="M14.4 6.3a2.75 2.75 0 1 1 1.3 4.4M16.9 13.9c2.1.6 3.6 2.75 3.6 5.1" />
  </>,
);

export const TriangleExclamationPoint = createIcon('TriangleExclamationPoint', alertTriangle);
export const AlertTriangle = createIcon('AlertTriangle', alertTriangle);

export const AlertCircle = createIcon(
  'AlertCircle',
  <>
    {clockFace}
    <path d="M12 7.75v5" />
    <Dot cx={12} cy={16.1} r={0.45} />
  </>,
);
export const Info = createIcon(
  'Info',
  <>
    {clockFace}
    <path d="M12 11.1v5.15" />
    <Dot cx={12} cy={7.9} r={0.45} />
  </>,
);

export const Trash2 = createIcon(
  'Trash2',
  <>
    <Patch d="M6 7.25h12l-.8 10.95c-.1 1.3-1.2 2.3-2.5 2.3H9.3c-1.3 0-2.4-1-2.5-2.3z" />
    <path d="M4.5 7.25h15M9.5 7.25V5.6c0-.83.67-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5v1.65" />
    <path d="M6 7.25l.8 10.95c.1 1.3 1.2 2.3 2.5 2.3h5.4c1.3 0 2.4-1 2.5-2.3L18 7.25M10.1 11v5.5M13.9 11v5.5" />
  </>,
);

export const Square = createIcon(
  'Square',
  <>
    <PatchRect x={4.5} y={4.5} width={15} height={15} rx={4} />
    <rect x={4.5} y={4.5} width={15} height={15} rx={4} />
  </>,
);

// Tailor shears: one round loop, one long finger loop, long blades
export const Scissors = createIcon(
  'Scissors',
  <>
    <Patch d="M3 16.4c0-1.6 1.9-2.9 4.2-2.9s3.6 1.1 3.6 2.4c0 1.6-1.9 2.9-4.2 2.9S3 17.7 3 16.4z" />
    <circle cx={6.25} cy={7.25} r={2.6} />
    <path d="M3 16.4c0-1.6 1.9-2.9 4.2-2.9s3.6 1.1 3.6 2.4c0 1.6-1.9 2.9-4.2 2.9S3 17.7 3 16.4z" />
    <path d="M8.3 8.9l3.2 3.1 9.3 1.45" />
    <path d="M10.25 14.6l1.25-2.6 9.3-3.3" />
    <Dot cx={11.5} cy={12} r={0.3} />
  </>,
);

export const Plus = createIcon('Plus', <path d="M12 5.5v13M5.5 12h13" />);
export const Minus = createIcon('Minus', <path d="M5.5 12h13" />);

const phoneD =
  'M6.6 3.6l2.1-.2c.6 0 1.1.3 1.3.9l1 3c.2.6 0 1.2-.5 1.6l-1.4 1c1 2.2 2.8 4 5 5l1-1.4c.4-.5 1-.7 1.6-.5l3 1c.6.2.9.7.9 1.3l-.2 2.1c-.1 1.3-1.2 2.2-2.5 2.1C10.4 19.4 4.6 13.6 4.1 6.1 4 4.8 5.3 3.7 6.6 3.6z';
export const Phone = createIcon(
  'Phone',
  <>
    <Patch d={phoneD} />
    <path d={phoneD} />
  </>,
);

const pencilD = 'M15.6 4.4c1.1-1.1 2.9-1.1 4 0s1.1 2.9 0 4L9 19l-4.6.6.6-4.6z';
export const Pencil = createIcon(
  'Pencil',
  <>
    <Patch d={pencilD} />
    <path d={pencilD} />
    <path d="M13.6 6.4l4 4" />
  </>,
);

export const MessageCircle = createIcon(
  'MessageCircle',
  <>
    <Patch d={bubbleRoundD} />
    <path d={bubbleRoundD} />
  </>,
);
export const MessageCirclePlus = createIcon(
  'MessageCirclePlus',
  <>
    <Patch d={bubbleRoundD} />
    <path d={bubbleRoundD} />
    <path d="M12 8.6v6M9 11.6h6" />
  </>,
);
export const MessageSquareText = createIcon(
  'MessageSquareText',
  <>
    <Patch d={bubbleSquareD} />
    <path d={bubbleSquareD} />
    <path d="M8 9h8M8 12.5h5" />
  </>,
);

const frontBubbleD =
  'M5.75 9h7c1.52 0 2.75 1.23 2.75 2.75v3.5c0 1.52-1.23 2.75-2.75 2.75H9.6l-3.2 2.4c-.33.25-.8.01-.8-.4V18C4.15 17.92 3 16.72 3 15.25v-3.5C3 10.23 4.23 9 5.75 9z';
export const MessagesSquare = createIcon(
  'MessagesSquare',
  <>
    <Patch d={frontBubbleD} />
    <path d={frontBubbleD} />
    <path d="M8.5 9V6.75C8.5 5.23 9.73 4 11.25 4h7C19.77 4 21 5.23 21 6.75v3.5c0 1.47-1.15 2.67-2.6 2.75v1.6c0 .41-.47.65-.8.4l-2.1-1.6" />
  </>,
);

const pinD = 'M12 21c-3.5-3.6-6.5-7.05-6.5-10.5a6.5 6.5 0 0 1 13 0c0 3.45-3 6.9-6.5 10.5z';
export const MapPin = createIcon(
  'MapPin',
  <>
    <Patch d={pinD} />
    <path d={pinD} />
    <circle cx={12} cy={10.5} r={2.4} />
  </>,
);

export const LogOut = createIcon(
  'LogOut',
  <>
    <PatchRect x={4.5} y={4} width={6} height={16} rx={2.5} />
    <path d="M10 4H7c-1.38 0-2.5 1.12-2.5 2.5v11C4.5 18.88 5.62 20 7 20h3" />
    <path d="M10.5 12h9.5M16.5 8.25L20.25 12l-3.75 3.75" />
  </>,
);
export const LogIn = createIcon(
  'LogIn',
  <>
    <PatchRect x={13.5} y={4} width={6} height={16} rx={2.5} />
    <path d="M14 4h3c1.38 0 2.5 1.12 2.5 2.5v11c0 1.38-1.12 2.5-2.5 2.5h-3" />
    <path d="M3.75 12h10M10.25 8.25L14 12l-3.75 3.75" />
  </>,
);

export const Inbox = createIcon(
  'Inbox',
  <>
    <Patch d="M3.5 13.25h4.4l1.4 2.25h5.4l1.4-2.25h4.4V17c0 1.38-1.12 2.5-2.5 2.5H6c-1.38 0-2.5-1.12-2.5-2.5z" />
    <path d="M3.5 13.25l2.4-6.6c.4-1.1 1.4-1.9 2.6-1.9h7c1.2 0 2.2.8 2.6 1.9l2.4 6.6V17c0 1.38-1.12 2.5-2.5 2.5H6c-1.38 0-2.5-1.12-2.5-2.5z" />
    <path d="M3.5 13.25h4.4l1.4 2.25h5.4l1.4-2.25h4.4" />
  </>,
);

export const Copy = createIcon(
  'Copy',
  <>
    <PatchRect x={8.5} y={8.5} width={12} height={12} rx={2.75} />
    <path d="M15.5 8.5V6.25c0-1.52-1.23-2.75-2.75-2.75h-6.5C4.73 3.5 3.5 4.73 3.5 6.25v6.5c0 1.52 1.23 2.75 2.75 2.75H8.5" />
    <rect x={8.5} y={8.5} width={12} height={12} rx={2.75} />
  </>,
);

const badgeD = scallop(12, 12, 7.6, 8, 3.4);
export const BadgeCheck = createIcon(
  'BadgeCheck',
  <>
    <Patch d={badgeD} />
    <path d={badgeD} />
    <path d="M8.9 12.2l2.2 2.2c1.25-1.75 2.5-3.05 4-4.25" />
  </>,
);

const zapD =
  'M13.2 3.2L5.3 13.1c-.33.42-.04 1.03.5 1.03H11l-1.3 6.15c-.12.55.58.88.94.44l7.86-9.9c.33-.42.04-1.03-.5-1.03H13l1.14-6.07c.1-.54-.6-.86-.94-.42z';
export const Zap = createIcon(
  'Zap',
  <>
    <Patch d={zapD} />
    <path d={zapD} />
  </>,
);

export const WifiOff = createIcon(
  'WifiOff',
  <>
    <path d="M3 9.4C5.4 7.2 8.6 5.9 12 5.9c1.3 0 2.55.18 3.75.53M18.2 7.8c1 .45 1.95 1 2.8 1.6" />
    <path d="M6.3 12.75c1.2-1 2.6-1.7 4.1-2M14.6 11.3c1.15.35 2.2.85 3.1 1.45" />
    <path d="M9.5 16c.7-.6 1.55-.95 2.5-.95s1.8.35 2.5.95" />
    <Dot cx={12} cy={18.9} r={0.45} />
    <path d="M4.5 3.5l15 17" />
  </>,
);

// Cloth drawstring pouch
const pouchD =
  'M8.3 8.6C5.6 10.4 3.75 13.3 3.75 16.1c0 2.5 2 4.4 4.5 4.4h7.5c2.5 0 4.5-1.9 4.5-4.4 0-2.8-1.85-5.7-4.55-7.5z';
export const Wallet = createIcon(
  'Wallet',
  <>
    <Patch d={pouchD} />
    <path d={pouchD} />
    <path d="M8.3 8.6L7 5c-.2-.5.3-1 .8-.8l1.7.6 1.8-1.3c.4-.3.9-.3 1.3 0l1.8 1.3 1.7-.6c.5-.2 1 .3.8.8l-1.3 3.6" />
    <path d="M8.3 8.6c2.4.8 5 .8 7.4 0M12 9.2l-1.3 2.9M12 9.2l1.4 2.7" />
  </>,
);

export const TrendingUp = createIcon(
  'TrendingUp',
  <>
    <Patch d="M3.5 17.5l5.25-5.25 3.5 3.5L20.5 7.5V18c0 .83-.67 1.5-1.5 1.5H5c-.83 0-1.5-.67-1.5-1.5z" />
    <path d="M3.5 17.5l5.25-5.25 3.5 3.5L20.5 7.5M15.25 7.25h5.25v5.25" />
  </>,
);
export const TrendingDown = createIcon(
  'TrendingDown',
  <>
    <Patch d="M3.5 6.5l5.25 5.25 3.5-3.5 8.25 8.25V18c0 .83-.67 1.5-1.5 1.5H5c-.83 0-1.5-.67-1.5-1.5z" />
    <path d="M3.5 6.5l5.25 5.25 3.5-3.5 8.25 8.25M15.25 16.75h5.25V11.5" />
  </>,
);

export const ThumbsUp = createIcon('ThumbsUp', thumbUp);
export const ThumbsDown = createIcon('ThumbsDown', <g transform="matrix(1 0 0 -1 0 24)">{thumbUp}</g>);

// Price tag with a thread through the eyelet
const tagD =
  'M4 5.6C4 4.7 4.7 4 5.6 4h5.2c.6 0 1.1.2 1.5.6l7.6 7.6c.9.9.9 2.3 0 3.2l-4.2 4.2c-.9.9-2.3.9-3.2 0L4.6 12.1c-.4-.4-.6-.9-.6-1.5z';
export const Tag = createIcon(
  'Tag',
  <>
    <g transform="translate(1.25 1.25)">
      <Patch d={tagD} />
      <path d={tagD} />
      <circle cx={8.2} cy={8.2} r={1.4} />
    </g>
    <path d="M8.6 8.6C7.2 6.4 5.2 4.3 3.7 4.5c-1.1.15-1.3 1.5-.4 2.15 1.2.85 3.1 1.3 5 1.6" />
  </>,
);

const bagD = 'M6.6 8h10.8c.8 0 1.45.6 1.5 1.4l.6 9c.1 1.45-1.05 2.6-2.5 2.6H7c-1.45 0-2.6-1.15-2.5-2.6l.6-9C5.15 8.6 5.8 8 6.6 8z';
export const ShoppingBag = createIcon(
  'ShoppingBag',
  <>
    <Patch d={bagD} />
    <path d={bagD} />
    <path d="M8.75 10.75V7.25a3.25 3.25 0 0 1 6.5 0v3.5" />
  </>,
);

export const Search = createIcon(
  'Search',
  <>
    <PatchCircle cx={10.5} cy={10.5} r={6.5} />
    <circle cx={10.5} cy={10.5} r={6.5} />
    <path d="M15.4 15.4l4.85 4.85" />
    <path d="M7.4 9.2a3.4 3.4 0 0 1 2.1-2.15" opacity={0.85} />
  </>,
);

const playD = 'M8 5.3c0-.8.9-1.3 1.6-.85l9.3 6.1c.6.4.6 1.3 0 1.7l-9.3 6.1c-.7.45-1.6-.05-1.6-.85z';
export const Play = createIcon(
  'Play',
  <>
    <Patch d={playD} />
    <path d={playD} />
  </>,
);
export const Pause = createIcon(
  'Pause',
  <>
    <PatchRect x={6.25} y={5} width={4} height={14} rx={1.75} />
    <PatchRect x={13.75} y={5} width={4} height={14} rx={1.75} />
    <rect x={6.25} y={5} width={4} height={14} rx={1.75} />
    <rect x={13.75} y={5} width={4} height={14} rx={1.75} />
  </>,
);

export const Pin = createIcon(
  'Pin',
  <>
    <Patch d="M9.75 3.75h4.5v5l2.9 3.25c.3.35.35.6.35.9v1.35H6.5V12.9c0-.3.05-.55.35-.9l2.9-3.25z" />
    <path d="M8.5 3.75h7M9.75 3.75v5L6.85 12c-.3.35-.35.6-.35.9v1.35h11V12.9c0-.3-.05-.55-.35-.9l-2.9-3.25v-5M12 14.25v6.5" />
  </>,
);

export const Lock = createIcon(
  'Lock',
  <>
    <PatchRect x={4.5} y={10.5} width={15} height={10} rx={3} />
    <rect x={4.5} y={10.5} width={15} height={10} rx={3} />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" />
  </>,
);

const bulbD =
  'M9.1 17.25V16c0-1-.5-1.75-1.25-2.5A6 6 0 1 1 16.15 13.5c-.75.75-1.25 1.5-1.25 2.5v1.25z';
export const Lightbulb = createIcon(
  'Lightbulb',
  <>
    <Patch d={bulbD} />
    <path d={bulbD} />
    <path d="M9.6 20.5h4.8M10.6 13.75l1.4-2.25 1.4 2.25" />
  </>,
);

export const LifeBuoy = createIcon(
  'LifeBuoy',
  <>
    <Patch
      d="M12 3.25a8.75 8.75 0 1 1 0 17.5 8.75 8.75 0 0 1 0-17.5zm0 5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z"
      fillRule="evenodd"
    />
    <circle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={3.75} />
    <path d="M9.35 9.35L5.8 5.8M14.65 9.35L18.2 5.8M14.65 14.65l3.55 3.55M9.35 14.65L5.8 18.2" />
  </>,
);

const layerTopD = 'M11.3 3.85a1.5 1.5 0 0 1 1.4 0l7.6 3.95c.6.3.6 1.15 0 1.45l-7.6 3.95a1.5 1.5 0 0 1-1.4 0L3.7 9.25c-.6-.3-.6-1.15 0-1.45z';
export const Layers = createIcon(
  'Layers',
  <>
    <Patch d={layerTopD} />
    <path d={layerTopD} />
    <path d="M3.6 12.6l7.7 4a1.5 1.5 0 0 0 1.4 0l7.7-4M3.6 16.1l7.7 4a1.5 1.5 0 0 0 1.4 0l7.7-4" />
  </>,
);

export const Keyboard = createIcon(
  'Keyboard',
  <>
    <PatchRect x={2.5} y={6} width={19} height={12} rx={3} />
    <rect x={2.5} y={6} width={19} height={12} rx={3} />
    <Dot cx={6.5} cy={10} />
    <Dot cx={9.5} cy={10} />
    <Dot cx={12.5} cy={10} />
    <Dot cx={15.5} cy={10} />
    <Dot cx={17.75} cy={10} />
    <path d="M8 14.25h8" />
  </>,
);

export const Keypad = createIcon(
  'Keypad',
  <>
    <PatchRect x={4} y={2.75} width={16} height={18.5} rx={4} />
    {[4.75, 9.25, 13.75].flatMap((y) =>
      [7, 12, 17].map((x) => <Dot key={`${x}-${y}`} cx={x} cy={y} r={0.7} />),
    )}
    <Dot cx={12} cy={18.5} r={0.7} />
  </>,
);

export const IndianRupee = createIcon(
  'IndianRupee',
  <>
    <PatchCircle cx={12} cy={12} r={9} />
    <path d="M7 5h10M7 9h10" />
    <path d="M9 5c2.65 0 4.4 1.7 4.4 4.1S11.65 13.2 9 13.2H7.25l7.25 6.3" />
  </>,
);

export const Gauge = createIcon(
  'Gauge',
  <>
    <Patch d="M4.2 18A8.5 8.5 0 1 1 19.8 18z" />
    <path d="M4.2 18A8.5 8.5 0 1 1 19.8 18" />
    <path d="M12 14.6l3.3-4" />
    <circle cx={12} cy={14.6} r={1.35} />
    <path d="M6.6 11.1l1.1.7M12 6.1v1.3M17.4 11.1l-1.1.7" opacity={0.8} />
  </>,
);

export const FileText = createIcon(
  'FileText',
  <>
    <Patch d="M14 3.5H7C5.62 3.5 4.5 4.62 4.5 6v12c0 1.38 1.12 2.5 2.5 2.5h10c1.38 0 2.5-1.12 2.5-2.5V9z" />
    <path d="M14 3.5H7C5.62 3.5 4.5 4.62 4.5 6v12c0 1.38 1.12 2.5 2.5 2.5h10c1.38 0 2.5-1.12 2.5-2.5V9z" />
    <path d="M14 3.75V7.5c0 .83.67 1.5 1.5 1.5h3.75M8.5 13h7M8.5 16.5h4.5" />
  </>,
);

// Sawtooth-roof spinning mill with a chimney
const millD =
  'M4.5 20.5h15c.55 0 1-.45 1-1v-15c0-.55-.45-1-1-1H18c-.55 0-1 .45-1 1v4L12.5 11.5v-3L8 11.5v-3l-4.5 3v8c0 .55.45 1 1 1z';
export const Factory = createIcon(
  'Factory',
  <>
    <Patch d={millD} />
    <path d={millD} />
    <path d="M6.75 15h1.5M16 15h1.5M10.75 20.5v-2.6a1.25 1.25 0 0 1 2.5 0v2.6" />
  </>,
);

export const ExternalLink = createIcon(
  'ExternalLink',
  <>
    <PatchRect x={4.5} y={4.5} width={15} height={15} rx={2.5} />
    <path d="M11 4.5H7C5.62 4.5 4.5 5.62 4.5 7v10c0 1.38 1.12 2.5 2.5 2.5h10c1.38 0 2.5-1.12 2.5-2.5v-4" />
    <path d="M14.25 4h5.75v5.75M19.75 4.25l-8.25 8.25" />
  </>,
);

export const Circle = createIcon(
  'Circle',
  <>
    <PatchCircle cx={12} cy={12} r={8.5} />
    <circle cx={12} cy={12} r={8.5} />
  </>,
);

// Claire's chat mark: a speech bubble holding the four-point star
export const Bot = createIcon(
  'Bot',
  <>
    <Patch d={bubbleSquareD} />
    <path d={bubbleSquareD} />
    <path d={star4(12, 10.75, 4.25, 0.3)} />
  </>,
);

export const BarChart3 = createIcon(
  'BarChart3',
  <>
    <PatchRect x={7.25} y={11} width={3.5} height={6} rx={1.25} />
    <PatchRect x={11.75} y={6.5} width={3.5} height={10.5} rx={1.25} />
    <PatchRect x={16.25} y={12.75} width={3.5} height={4.25} rx={1.25} />
    <path d="M4 3.75V18c0 1.38 1.12 2.5 2.5 2.5h14" />
    <path d="M9 16.25v-4.5M13.5 16.25V7.5M18 16.25v-2.5" />
  </>,
);

const houseD =
  'M4 10.6l7.03-6.15a1.5 1.5 0 0 1 1.94 0L20 10.6V18c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 20.5 4 19.38 4 18z';
export const Home = createIcon(
  'Home',
  <>
    <Patch d={houseD} />
    <path d={houseD} />
    <path d="M9.75 20.5v-4.25a2.25 2.25 0 0 1 4.5 0v4.25" />
  </>,
);

const funnelD =
  'M4.6 4.5h14.8c.84 0 1.3.98.75 1.62L14.5 12.6v5.15c0 .37-.2.7-.52.88l-2.9 1.62c-.5.28-1.08-.08-1.08-.64V12.6L4.1 6.12c-.55-.64-.09-1.62.75-1.62z';
export const Filter = createIcon(
  'Filter',
  <>
    <Patch d={funnelD} />
    <path d={funnelD} />
  </>,
);

export const SlidersHorizontal = createIcon(
  'SlidersHorizontal',
  <>
    <PatchCircle cx={13.5} cy={7} r={2.1} />
    <PatchCircle cx={8.5} cy={12} r={2.1} />
    <PatchCircle cx={16} cy={17} r={2.1} />
    <path d="M3.5 7h7.9M15.6 7h4.9M3.5 12h2.9M10.6 12h9.9M3.5 17h10.4M18.1 17h2.4" />
    <circle cx={13.5} cy={7} r={2.1} />
    <circle cx={8.5} cy={12} r={2.1} />
    <circle cx={16} cy={17} r={2.1} />
  </>,
);

const clasp =
  'M5.25 9.25l2.85-2c.6-.4 1.4-.45 2.05-.1L12 8.2l1.85-1.05c.65-.35 1.45-.3 2.05.1l2.85 2v5.5L16.8 16.3a1.4 1.4 0 0 1-2 1.1 1.4 1.4 0 0 1-2.3.4 1.4 1.4 0 0 1-2.3-.2 1.4 1.4 0 0 1-2.2-.6l-2.75-2.25z';
export const Handshake = createIcon(
  'Handshake',
  <>
    <Patch d={clasp} />
    <rect x={2} y={7.5} width={3.25} height={8.75} rx={1.3} />
    <rect x={18.75} y={7.5} width={3.25} height={8.75} rx={1.3} />
    <path d="M5.25 9.25l2.85-2c.6-.4 1.4-.45 2.05-.1L12 8.2l1.85-1.05c.65-.35 1.45-.3 2.05.1l2.85 2" />
    <path d="M5.25 14.75L8 17a1.4 1.4 0 0 0 2.2.6 1.4 1.4 0 0 0 2.3.2 1.4 1.4 0 0 0 2.3-.4 1.4 1.4 0 0 0 2-1.1l1.95-1.55" />
    <path d="M12 8.2l-2.4 2.25c-.5.5-.5 1.3 0 1.75.5.45 1.25.45 1.75 0l2.05-1.9 3.3 3.3" />
    <path d="M12.5 17.8l-1.6-1.6M14.8 17.4l-1.6-1.6" />
  </>,
);

export const Trophy = createIcon(
  'Trophy',
  <>
    <Patch d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 6H5.5C4.67 6 4 6.67 4 7.5 4 9.43 5.57 11 7.5 11h.3M16.5 6h2c.83 0 1.5.67 1.5 1.5 0 1.93-1.57 3.5-3.5 3.5h-.3" />
    <path d="M12 13.5v3M8.5 20c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5z" />
  </>,
);

// Small Indian goods carrier with a bale on the open bed
export const Truck = createIcon(
  'Truck',
  <>
    <PatchRect x={3.5} y={5.25} width={8.5} height={4.25} rx={1.9} />
    <rect x={3.5} y={5.25} width={8.5} height={4.25} rx={1.9} />
    <path d="M7.75 5.25v4.25" />
    <path d="M4.3 16.25H3.9c-.77 0-1.4-.63-1.4-1.4V9.5H13v6.75h-4.4" />
    <path d="M13 16.25V9c0-.83.67-1.5 1.5-1.5h2.55c.56 0 1.07.3 1.32.8l2.33 4.25c.13.23.2.5.2.76v1.54c0 .77-.63 1.4-1.4 1.4h-.3" />
    <path d="M15.25 7.5v3.25c0 .28.22.5.5.5h4" />
    <circle cx={6.45} cy={17} r={2} />
    <circle cx={16.75} cy={17} r={2} />
  </>,
);

export const Upload = createIcon(
  'Upload',
  <>
    <Patch d="M4.5 15h15v2.5c0 1.38-1.12 2.5-2.5 2.5H7c-1.38 0-2.5-1.12-2.5-2.5z" />
    <path d="M4.5 15v2.5C4.5 18.88 5.62 20 7 20h10c1.38 0 2.5-1.12 2.5-2.5V15" />
    <path d="M12 15.25V4.5M7.5 9L12 4.5 16.5 9" />
  </>,
);

export const Eye = createIcon(
  'Eye',
  <>
    <PatchCircle cx={12} cy={12} r={3.25} />
    <path d="M2.75 12C4.8 7.9 8.1 5.5 12 5.5s7.2 2.4 9.25 6.5C19.2 16.1 15.9 18.5 12 18.5S4.8 16.1 2.75 12z" />
    <circle cx={12} cy={12} r={3.25} />
  </>,
);

export const Calendar = createIcon(
  'Calendar',
  <>
    <Patch d="M3.5 10V8c0-1.66 1.34-3 3-3h11c1.66 0 3 1.34 3 3v2z" />
    <rect x={3.5} y={5} width={17} height={15.5} rx={3} />
    <path d="M3.5 10h17M8 3.25v3.5M16 3.25v3.5" />
    <Dot cx={8} cy={13.75} />
    <Dot cx={12} cy={13.75} />
    <Dot cx={16} cy={13.75} />
    <Dot cx={8} cy={17} />
    <Dot cx={12} cy={17} />
  </>,
);

export const Columns = createIcon(
  'Columns',
  <>
    <PatchRect x={3} y={4} width={8} height={16} rx={2.5} />
    <rect x={3} y={4} width={8} height={16} rx={2.5} />
    <rect x={13} y={4} width={8} height={16} rx={2.5} />
    <path d="M5.75 8.25h2.5M5.75 11.25h2.5M15.75 8.25h2.5M15.75 11.25h2.5" />
  </>,
);

export const LayoutGrid = createIcon(
  'LayoutGrid',
  <>
    <PatchRect x={3.5} y={3.5} width={7.25} height={7.25} rx={2.25} />
    <rect x={3.5} y={3.5} width={7.25} height={7.25} rx={2.25} />
    <rect x={13.25} y={3.5} width={7.25} height={7.25} rx={2.25} />
    <rect x={3.5} y={13.25} width={7.25} height={7.25} rx={2.25} />
    <rect x={13.25} y={13.25} width={7.25} height={7.25} rx={3.6} />
  </>,
);

export const Ruler = createIcon(
  'Ruler',
  <g transform="rotate(-45 12 12)">
    <PatchRect x={1.9} y={8.25} width={20.2} height={7.5} rx={2} />
    <rect x={1.9} y={8.25} width={20.2} height={7.5} rx={2} />
    <path d="M5.75 8.25v2M8.75 8.25v3.25M11.75 8.25v2M14.75 8.25v3.25M17.75 8.25v2" />
  </g>,
);

// Thread spool: two flanges, wound thread, a loose end
export const Spool = createIcon(
  'Spool',
  <>
    <PatchRect x={7.5} y={6} width={9} height={12} />
    <rect x={5.25} y={3} width={13.5} height={3} rx={1.5} />
    <rect x={5.25} y={18} width={13.5} height={3} rx={1.5} />
    <path d="M7.5 6v12M16.5 6v12" />
    <path d="M7.5 10.25l9-1.6M7.5 14.75l9-1.6" />
    <path d="M16.5 13.25c1.9.3 3.5 1.55 3.6 3.6" />
  </>,
);

const teeD =
  'M8.5 3.75c.6 1.4 2 2.25 3.5 2.25s2.9-.85 3.5-2.25l4.6 2c.5.2.7.7.6 1.2l-.9 3.2c-.1.5-.6.8-1.1.7L17 10.5V19c0 .8-.7 1.5-1.5 1.5h-7C7.7 20.5 7 19.8 7 19v-8.5l-1.7.35c-.5.1-1-.2-1.1-.7l-.9-3.2c-.1-.5.1-1 .6-1.2z';
export const Shirt = createIcon(
  'Shirt',
  <>
    <Patch d={teeD} />
    <path d={teeD} />
  </>,
);

export const Boxes = createIcon(
  'Boxes',
  <>
    <PatchRect x={7.75} y={3.5} width={8.5} height={8} rx={2} />
    <rect x={7.75} y={3.5} width={8.5} height={8} rx={2} />
    <rect x={3} y={12.5} width={8.5} height={8} rx={2} />
    <rect x={12.5} y={12.5} width={8.5} height={8} rx={2} />
    <path d="M12 3.5v2.75M7.25 12.5v2.75M16.75 12.5v2.75" />
  </>,
);

const receiptD =
  'M6 3.5h12c.83 0 1.5.67 1.5 1.5v15.5L17 19l-2.5 1.5L12 19l-2.5 1.5L7 19l-2.5 1.5V5c0-.83.67-1.5 1.5-1.5z';
export const Receipt = createIcon(
  'Receipt',
  <>
    <Patch d={receiptD} />
    <path d={receiptD} />
    <path d="M8 8h8M8 11.5h8M8 15h4.5" />
  </>,
);

export const Percent = createIcon(
  'Percent',
  <>
    <PatchCircle cx={7.25} cy={7.25} r={2.4} />
    <PatchCircle cx={16.75} cy={16.75} r={2.4} />
    <path d="M18.5 5.5l-13 13" />
    <circle cx={7.25} cy={7.25} r={2.4} />
    <circle cx={16.75} cy={16.75} r={2.4} />
  </>,
);

export const Gift = createIcon(
  'Gift',
  <>
    <PatchRect x={4.5} y={10.5} width={15} height={10} rx={2} />
    <rect x={4.5} y={10.5} width={15} height={10} rx={2} />
    <rect x={3.5} y={7} width={17} height={3.5} rx={1.5} />
    <path d="M12 7v13.5" />
    <path d="M12 7c-1-2.6-4.6-3.8-5-1.5-.3 1.6 2.6 1.5 5 1.5zM12 7c1-2.6 4.6-3.8 5-1.5.3 1.6-2.6 1.5-5 1.5z" />
  </>,
);

export const History = createIcon(
  'History',
  <>
    <PatchCircle cx={12} cy={12} r={7.75} />
    <path d={arcArrow(12, 12, 7.75, 180, -130, 3.2)} />
    <path d="M12 8.25V12l2.75 1.75" />
  </>,
);

const gearD = gear(12, 12, 8.75, 6.6, 8);
export const Settings = createIcon(
  'Settings',
  <>
    <Patch d={gearD} />
    <path d={gearD} />
    <circle cx={12} cy={12} r={2.75} />
  </>,
);

export const MoreVertical = createIcon(
  'MoreVertical',
  <>
    <Dot cx={12} cy={5.5} r={1} />
    <Dot cx={12} cy={12} r={1} />
    <Dot cx={12} cy={18.5} r={1} />
  </>,
);
export const MoreHorizontal = createIcon(
  'MoreHorizontal',
  <>
    <Dot cx={5.5} cy={12} r={1} />
    <Dot cx={12} cy={12} r={1} />
    <Dot cx={18.5} cy={12} r={1} />
  </>,
);

export const Smile = createIcon(
  'Smile',
  <>
    {clockFace}
    <path d="M8.5 14c.9 1.3 2.2 2 3.5 2s2.6-.7 3.5-2" />
    <Dot cx={9} cy={10} r={0.5} />
    <Dot cx={15} cy={10} r={0.5} />
  </>,
);

export const Video = createIcon(
  'Video',
  <>
    <PatchRect x={2.5} y={6.5} width={13} height={11} rx={3} />
    <rect x={2.5} y={6.5} width={13} height={11} rx={3} />
    <path d="M15.5 10.5l4.4-2.6c.7-.4 1.6.1 1.6.9v6.4c0 .8-.9 1.3-1.6.9l-4.4-2.6" />
  </>,
);

export const CircleDot = createIcon(
  'CircleDot',
  <>
    <PatchCircle cx={12} cy={12} r={8.75} />
    <circle cx={12} cy={12} r={8.75} />
    <Dot cx={12} cy={12} r={2.5} />
  </>,
);

const bookmarkD =
  'M6.5 5.5c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v14.3c0 .62-.7.98-1.2.6L12 17.2l-4.3 3.2c-.5.38-1.2.02-1.2-.6z';
export const Bookmark = createIcon(
  'Bookmark',
  <>
    <Patch d={bookmarkD} />
    <path d={bookmarkD} />
  </>,
);

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

/** Hang up: the handset turned down. */
export const PhoneOff = createIcon(
  'PhoneOff',
  <g transform="rotate(135 12 12)">
    <Patch d={phoneD} />
    <path d={phoneD} />
  </g>,
);

export const MicOff = createIcon(
  'MicOff',
  <>
    <PatchRect x={8.5} y={3} width={7} height={11} rx={3.5} />
    <rect x={8.5} y={3} width={7} height={11} rx={3.5} />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M9 20.75h6" />
    <path d="M4.5 4.5l15 15" />
  </>,
);

export const VideoOff = createIcon(
  'VideoOff',
  <>
    <PatchRect x={2.5} y={6.5} width={13} height={11} rx={3} />
    <rect x={2.5} y={6.5} width={13} height={11} rx={3} />
    <path d="M15.5 10.5l4.4-2.6c.7-.4 1.6.1 1.6.9v6.4c0 .8-.9 1.3-1.6.9l-4.4-2.6" />
    <path d="M3.5 4l15 16" />
  </>,
);
