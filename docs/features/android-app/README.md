# Android Companion App

Capacitor-based Android shell for Codeplug Studio. Allows operators to carry their library on a phone and program radios over USB-OTG.

## Implementation status

| Area                  | Status    | Notes                                                                                                                                                                                                                           |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold              | Shipped   | Capacitor core + Android platform (#886)                                                                                                                                                                                        |
| API / CORS / Browser  | Shipped   | Absolute `/api` on native, Capacitor CORS allowlist, system browser (#887); staging vs prod API origin (#899)                                                                                                                   |
| Google Drive (native) | Shipped   | PKCE OAuth in Custom Tabs + deep link (#895)                                                                                                                                                                                    |
| USB Serial            | Shipped\* | `BytePipe` + `@leeskies/capacitor-usb-serial` (#888); line rate set at open. \*Unit/mock coverage; **hardware OTG R/W still outstanding**                                                                                       |
| APK CI                | Shipped   | Signed APK + Release attach (#889); real `BUILD_ENV` + GA ID inject (#896)                                                                                                                                                      |
| Analytics (gtag)      | Shipped   | Same SPA consent gate; `app_surface=android` + `build_env` on page views (#896)                                                                                                                                                 |
| In-app icon / splash  | Shipped   | Brand-derived adaptive icon + splash via `@capacitor/assets` (#898)                                                                                                                                                             |
| Play Store listing    | Drafted   | Graphics + copy staged under [store-assets/](store-assets/README.md); submission itself still #890                                                                                                                              |
| AAB / Play publish CI | Shipped\* | Tag-derived `versionCode`, preflight, ensure-on-track (#1206). Staging → Open testing (`beta`); prod → Production. \*Live verify needs Open testing set up in Play Console — see [play-store-publish.md](play-store-publish.md) |

## Documentation map

| Doc                                              | Purpose                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| [store-assets/README.md](store-assets/README.md) | Play Store graphics + listing copy (#898)                |
| [play-store-publish.md](play-store-publish.md)   | AAB build + Open testing / Production publish CI (#1206) |

## Concepts

- **Capacitor Shell:** Thin wrapper around the same Vite SPA used in the browser — not a native UI rewrite.
- **USB-OTG:** Radio programming path when Web Serial is unavailable (mobile browsers).
- **Layers:** Capacitor / USB live in `integrations` + `android/`; never in `src/core/` ([layer-boundaries.mdc](../../../.cursor/rules/layer-boundaries.mdc)).

## Native behaviour (#887, #888)

- **USB-Serial Plugin:** `@leeskies/capacitor-usb-serial` (MIT) backed by `mik3y/usb-serial-for-android`. Common chips (CH340, CP2102, FTDI, PL2303, CDC/ACM) listed in `android/app/src/main/res/xml/device_filter.xml`. Root `android/build.gradle` must include JitPack (`maven { url 'https://jitpack.io' }` in `allprojects.repositories`) so Gradle can resolve that transitive dependency.
- **Serial line rate and DTR/RTS:** the plugin's `open` takes no rate, so a port comes up at its driver's default
  (a CH340 runs 9600). `openCapacitorSerialPipe` (`src/integrations/radio-io/transport/capacitorSerialPipe.ts`) sets the
  requested rate with the plugin's `setParameters` (8 data bits, 1 stop bit, no parity) before it starts reading, then
  sets DTR and RTS: high by default, as every Web Serial codeplug open does, or low when the caller asks (a cable may wire
  them to PTT). A rate the driver refuses fails the open with a clear error instead of running at the default.
  - **What this changes for codeplug Read/Write:** before, every Android Read and Write ran at the driver's default
    (9600 on a CH340) whatever the radio needed, and never set DTR/RTS. Now each radio runs at its own rate, with its own
    rate fallback, and DTR/RTS raised: the same as in a desktop browser. A radio whose rate is 9600 sees no difference;
    one at another rate could not have worked before. Not yet tried on a phone with a radio.
  - **Writes:** the plugin's `write` resolves once its stream has queued the bytes, and its calls run on a thread pool,
    so the pipe queues every write in call order, keeps its own time-based account of when the line is idle, and opens
    the stream with a 16 KiB write buffer (one frame up to 8 KiB).
  - **Changing rate mid-session (`reopen`):** after the queued bytes have had time to leave the adapter (their wire time
    plus 50 ms), the pipe calls `setParameters` on the open port: no close and open, and the read stream keeps running.
    Bytes read before the switch are dropped. The firmware flasher's rate switch (the UV-5R Mini's loader at 38400) uses
    it; see the firmware flasher below.
  - **Which device:** codeplug Read/Write uses the first USB serial device the plugin lists, as before. The firmware
    flasher's links pass the cable's USB filters instead: exactly one attached device must match, with no fall-back to the
    first device; none or two is refused. The flasher's pre-flight probe runs in the app the same way; its safety
    backup stays desktop-only and refuses in the app.
- **Firmware flasher:** `/firmware` in the app offers the DM-32UV, the AT-D890UV, the RT95 front panel and the UV-5R
  Mini only while [developer mode](../developer-mode/README.md) is on (in any build); the RT95 main board is hidden.
  With developer mode off it says flashing is available in a desktop browser. The wizard is the desktop one: the cable
  is found by its USB filters instead of a picker, and the stock file picker takes any file (the pinned hashes
  decide). The DM-32UV, AT-D890UV and RT95 front panel are proven offline only (their updaters run through the app's
  pipe against bootloader mocks); none of them has been flashed from a phone yet. An AT-D890UV flash is estimated at
  2.5 to 7 minutes from a phone (one USB round trip per 40-byte frame, not measured) against about 26 s on a desktop,
  and Android may ask for USB access each time the radio attaches (entering update mode, and its reboot at the end).
  Before the first flash from a
  phone: flash stock, charge the phone, set a long screen timeout, keep the app in front, plug in only the cable, and
  keep a desktop ready; on a stall, power-cycle the radio into update mode and flash again from the phone or a desktop.
  See [firmware flashing, Android app](../firmware-flashing/README.md#android-app).
- **Saving files:** see [Saving files](#saving-files) below.
- **API Proxies:** On Capacitor native, relative `/api/*` (RadioID, RepeaterBook, IRTS) resolve to an absolute origin from `BUILD_ENV` via `resolveApiUrl` (`src/integrations/platform/resolveApiUrl.ts`):

| `BUILD_ENV`                              | Native API origin                     |
| ---------------------------------------- | ------------------------------------- |
| `prod`                                   | `https://codeplug.mm9pdy.net`         |
| `staging`, `main`, `dev`, `local`, other | `https://staging.codeplug.mm9pdy.net` |

Web builds keep same-origin relative `/api/*` (hostname selects the Functions deployment). Pre-release sideload APKs (`BUILD_ENV=staging`) therefore hit staging proxies, not production.

- **CORS:** Pages Functions allowlist includes `capacitor://localhost` (iOS), `https://localhost` (Android's default `androidScheme: 'https'`), and `http://localhost` (mirrored `Access-Control-Allow-Origin` — **not** `*`). See `functions/lib/codeplugOrigin.ts`.
- **External Links:** Anchors with `target="_blank"` and http(s) hrefs open via `@capacitor/browser` (Chrome Custom Tabs).
- **Combobox dropdowns:** Mantine `Select` / `Autocomplete` / `MultiSelect` use theme `hideDetached: false` so opening a control near the bottom of a scrollable page (e.g. Settings → Grid overlay) does not scroll the trigger off-screen ([#902](https://github.com/pskillen/codeplug-studio/issues/902)).
- **Google Drive:** PKCE OAuth in Chrome Custom Tabs with redirect `net.mm9pdy.codeplugstudio:/oauth2redirect`. Requires Android OAuth client + `VITE_GOOGLE_ANDROID_CLIENT_ID` in APK builds. See [google-drive](../import-export/google-drive.md).

## Saving files

The app's WebView ignores a `blob:` link with `download`, so every download in Studio goes through one helper,
`downloadBlob` (`src/integrations/download/browserDownload.ts`), which on native hands the file to `nativeSave.ts`
instead ([#1685](https://github.com/pskillen/codeplug-studio/issues/1685)). Callers don't branch on platform; a
browser keeps its normal download with the same file name.

- **Where it lands:** the phone's public `Documents/Codeplug Studio/<file name>` (Files app → Documents → Codeplug
  Studio), written with `@capacitor/filesystem` in chunks of 3 MiB, so large zips and exports go through. A file with
  the same name is replaced.
- **What you see:** a notice at the top of the screen, **Saved to Documents/Codeplug Studio/&lt;file name&gt;**
  ([`SavedFileNotice`](../../../src/app/components/SavedFileNotice/SavedFileNotice.md), 10 s or until dismissed), and
  Android's share sheet titled the same, opened on the file by `@capacitor/share` so it can go to Drive, mail, Quick
  Share and so on. Cancelling the sheet keeps the file.
- **Android 10 and earlier:** writing `Documents` there needs a storage permission the app does not ask for, so the
  file goes to the app's cache instead; the share sheet (titled **Keep or send &lt;file name&gt;**) is the only way to
  keep it. A completed share shows **&lt;file name&gt; was shared**. If sharing fails or is cancelled, the notice says
  **&lt;file name&gt; was not kept: sharing was cancelled or failed. Try saving again.** Use the download button to retry.
- **Permissions:** none added. Android 11 and later let an app write its own files to `Documents` without one.
- **A failed save** shows **Couldn't save &lt;file name&gt;: &lt;reason&gt;**.
- **What saves this way:** every download in Studio: codeplug, CPS and project exports, radio backups (DM-32UV
  calibration, AT-D890UV vital backup, codeplug backups), the flash summary's **Download .txt**, the write-verify
  report, and the debug pages' zips (the UV-5R Mini **Download all**). Steps the app refuses (a flasher safety backup,
  the AT-D890UV probe's writing passes) still refuse.
- Not yet tried on a phone.

## Sideload APK (#889)

### CI packaging

Reusable [`.github/workflows/android-release.yaml`](../../../.github/workflows/android-release.yaml), called from the same deploy wrappers as Pages:

| Caller                                                    | Trigger                   | `BUILD_ENV` | Output                       |
| --------------------------------------------------------- | ------------------------- | ----------- | ---------------------------- |
| [`dev.yaml`](../../../.github/workflows/dev.yaml)         | Push to `dev`             | `dev`       | Workflow artifact            |
| [`main.yaml`](../../../.github/workflows/main.yaml)       | Push to `main`            | `main`      | Workflow artifact            |
| [`staging.yaml`](../../../.github/workflows/staging.yaml) | Pre-release               | `staging`   | Artifact + **Release asset** |
| [`prod.yaml`](../../../.github/workflows/prod.yaml)       | Full release (`released`) | `prod`      | Artifact + **Release asset** |

GA secrets follow Pages (`prod` → `GA_MEASUREMENT_ID`; otherwise `GA_MEASUREMENT_ID_PREPROD`). Native API origin follows the same `BUILD_ENV` split (see table above). Version comes from the release tag when provided, else short git SHA. Tagged staging/prod runs set `ANDROID_VERSION_CODE` from the tag ([play-store-publish.md](play-store-publish.md)); untagged `dev`/`main` APKs still use `github.run_number`.

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

### AAB / Play Store publish

`staging.yaml` and `prod.yaml` also build a signed `.aab` (`build_aab: true`), kept as a workflow artifact only — never attached to the GitHub Release. A GitHub pre-release ensures the staging-flavoured bundle on Play **Open testing**; a full release ensures the prod-flavoured bundle on **Production**. `main` / `dev` pushes build APKs only. Re-runs reconcile the same `versionCode` instead of uploading a second binary. Track map, numbering, and retry semantics: [play-store-publish.md](play-store-publish.md).

Play listing / Data safety remains [#890](https://github.com/pskillen/codeplug-studio/issues/890); publish pipeline alignment is [#1206](https://github.com/pskillen/codeplug-studio/issues/1206).

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
