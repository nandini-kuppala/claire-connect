# Translator guide: CLAIRE Connect screens in te, kn, ml, bn, or, mr, gu

You are translating a B2B trade chat app for the Tiruppur knitwear supply chain. The people reading it are
**buyers (wholesalers, shop owners) and small unit owners (stitching units, knitting mills, printers)**, often
on a phone, often reading in a second language. Write the way a friendly trade partner talks, not the way a
government form reads.

English, Tamil and Hindi are already done (inline in the code). Your job is one JSON file per language on
the web side and one on the server side.

---

## 1. Files

| Language | Code | Web (every screen) | Server (Claire's replies, deal notices) |
|---|---|---|---|
| Telugu | `te` | `web/src/locales/te.json` | `server/src/locales/te.json` |
| Kannada | `kn` | `web/src/locales/kn.json` | `server/src/locales/kn.json` |
| Malayalam | `ml` | `web/src/locales/ml.json` | `server/src/locales/ml.json` |
| Bengali | `bn` | `web/src/locales/bn.json` | `server/src/locales/bn.json` |
| Odia | `or` | `web/src/locales/or.json` | `server/src/locales/or.json` |
| Marathi | `mr` | `web/src/locales/mr.json` | `server/src/locales/mr.json` |
| Gujarati | `gu` | `web/src/locales/gu.json` | `server/src/locales/gu.json` |

**Source text:** `web/src/locales/en.json` and `server/src/locales/en.json`. These are generated from the code
(`npm run i18n:extract`). **Never edit `en.json`.** If an English string is wrong, fix it in the source file
listed in section 3 and re-run the extract.

Useful reference while translating: the Tamil and Hindi versions of the same key sit next to the English in the
source file (section 3). They show how short the existing translations are and which words stay in English.

## 2. JSON shape

Exactly the same namespaces and keys as `en.json`, with your text as the value:

```json
{
  "app": {
    "nav_home": "హోమ్",
    "send": "పంపండి",
    "translated_from": "{lang} నుంచి అనువాదం"
  },
  "cards": {
    "moq": "MOQ {n}",
    "in_stock": "{n} స్టాక్‌లో ఉన్నాయి"
  }
}
```

- UTF-8, native script only (Telugu script for `te`, Kannada script for `kn`, Malayalam for `ml`, Bengali for
  `bn`, Odia for `or`, Devanagari for `mr`, Gujarati for `gu`). No romanised text.
- Keep the namespace and key names exactly as in `en.json`. Do not add new keys.
- Key order does not matter, but keeping the `en.json` order makes review easier.
- A key you leave out shows English on screen (never a blank), so partial files are safe to ship.
- Do not put an empty string `""`: leave the key out instead.
- Valid JSON: double quotes, escape `"` inside text as `\"`, no trailing commas, no comments.

## 3. Namespaces (what each one is)

### Web (`web/src/locales/<lang>.json`)

| Namespace | Keys | Where it appears | Source file (en + ta + hi inline) |
|---|---|---|---|
| `app` | 255 | Shared app copy: bottom nav, inbox, chat, Claire, onboarding, profile, business roles (`role_*`), errors | `web/src/i18n.ts` |
| `cards` | 160 | Labels inside chat cards: results, offers, orders, ratings, samples, statuses (`s_*`, `st_*`), trust badges (`badge_*`) | `web/src/cards/strings.ts` |
| `home` | 49 | Home screen: greeting, search, quick actions, example requests | `web/src/screens/Home.strings.ts` |
| `results` | 99 | Supplier results, Compare, Claire's recommendation, filters | `web/src/screens/results.strings.ts` |
| `deal` | 61 | Deal chat: product strip, offer draft, counter-offers, smart replies | `web/src/chat/deal.strings.ts` |
| `inbox` | 45 | Messages list: tabs, status pills, search | `web/src/screens/Inbox.strings.ts` |
| `storefront` | 63 | A seller's public shop page and product details | `web/src/screens/Storefront.strings.ts` |
| `me` | 46 | Profile screen | `web/src/screens/Me.strings.ts` |
| `catalog` | 43 | Add products from photos (catalogue sheet) | `web/src/components/CatalogSheet.strings.ts` |
| `orders` | 25 | Orders screen | `web/src/screens/Orders.strings.ts` |
| `login` | 18 | Sign-in screen | `web/src/screens/Login.strings.ts` |
| `onboarding` | 11 | Voice onboarding extras | `web/src/screens/Onboarding.strings.ts` |
| `claire` | 9 | Claire chat screen | `web/src/screens/ClaireScreen.strings.ts` |
| `updates` | 4 | CLAIRE Updates channel | `web/src/screens/UpdatesScreen.strings.ts` |
| `trust` | 2 | Trust pill | `web/src/components/TrustBadge.tsx` |
| `language` | 1 | Language screen | `web/src/screens/Language.strings.ts` |
| `taxonomy` | 15 | Product category names, key = category id (`garment.tshirt` → "T-shirts") | `shared/taxonomy.ts` |

### Server (`server/src/locales/<lang>.json`)

| Namespace | Keys | Where it appears | Source file |
|---|---|---|---|
| `claire` | 47 | Claire's questions and replies in the assistant chat, onboarding questions, catalogue notice | `server/src/i18n.ts` (`en`) |
| `units` | 6 | Unit words in Claire's sentences: `piece_one` / `piece_other`, `kg_*`, `dozen_*` | `server/src/i18n.ts` (`unitWord`) |
| `deals` | 40 | Deal-room notices, Claire's private tips, offer / order / rating texts, auto-reply labels | `server/src/deals.ts` (`P.en`) |
| `deal_units` | 4 | Short units in deal notices (`pcs`, `kg`, `dozen`) and `bundles` (dispatch) | `server/src/deals.ts` (`UNIT`, `BUNDLES`) |
| `reasons` | 8 | "Claire's recommendation" sentence on the results screen | `server/src/routes/requirements.ts` (`REASON`) |
| `desk` | 3 | Trade Desk ticket messages sent to the trader | `server/src/desk.ts` (`REQ_TEXT`) |
| `taxonomy` | 15 | Category names inside Claire's replies (same text as the web `taxonomy`) | `shared/taxonomy.ts` |

Keep the web and server `taxonomy` values identical for a language.

## 4. Placeholders

Text in braces, such as `{name}`, `{price}`, `{n}`, `{qty}`, `{unit}`, `{days}`, `{city}`, `{lang}`, `{total}`,
`{code}`, is replaced by the app at run time.

- Copy every placeholder **exactly**: same name, same braces, Latin letters. Never translate or transliterate
  the name inside the braces (`{price}`, not `{ధర}`).
- The set must be identical to English: do not drop one, do not add one, do not repeat one that English uses once.
- Move it anywhere the grammar needs: `"Listen in {lang}"` → `"{lang}లో వినండి"`.
- Placeholders already carry their own formatting: `{price}` arrives as `₹180`, `{n}` as `1,200`. Do not add
  `₹` or units around them unless English has them (English `"{price}/pc"` keeps its `/pc` slot; translate `pc`).
- Leading or trailing spaces and punctuation are part of the string when English has them. Keep them:
  - `results.and`, `reasons.and` = `" and "` (spaces on both sides), used to join names: "A and B".
  - `deals.lead_market`, `deals.lead_market_only`, `deals.combo_budget` start with a space because they are
    appended to another sentence.
- `{n}` with plurals: these languages generally do not need a separate plural form here; write a form that
  reads correctly for both 1 and many.

## 5. What stays untranslated

Keep these exactly as written, in Latin script:

- **Brand and names:** `CLAIRE`, `Claire` (the assistant; do not transliterate), `CLAIRE Connect`, `CLAIRE Updates`,
  `CLAIRE Trade Desk`, `Nexconn`. Business and person names in examples (Amit Hosiery, Lakshmi Garments …).
- **Trade terms traders use in English:** `GST`, `OTP`, `MOQ`, `GSM`, `LR` (lorry receipt), `UPI`, `PDF`, `SMS`,
  `WhatsApp`. Words such as "job work", "sample", "order", "stock" may be written the way traders say them in
  your language (often the English word in native script is the most natural, e.g. ఆర్డర్); pick what a
  Tiruppur buyer in that state would say.
- **Numbers and money:** every digit stays a Western digit (`1,200`, not Bengali/Devanagari/Gujarati digits).
  `₹` amounts unchanged (`₹180`, `₹1,20,000`). Percentages as `92%`.
- **Size codes:** `XS S M L XL XXL 3XL`, size sets like `M–XXL`, fabric specs like `180 GSM`, `30s combed`.
- **Phone numbers and codes:** `+91`, demo numbers `9000000001` … `9000000903`, OTP `123456`, ticket and order
  codes.
- **Emoji and symbols:** `♥`, `·`, `…`, `→`, `–` stay where English puts them.

## 6. Tone and length

- **Warm, short, plain trade language.** "Find suppliers", not "Discover our supplier network". Talk to the
  user as "you" in the polite-but-friendly register a trader uses with a regular customer (Telugu `మీరు`,
  Kannada `ನೀವು`, Malayalam `നിങ്ങൾ`, Bengali `আপনি`, Odia `ଆପଣ`, Marathi `तुम्ही`, Gujarati `તમે`).
- Everyday words over Sanskritised or official ones (what a shop owner says, not what a ministry writes).
- Claire is a helpful assistant, female voice in Hindi/Tamil copy. Keep her friendly and brief.
- **Buttons, tabs, chips, nav labels** (`nav_*`, `filter_*`, `accept`, `counter`, `send`, `chat`, `sample` …):
  one or two words. They sit in narrow pills on a 375 px phone; Indic text runs 30–60% longer than English.
- Sentence case. No ALL CAPS. No exclamation marks that English does not have.
- Keep the meaning of trade actions precise: *offer* (a price proposal), *counter-offer* (a reply with a
  different price), *advance* (part payment before production), *balance* (rest of the payment), *dispatch*
  (goods sent with transporter + LR), *job work* (stitching/printing done on the buyer's material).
- When unsure, look at the Hindi (for `mr`, `gu`, `bn`, `or`) or Tamil (for `te`, `kn`, `ml`) of the same key in
  the source file: same length, same register.

## 7. Check your work

From the repo root (Node 24: `source ~/.nvm/nvm.sh && nvm use 24`):

```bash
npm run i18n:check -- te            # one language, web + server
npm run i18n:check -- te --web      # only web (or --server)
npm run i18n:check -- te --list     # every problem, not just the first 15 per kind
npm run i18n:check -- all           # all seven, with a % summary table
```

It reports, per language and side:

| Kind | Meaning | Fix |
|---|---|---|
| `missing` | key in `en.json` not in your file | translate it |
| `extra` | namespace or key not in `en.json` | typo in the key, or removed from the source: delete it |
| `placeholder` | `{…}` set differs from English | copy the placeholders exactly |
| `empty` | `""` or spaces only | translate it or remove the key |
| `same` | identical to English and more than 3 words | probably forgotten; translate it |
| `type` | value is not a string | use a plain string |

It also fails if `en.json` is out of date with the code (run `npm run i18n:extract`). Exit code 0 means the
language is complete and clean. Finish with `npm run typecheck` and `npm run build`.

## 8. Seeing it in the app

- Sign-in screen: pick the language on the pill (top right). Signed in: Profile → Language.
- Web language files load on demand, so a change shows after a page reload in dev (`npm run dev`).
- Server files are read when the server starts: restart it after editing `server/src/locales/*.json`.
  Claire's replies, deal notices and the results recommendation then come in the new language.
- Untranslated keys show English; that is expected while a file is partial.

## 9. How it works (for developers)

Lookup for every string: inline table for the language (en / ta / hi in the source files) → overlay JSON for the
language → inline English → the key itself.

- Web: `web/src/locales/index.ts` exposes `localeString(lang, ns, key)`, `ensureLocale(lang)` and
  `useLocaleVersion(lang)`. `translate()` / `useT()` (`app`), `strings()` (`cards`), `defineStrings(namespace, …)`
  and `catName()` (`taxonomy`, via `categoryName()` in `shared/taxonomy.ts`) all consult it.
- Server: `server/src/locales/index.ts` exposes `serverLocale(lang, ns, key)`, used by `t()` and `unitWord()`
  (`server/src/i18n.ts`), `tr()` / `unitOf()` (`server/src/deals.ts`), the recommendation reasons
  (`server/src/routes/requirements.ts`), `rt()` (`server/src/desk.ts`) and category names.
- `scripts/i18n-lib.mjs` lists where the English tables live; `scripts/i18n-extract.mjs` writes both `en.json`
  files from them; `scripts/i18n-check.mjs` validates the overlays.
