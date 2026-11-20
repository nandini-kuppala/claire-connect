# CLAIRE Connect: Flutter app (Android + iOS)

The phone app for CLAIRE Connect, a B2B knitwear trade chat for Tiruppur. It is built on the official
**Nexconn Flutter Chat SDK** (`ai_nexconn_chat_plugin` 26.2.11). It uses the same server as the web app
(`server/`, deployed at https://claire-connect.onrender.com), with the same REST API and the same Nexconn
custom messages (`CC:Card`, `CC:Hint`, `CC:Reply`, `CC:Voice`).

## Run

```bash
cd mobile
flutter pub get
flutter run                                                    # deployed server (default API_BASE)
flutter run --dart-define=API_BASE=https://claire-connect.onrender.com
flutter run --dart-define=API_BASE=http://10.0.2.2:8787        # local server, from the Android emulator
flutter run --dart-define=API_BASE=http://localhost:8787       # local server, from the iOS simulator
```

Demo accounts (OTP `123456`): buyer Amit `9000000001`; sellers Lakshmi `9000000002`, Sree `9000000003`
and Ravi `9000000004`. Or tap **Explore as a demo business** on the sign-in screen. The production
database is shared, so create only demo data.

## Build

```bash
flutter build apk --debug --target-platform android-arm64   # arm64 only: smaller, enough for emulators and phones
flutter build apk --release                                  # signed with debug keys (see android/app/build.gradle.kts)
flutter build ios --simulator --no-codesign
flutter build ios --release --no-codesign                    # then sign in Xcode
```

Build machine notes:

- **Android.** Flutter 3.50 needs AGP 9.1.1 or later. `settings.gradle.kts` pins AGP 9.1.1 with the
  Gradle 9.3.1 wrapper, which were already cached on our build machine. Flutter prints a warning and
  suggests AGP 9.3.1 with Gradle 9.5; both combinations work. The app uses the installed
  NDK 27.1.12297006. The root `build.gradle.kts` forces plugin modules onto the same NDK, because the
  `jni` plugin otherwise pins NDK 28.2 and AGP would download it (about 2 GB). The first build downloads
  about 2 GB of Gradle dependencies, and build output grows to about 1.5 GB. Allow at least 4 GB free.
- **iOS.** `rongcloud_im_wrapper_plugin`, which sits under the Nexconn plugin, has no arm64 simulator
  slice and no Swift Package Manager support, so the simulator build runs under Rosetta (x86_64). Device
  builds are unaffected. Run `pod install` with a UTF-8 locale:
  `cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`. The deployment target is iOS 15.0.

## Where the Nexconn Flutter SDK is used

All SDK calls are in `lib/chat/chat_engine.dart`. Everything else talks to that wrapper.

| What | SDK API |
| --- | --- |
| Initialise | `NCEngine.initialize(InitParams(appKey, areaCode))`. The App Key and area come from `GET /api/me` → `chat: {mode, appKey, area, token}` |
| Custom messages | `NCEngine.registerCustomMessage` for `CC:Card`, `CC:Reply`, `CC:Voice` (counted) and `CC:Hint` (persisted), before connecting |
| Connect | `NCEngine.connect(ConnectParams(token))` with the per-user token from `/api/auth/verify` or `/api/me`, plus `addConnectionStatusHandler` |
| Receive | `NCEngine.addMessageHandler(MessageHandler(onMessageReceived, stream deltas))` |
| Send | `BaseChannel.sendMessage(SendMessageParams(TextMessageParams / CustomMessageParams))` |
| Channels | Claire = `DirectChannel('claire')`; deals = `GroupChannel(channelId)`; CLAIRE Updates = `SystemChannel('claire_updates')` |
| History | `BaseChannel.createMessagesQuery` (page size 20; the SDK rejects larger pages with -101) |
| Inbox unread and previews | `BaseChannel.createChannelsQuery` |
| Typing | `NCEngine.addChannelHandler` (`onTypingStatusChanged`) to receive; `DirectChannel.sendTypingStatus` to send |
| Read state | `clearUnreadCount` and `sendReadReceiptResponse` |
| Translation | `NCEngine.translate.setTranslationLanguage`. Deal messages are translated server-first through `POST /api/translate`, as on the web |

The app never holds the Nexconn App Secret or any server key. After each send it notifies the server
(`/api/claire/turn`, `/api/deals/:id/inbound`, `/api/deals/:id/chip`), exactly as the web app does.

## Languages

There are 10 UI languages in `assets/i18n/<code>.json`: en, ta, hi, te, kn, ml, bn, or, mr and gu.
Strings are flattened to dotted keys and fall back to English. `{placeholders}`, ₹ amounts, numbers,
CLAIRE/Claire/Nexconn/GST/OTP/GSM and size codes stay untranslated. `test/i18n_locales_test.dart` checks
that every file has every key, the same placeholders, and no leftover English. Trust badges arrive from
the server in English and are mapped to `badge.*` keys (`badgeKey` in `lib/cards/format.dart`).

Indic text uses the platform fonts: Noto on Android, Sangam/Kohinoor on iOS. They are listed in
`AppFonts`' fallback chain, so no font files are bundled. Latin text uses Figtree and Bricolage
Grotesque through `google_fonts`.

## Layout

```
lib/
  api/        HTTP client (API_BASE) and lenient JSON helpers
  session/    token, user, business, chat credentials (shared_preferences)
  chat/       Nexconn engine wrapper, per-channel controller, translator (/api/translate)
  i18n/       asset string tables, English fallback, {placeholder} filling, language list
  theme/      design tokens (white base, teal #1F8C73, brand #3DB394, navy #13203B)
  cards/      typed card payloads and formatting
  widgets/    brand marks, shared UI, chat view, cards
  screens/    login, language, onboarding, shell, home, Claire, results, inbox, deal, orders, profile, updates
```

## Checks

```bash
flutter analyze
flutter test                                                          # offline unit and widget tests
flutter test integration_test/live_smoke_test.dart -d <simulator>     # live: login → Nexconn connect → screens
flutter test test_render/screens_render_test.dart --update-goldens    # live, offscreen screenshots
```

`test_render/` signs in as Amit and renders the real screens offscreen for all 10 languages. It writes
PNGs to `screenshots/render/`. It uses macOS system fonts for Indic scripts and a read-only HTTP client:
nothing is written to the shared demo account, and the language switch stays on the device. Native
Nexconn calls are not available in that run, so the chat cards are drawn from sample payloads.

## Known limitations

- Voice notes are not recorded in the app. A `CC:Voice` message shows its transcript only.
- Not ported from the web app: rating, sample request and support sheets, the storefront and compare
  screens, voice onboarding and the Trade Desk console.
- Claire's replies, listing titles and the results recommendation note come from the server, in the
  server's language and wording.
- There is no custom app icon yet.
- Live sends (text, chip taps, Accept/Counter on offers, order actions) have not been driven end to end
  on a device yet. The live smoke test covers sign-in, connect, history and navigation only.
