# CLAIRE Connect — UI redesign brief (authoritative for the redesign)

The owner's verdict on the old UI: "looks AI generated, not legitimate". Hard rules from the owner:
**no standard/default colours, no gradients, no default blue, no sharp corners, no generic icons.**
Also: "very user friendly, should look good, not clumsy, not too much info on the screen".

Reference layouts (structure to follow, NOT their colours — they use default blue and gradients, which are banned):
`docs/ui-refs/1.webp` login · `2.webp` home · `3.webp` results · `4.webp` compare · `5.webp` deal chat · `6.webp` inbox (Tamil).
Open them with the Read tool and study the layout, hierarchy and spacing.

## 1. Palette — "Tiruppur cotton" (tokens already in `web/src/index.css`, use Tailwind classes)
| Role | Class | Hex |
|---|---|---|
| Page (unbleached cotton) | `bg-page` | #F4EFE6 |
| Surface / cards | `bg-surface` | #FFFCF6 |
| Sunken (inputs, chips at rest, skeletons) | `bg-sunken` | #EFE8DC |
| Ink / ink-2 / meta / faint | `text-ink` `text-ink-2` `text-meta` `text-faint` | #1D2622 #3E4843 #6E6A60 #A39D90 |
| Lines | `border-line` / `border-line-strong` | #E3DACB / #CFC4B1 |
| Primary — loom green (actions, active, own bubble ink) | `bg-primary` `hover:bg-primary-hover` `bg-primary-tint` `bg-primary-soft` | #1E5A4C |
| Accent — marigold (Claire AI, highlights, "recommended") | `bg-accent` `bg-accent-tint` `text-accent-ink` | #E9A23B / #FBEFD9 / #8A5A12 |
| Clay — madder (prices to watch, offers, counter-offers, unread badges) | `text-clay` `bg-clay-tint` | #B9502F / #F7E4DB |
| Success / danger / warning | `text-success bg-success-tint` · `text-danger bg-danger-tint` · `text-warning` | |
| Plum (rare: trust breakdown only) | `text-plum bg-plum-tint` | |
| Chat bubbles | own `bg-bubble-own` (pale green) · other `bg-surface border border-line` | |

- **Flat colour only.** No `linear-gradient`, `radial-gradient`, `bg-gradient-*`, glassy blur, or glow shadows.
- No `#fff` white cards (use `bg-surface`), no blue anywhere (no `blue-*`, `sky-*`, `indigo-*` Tailwind colours, no hex blues).
- Depth comes from 1px `border-line` and the page/surface contrast. Shadow only for floating layers (`shadow-[var(--shadow-float)]` on sheets/toasts).
- Text on primary/clay/success = white; text on accent = ink.

## 2. Shape
- Nothing sharp. Cards `rounded-[22px]`, inner panels `rounded-[18px]`, inputs `rounded-[16px]`, chips & buttons `rounded-full`, thumbnails `rounded-[16px]`, avatars round, brand tile `rounded-[30%]`.
- Touch targets ≥ 44px. Primary CTA height 52px.

## 3. Type
- Headings: `font-head` (Bricolage Grotesque, characterful) — screen titles 26–28px/700, section titles 17–18px/650, card titles 16–17px/600.
- Body: Figtree 15px, meta 13px. Tamil/Hindi fall back to Hind Madurai / Hind automatically. Indic strings are 30–60% longer: allow wrapping, never truncate a button label, keep line-height ≥ 1.45.
- Numbers that matter (₹ price, totals): `font-head tabular-nums`, bold, ink (or clay when it is a counter-offer / saving).
- Sentence case everywhere. No ALL CAPS eyebrows except tiny 11px labels with 0.06em tracking where truly useful.

## 4. Icons
- Use ONLY `web/src/icons` (custom duotone set, same names as lucide: `import { Search, Mic } from '../icons'`). **Never import from 'lucide-react'.** When you touch a file, switch its lucide import to `../icons` (or `../../icons`), keep `type LucideIcon` from there too.
- Icons sit in soft tinted circles/rounded squares (e.g. `bg-primary-tint text-primary` 40px) for feature tiles; inline icons 16–20px in `text-meta`.
- Claire is represented by `ClaireMark` (components/Avatar.tsx) — never a robot, never a generic sparkle-in-a-circle.

