# Android Companion App

Capacitor-based Android shell for Codeplug Studio. Allows operators to carry their library on a phone and program radios over USB-OTG.

## Implementation status

| Area                  | Status    | Notes                                                                                                              |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| Scaffold              | Shipped   | Capacitor core + Android platform (#886)                                                                           |
| API / CORS / Browser  | Shipped   | Absolute `/api` on native, Capacitor CORS allowlist, system browser (#887); staging vs prod API origin (#899)      |
| Google Drive (native) | Shipped   | PKCE OAuth in Custom Tabs + deep link (#895)                                                                       |
| USB Serial            | Shipped\* | `BytePipe` + `@leeskies/capacitor-usb-serial` (#888). \*Unit/mock coverage; **hardware OTG R/W still outstanding** |
| APK CI                | Shipped   | Signed APK + Release attach (#889); real `BUILD_ENV` + GA ID inject (#896)                                         |
| Analytics (gtag)      | Shipped   | Same SPA consent gate; `app_surface=android` + `build_env` on page views (#896)                                    |
| In-app icon / splash  | Shipped   | Brand-derived adaptive icon + splash via `@capacitor/assets` (#898)                                                 |
| Play Store listing    | Drafted   | Graphics + copy staged under [store-assets/](store-assets/README.md); submission itself still #890                 |

## Documentation map

| Doc                                                      | Purpose                        |
| -------------------------------------------------------- | ------------------------------ |
| [android-app-progress.md](android-app-progress.md)       | Execution log for Epic #747    |
| [android-app-outstanding.md](android-app-outstanding.md) | Discovered debt and follow-ups |
| [store-assets/README.md](store-assets/README.md)         | Play Store graphics + listing copy (#898) |

## Concepts

- **Capacitor Shell:** Thin wrapper around the same Vite SPA used in the browser — not a native UI rewrite.
- **USB-OTG:** Radio programming path when Web Serial is unavailable (mobile browsers).
- **Layers:** Capacitor / USB live in `integrations` + `android/`; never in `src/core/` ([layer-boundaries.mdc](../../../.cursor/rules/layer-boundaries.mdc)).

## Native behaviour (#887, #888)

- **USB-Serial Plugin:** `@leeskies/capacitor-usb-serial` (MIT) backed by `mik3y/usb-serial-for-android`. Common chips (CH340, CP2102, FTDI, PL2303, CDC/ACM) listed in `android/app/src/main/res/xml/device_filter.xml`. Root `android/build.gradle` must include JitPack (`maven { url 'https://jitpack.io' }` in `allprojects.repositories`) so Gradle can resolve that transitive dependency.
- **API Proxies:** On Capacitor native, relative `/api/*` (RadioID, RepeaterBook, IRTS) resolve to an absolute origin from `BUILD_ENV` via `resolveApiUrl` (`src/integrations/platform/resolveApiUrl.ts`):

| `BUILD_ENV`                              | Native API origin                     |
| ---------------------------------------- | ------------------------------------- |
| `prod`                                   | `https://codeplug.mm9pdy.net`         |
| `staging`, `main`, `dev`, `local`, other | `https://staging.codeplug.mm9pdy.net` |

Web builds keep same-origin relative `/api/*` (hostname selects the Functions deployment). Pre-release sideload APKs (`BUILD_ENV=staging`) therefore hit staging proxies, not production.

- **CORS:** Pages Functions allowlist includes `capacitor://localhost` and `http://localhost` (mirrored `Access-Control-Allow-Origin` — **not** `*`). See `functions/lib/codeplugOrigin.ts`.
- **External Links:** Anchors with `target="_blank"` and http(s) hrefs open via `@capacitor/browser` (Chrome Custom Tabs).
- **Combobox dropdowns:** Mantine `Select` / `Autocomplete` / `MultiSelect` use theme `hideDetached: false` so opening a control near the bottom of a scrollable page (e.g. Settings → Grid overlay) does not scroll the trigger off-screen ([#902](https://github.com/pskillen/codeplug-studio/issues/902)).
- **Google Drive:** PKCE OAuth in Chrome Custom Tabs with redirect `net.mm9pdy.codeplugstudio:/oauth2redirect`. Requires Android OAuth client + `VITE_GOOGLE_ANDROID_CLIENT_ID` in APK builds. See [google-drive](../import-export/google-drive.md).

## Sideload APK (#889)

### CI packaging

Reusable [`.github/workflows/android-release.yaml`](../../../.github/workflows/android-release.yaml), called from the same deploy wrappers as Pages:

| Caller                                                    | Trigger                   | `BUILD_ENV` | Output                       |
| --------------------------------------------------------- | ------------------------- | ----------- | ---------------------------- |
| [`dev.yaml`](../../../.github/workflows/dev.yaml)         | Push to `dev`             | `dev`       | Workflow artifact            |
| [`main.yaml`](../../../.github/workflows/main.yaml)       | Push to `main`            | `main`      | Workflow artifact            |
| [`staging.yaml`](../../../.github/workflows/staging.yaml) | Pre-release               | `staging`   | Artifact + **Release asset** |
| [`prod.yaml`](../../../.github/workflows/prod.yaml)       | Full release (`released`) | `prod`      | Artifact + **Release asset** |

GA secrets follow Pages (`prod` → `GA_MEASUREMENT_ID`; otherwise `GA_MEASUREMENT_ID_PREPROD`). Native API origin follows the same `BUILD_ENV` split (see table above). Version comes from the release tag when provided, else short git SHA; `ANDROID_VERSION_CODE` from `github.run_number`.

**GitHub Actions secrets (required for a signed APK):**

| Secret                           | Meaning                                         |
| -------------------------------- | ----------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`        | Base64-encoded PKCS12/JKS release keystore      |
| `ANDROID_KEYSTORE_PASSWORD`      | Keystore password                               |
| `ANDROID_KEY_ALIAS`              | Key alias                                       |
| `GA_MEASUREMENT_ID`              | Prod stream (when `BUILD_ENV=prod`)             |
| `GA_MEASUREMENT_ID_PREPROD`      | Pre-prod stream (`staging` / `main` / `dev`)    |
| `ANDROID_GOOGLE_OAUTH_CLIENT_ID` | Android OAuth client id for Drive on APK builds |

Without secrets, Gradle still builds; the APK will not be release-signed.

Note: PKCS12 keystores don't support a key password distinct from the store
password — `keytool` silently ignores a different `-keypass` at generation
time and encrypts the key with the store password instead. `build.gradle`
reuses `ANDROID_KEYSTORE_PASSWORD` as the key password, so there is no
separate `ANDROID_KEY_PASSWORD` secret.

Local optional signing: `android/keystore.properties` (gitignored).

**Local / CI JDK:** Capacitor Android 8 compiles with **Java 21** (`sourceCompatibility`/`targetCompatibility` 21). Use Temurin/Homebrew JDK 21+ for `./gradlew assembleRelease` (CI `android-release.yaml` sets `java-version: '21'`).

### Operator sideload (MVP)

1. Open the [Releases](https://github.com/pskillen/codeplug-studio/releases) page for a published (or pre-) release that ran the Android workflow.
2. Under **Assets**, download `codeplug-studio-<version>.apk`.
3. Install on the device (enable install from that source if prompted).
4. Confirm the in-app footer shows the mapped env (e.g. `prod · <version>` or `staging · <version>`), not `apk`.

For CI test builds on `dev`, download the APK from the workflow run’s **Artifacts** instead (artifacts expire; not shown on Releases). Consent-gated analytics uses the same banner as web; page views carry `app_surface=android`. See [analytics](../analytics/README.md).

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

## Privacy & legal

The APK embeds the same SPA legal routes used on the website. Play Console and operators should use the hosted URLs:

| Page    | In-app route | Hosted URL                          |
| ------- | ------------ | ----------------------------------- |
| Privacy | `/privacy`   | https://codeplug.mm9pdy.net/privacy |
| Terms   | `/terms`     | https://codeplug.mm9pdy.net/terms   |
| Cookies | `/cookies`   | https://codeplug.mm9pdy.net/cookies |

Copy covers the Android companion, USB-OTG radio programming (bytes stay on-cable), and the rule that operator data does not leave the device unless the operator starts an action (Drive, remote directories, consented analytics). See [#897](https://github.com/pskillen/codeplug-studio/issues/897). Play Data safety form fill-out remains [#890](https://github.com/pskillen/codeplug-studio/issues/890); narrowing the shared Drive OAuth scope to `drive.file` ([#909](https://github.com/pskillen/codeplug-studio/issues/909)) keeps that declaration to a non-sensitive scope rather than a restricted one.

## Cross-links

- Epic [#747](https://github.com/pskillen/codeplug-studio/issues/747)
- Tickets [#886](https://github.com/pskillen/codeplug-studio/issues/886)–[#890](https://github.com/pskillen/codeplug-studio/issues/890), legal copy [#897](https://github.com/pskillen/codeplug-studio/issues/897)
- Radio I/O hub: [radio-read-write/README.md](../radio-read-write/README.md)
- Analytics / consent: [analytics/README.md](../analytics/README.md)
- Deploy / SPA matrix: [docs/build/README.md](../../build/README.md)
