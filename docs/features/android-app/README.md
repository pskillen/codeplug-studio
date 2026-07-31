# Android Companion App

Capacitor-based Android shell for Codeplug Studio. Allows operators to carry their library on a phone and program radios over USB-OTG.

## Implementation status

| Area       | Status   | Notes                                                                                                                          |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Scaffold   | Complete | Capacitor core + Android platform (#886)                                                                                       |
| API Proxy  | Complete | Absolute URL routing, CORS allowlist for Capacitor origins, system browser external navigation, and Google Drive gating (#887) |
| USB Serial | Complete | BytePipe implemented with `@leeskies/capacitor-usb-serial` for Android USB-OTG radio I/O (#888)                                |
| APK CI     | Complete | GitHub Actions signed release APK workflow and release asset publishing (#889)                                                 |

## Documentation map

| Doc                                                      | Purpose                        |
| -------------------------------------------------------- | ------------------------------ |
| [android-app-progress.md](android-app-progress.md)       | Execution log for Epic #747    |
| [android-app-outstanding.md](android-app-outstanding.md) | Discovered debt and follow-ups |

## Concepts

- **Capacitor Shell:** The app is a thin wrapper around the same Vite SPA used in the browser.
- **USB-OTG:** Used for radio programming since Web Serial is unavailable in mobile browsers.

## Native Behaviour (#887, #888)

- **USB-Serial Plugin:** `@leeskies/capacitor-usb-serial` (MIT license, v0.1.0) backed by `mik3y/usb-serial-for-android`. Supports CH340, CP2102, FTDI, PL2303, and CDC/ACM chips over USB-OTG.
- **API Proxies:** On Capacitor native shells, relative `/api/*` requests (RadioID, RepeaterBook, IRTS) automatically route to `https://codeplug.mm9pdy.net`.
- **CORS Allowlist:** Cloudflare Pages Functions allow `capacitor://localhost` and `http://localhost` origins.
- **External Links:** All external links (`target="_blank"` or external HTTP/HTTPS hrefs) open via `@capacitor/browser` in system Chrome Custom Tabs rather than inside the webview.
- **Google Drive:** Explicitly gated on native with user guidance to use local YAML import/export.

## Sideload APK via GitHub Releases (#889)

### Release Packaging & CI

The GitHub Actions workflow [`.github/workflows/android-release.yml`](../../.github/workflows/android-release.yml) automatically builds a signed `app-release.apk` whenever a GitHub Release (published or pre-released) is created, on pushes to `dev`, or via `workflow_dispatch`. Built APKs are uploaded as workflow artifacts via `actions/upload-artifact@v4`.

- **Build Environment:** Android APK builds inject `BUILD_ENV=apk` and strip any leading `v` from tag versioning (`BUILD_VERSION=x.y.z`).
- **Release Signing Secrets:** CI release signing requires four GitHub Actions repository secrets:
  - `ANDROID_KEYSTORE_BASE64`: Base64-encoded JKS/PKCS12 release keystore file.
  - `ANDROID_KEYSTORE_PASSWORD`: Keystore password.
  - `ANDROID_KEY_ALIAS`: Key alias name.
  - `ANDROID_KEY_PASSWORD`: Key alias password.
- **Local Unsigned / Debug Fallback:** `android/app/build.gradle` reads signing properties conditionally from environment variables (`ANDROID_KEYSTORE_FILE` / `ANDROID_KEYSTORE_PATH`), project properties, or local `keystore.properties` (gitignored). When signing secrets are not present, Gradle builds unsigned release / debug APKs so local development and pull-request builds remain fully functional without secret dependencies.

### Operator Sideload Instructions

1. Navigate to the latest release on GitHub ([Codeplug Studio Releases](https://github.com/pskillen/codeplug-studio/releases)).
2. Under **Assets**, download `app-release.apk`.
3. Open `app-release.apk` on your Android device (API 34+ recommended).
4. If prompted, enable **"Install unknown apps"** / **"Install from unknown sources"** for your browser or file manager.
5. Launch Codeplug Studio. Verify the version footer displays `Codeplug Studio · apk · <version>`.

_Note:_ Sideloaded APK distribution is the MVP packaging path. Google Play Store distribution (AAB packaging, store listing, and Data Safety declarations) is tracked separately in [#890](https://github.com/pskillen/codeplug-studio/issues/890).

## Contributor Guide

### Prerequisites

- **Android Studio** (Koala or newer recommended)
- **JDK 17**
- **Android SDK** (API level 34+)

### Local Development Loop

1. Run `npm run sync:android`. This builds the SPA and syncs assets to the Android project.
2. Open Android Studio: `npm run open:android` (or open the `android/` folder manually).
3. Select a device/emulator and click **Run**.

Note: USB serial functionality connects via `@leeskies/capacitor-usb-serial` on Android native shells (#888). API proxies route to `https://codeplug.mm9pdy.net` on native shells.

## Cross-links

- **Epic:** [codeplug-studio#747](https://github.com/pskillen/codeplug-studio/issues/747)
- **Current Phase:** [codeplug-studio#889](https://github.com/pskillen/codeplug-studio/issues/889) (Next: Play Store #890)
- **Radio I/O Hub:** [radio-read-write/README.md](../radio-read-write/README.md)