## 5. Components you must reuse (owned by the integrator — do not edit these files)
`components/Button.tsx` (variants primary/secondary/tint/ghost/danger/success/accent, sizes sm/md/lg, pill-shaped) · `components/Avatar.tsx` (Avatar, ClaireMark, BrandMark, UpdatesMark, DeskMark) · `components/TrustBadge.tsx` · `components/BottomNav.tsx` + `components/AppShell.tsx` (`<AppShell>` gives the page column + bottom nav; `variant="chat"` for full-height chat screens; `ScreenHeader`) · `index.css` tokens · `lib/localStrings.ts`.
If you need something they lack, compose locally in your file and mention it in your report.

## 6. Copy & languages
- Every visible string must exist in en, ta and hi. Do not edit `src/i18n.ts` (shared) — add new strings with `defineStrings('<namespace>', { en, ta, hi })` from `lib/localStrings.ts` in a co-located `*.strings.ts` file, or reuse existing keys via `useT()` / `cards/strings.ts`. Then run `npm run i18n:extract`; te, kn, ml, bn, or, mr, gu are filled in `src/locales/<lang>.json` (see `docs/TRANSLATING.md`).
- Tone: short, warm, plain trade language. "Find suppliers", not "Leverage our AI-powered matching".

## 7. Density — "not clumsy, not too much info"
- One primary action per screen region. Secondary actions as quiet text buttons or a "More" sheet.
- A supplier/result card shows at most: name + trust, price (big), 2 facts (stock, ready-in), up to 2 badges, then actions. Everything else goes to "View details".
- Section spacing 20–24px, card padding 16px, 12px gaps. Generous whitespace beats more data.
- Empty states: one illustration-free line + one action.
- Progressive disclosure: collapse long cards after they are acted on (answered chips, accepted offers, rated orders).

## 8. Layout notes per reference
- **Login (1):** brand row (ClaireMark tile + "CLAIRE Connect" wordmark, language pill top-right), headline "Source, negotiate and buy from trusted suppliers", one-line subtitle, three value props in a single soft row (icon tile + 2-line label), surface card with phone input (+91 prefix) and "Send OTP" primary, "or", a single "Explore as a demo business" row, then the demo account list (avatar, name, role · city, chevron). No robot illustration — the ClaireMark or a simple flat brand motif (e.g. a thread line) instead.
- **Home (2):** "Hi! I'm Claire" (ClaireMark beside it), one-line purpose, big search field "Tell me what you need…" with a mic button inside, three quick actions (Upload product photo · Speak in your language · Use a template), "Try asking like this" (3 example chips that start a Claire chat with that text), "Recent searches" (from the user's requirements, tap re-opens results). Bottom nav Home/Chats/Orders/(Store)/Profile.
- **Results (3):** header with back, requirement title + one-line summary (qty · ≤ budget · days · city), heart/filters optional; segmented tabs Suppliers (n) · Compare · Insights; "Claire's recommendation" note in accent-tint; supplier cards (Recommended ribbon on the top pick, trust pill, garment art thumbnail, ₹ price/pc + "Best price" tag, rating + orders, stock, ready-in, 2 badges, buttons Chat (primary) · Get sample · View details).
- **Compare (4):** two (or three) supplier columns with check toggles, a clean row table (price, total, stock, delivery, trust, rating, on-time, GST, manufacturer) with the winning cell tinted, Claire's recommendation paragraph, primary "Start negotiation with X", secondary "Chat with both suppliers".
- **Deal chat (5):** header (avatar, name, trust pill, "Online · role · city", call + more), collapsible product strip (thumb, title, qty · listed price), bubbles, Claire negotiation tip inline (accent-tint, "Only you can see this"), offer draft card with "Potential savings", counter-offer received card with Accept / Counter, a row of smart reply chips, composer (+, text field, mic/send).
- **Inbox (6):** title "Messages" + unread count pill, search and filter icon buttons, segmented All (n) · Buying (n) · Selling (n), pinned Claire row (accent-tint), conversation rows: avatar, name + trust, time, product thumbnail + "title · qty", one status pill (counter-offer received ₹92 in clay, price confirmed in success, ready to dispatch in primary, negotiating in neutral), unread badge.

## 9. Engineering rules
- React 19 + Vite + Tailwind v4 + zustand + react-router 7. Node 24 via `source ~/.nvm/nvm.sh && nvm use 24`.
- Keep existing behaviour, routes, API calls and Nexconn engine usage working — this is a visual/UX redesign plus the new Home / Results / Compare screens.
- Only edit the files you own (listed in your brief). Do not run git. Do not start or stop the shared dev servers on :5173/:8787.
- Before finishing: `cd web && npx tsc --noEmit -p .` must pass for your files (if `src/icons/index.tsx` is not there yet, wait for it; another agent is drawing it).
