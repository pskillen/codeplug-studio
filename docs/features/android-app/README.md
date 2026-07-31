# Android Companion App

Capacitor-based Android shell for Codeplug Studio. Allows operators to carry their library on a phone and program radios over USB-OTG.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Scaffold | Shipped | Capacitor core + Android platform (#886) |
| API / CORS / Browser | Shipped | Absolute `/api` on native, Capacitor CORS allowlist, system browser, Drive gated (#887) |
| USB Serial | Shipped\* | `BytePipe` + `@leeskies/capacitor-usb-serial` (#888). \*Unit/mock coverage; **hardware OTG R/W still outstanding** |
| APK CI | In progress | Signed APK workflow + Release attach on `release` events (#889) — land via PR to `main` |
| Play Store | Deferred | AAB + listing + Closed Testing (#890) |

## Documentation map

| Doc | Purpose |
| --- | --- |
| [android-app-progress.md](android-app-progress.md) | Execution log for Epic #747 |
| [android-app-outstanding.md](android-app-outstanding.md) | Discovered debt and follow-ups |

## Concepts

- **Capacitor Shell:** Thin wrapper around the same Vite SPA used in the browser — not a native UI rewrite.
- **USB-OTG:** Radio programming path when Web Serial is unavailable (mobile browsers).
- **Layers:** Capacitor / USB live in `integrations` + `android/`; never in `src/core/` ([layer-boundaries.mdc](../../../.cursor/rules/layer-boundaries.mdc)).

## Native behaviour (#887, #888)

- **USB-Serial Plugin:** `@leeskies/capacitor-usb-serial` (MIT) backed by `mik3y/usb-serial-for-android`. Common chips (CH340, CP2102, FTDI, PL2303, CDC/ACM) listed in `android/app/src/main/res/xml/device_filter.xml`. Root `android/build.gradle` must include JitPack (`maven { url 'https://jitpack.io' }` in `allprojects.repositories`) so Gradle can resolve that transitive dependency.
- **API Proxies:** On Capacitor native, relative `/api/*` (RadioID, RepeaterBook, IRTS) resolve to `https://codeplug.mm9pdy.net`.
- **CORS:** Pages Functions allowlist includes `capacitor://localhost` and `http://localhost` (mirrored `Access-Control-Allow-Origin` — **not** `*`). See `functions/lib/codeplugOrigin.ts`.
- **External Links:** Anchors with `target="_blank"` and http(s) hrefs open via `@capacitor/browser` (Chrome Custom Tabs).
- **Google Drive:** Gated on native — use local YAML import/export on Android for now.

## Sideload APK (#889)

### CI packaging

[`.github/workflows/android-release.yml`](../../../.github/workflows/android-release.yml):

| Trigger | Output |
| --- | --- |
| `release` published / prereleased | Signed APK attached to that **GitHub Release** + workflow artifact |
| Push to `dev` / `workflow_dispatch` | Workflow **artifact** only (for CI testing) |

Build injects `BUILD_ENV=apk`, `BUILD_VERSION` / `ANDROID_VERSION_NAME` from the tag (leading `v` stripped), and `ANDROID_VERSION_CODE` from `github.run_number`.

**GitHub Actions secrets (required for a signed APK):**

| Secret | Meaning |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded PKCS12/JKS release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |

Without secrets, Gradle still builds; the APK will not be release-signed.

Note: PKCS12 keystores don't support a key password distinct from the store
password — `keytool` silently ignores a different `-keypass` at generation
time and encrypts the key with the store password instead. `build.gradle`
reuses `ANDROID_KEYSTORE_PASSWORD` as the key password, so there is no
separate `ANDROID_KEY_PASSWORD` secret.

Local optional signing: `android/keystore.properties` (gitignored).

**Local / CI JDK:** Capacitor Android 8 compiles with **Java 21** (`sourceCompatibility`/`targetCompatibility` 21). Use Temurin/Homebrew JDK 21+ for `./gradlew assembleRelease` (CI `android-release.yml` sets `java-version: '21'`).

### Operator sideload (MVP)

1. Open the [Releases](https://github.com/pskillen/codeplug-studio/releases) page for a published (or pre-) release that ran the Android workflow.
2. Under **Assets**, download `codeplug-studio-<version>.apk`.
3. Install on the device (enable install from that source if prompted).
4. Confirm the in-app footer shows `apk · <version>`.

For CI test builds on `dev`, download the APK from the workflow run’s **Artifacts** instead (artifacts expire; not shown on Releases).

Play Store distribution is [#890](https://github.com/pskillen/codeplug-studio/issues/890).

## Contributor guide

### Prerequisites

- Android Studio (recent stable)
- JDK 17
- Android SDK (API 34+)

### Local loop

1. `npm run sync:android` — Vite build + `cap sync android`
2. `npm run open:android` — open in Android Studio
3. Run on emulator or device

Note: `npm ci` uses `.npmrc` `legacy-peer-deps=true` so Capacitor 8 can install alongside the USB-serial plugin’s peer range.

## Cross-links

- Epic [#747](https://github.com/pskillen/codeplug-studio/issues/747)
- Tickets [#886](https://github.com/pskillen/codeplug-studio/issues/886)–[#890](https://github.com/pskillen/codeplug-studio/issues/890)
- Radio I/O hub: [radio-read-write/README.md](../radio-read-write/README.md)
- Deploy / SPA matrix: [docs/build/README.md](../../build/README.md)
