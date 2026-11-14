# Developer mode

**Status:** Done · **Tracking:** [#1650](https://github.com/pskillen/codeplug-studio/issues/1650)

A hidden, per-device switch, like Android's "tap the build number", on every build, prod and the Android app
included. On the production site it shows the features prod hides: the Debug pages, firmware flashing for radios whose
updater is still prod-gated, and Write on radio profiles marked prod-only-hidden. On every other build (local, next, dev, staging) those features are always shown, so
developer mode changes nothing there except the badge, the [detail it shows](#detail-it-shows), and, in the Android
app on any build, the firmware flashers marked for it (the one exception under
[What it never changes](#what-it-never-changes)).

**Source:** `src/app/services/prodFeatureGate.ts` (the gate), `src/integrations/preferences/developerMode.ts`
(storage), `src/app/services/developerModeTaps.ts` (the gesture), `src/app/hooks/useDeveloperMode.ts`,
`src/app/components/DeveloperModeBadge/`, `src/app/components/BuildFooter/`, `src/app/routes/debug/DebugGate.tsx`.

## Turning it on and off

- **Turn it on: five taps on the version** in the page footer ("Codeplug Studio · prod · 1.2.3"), each within 2
  seconds of the last. From the second tap a short toast at the top of the screen counts down ("3 more taps to turn on
  developer mode"), clear of the version so the next tap still lands on it; the fifth turns it on and says so.
- **The taps only turn it on.** While it is on, tapping the version changes nothing: from the second tap in a row the
  toast says "Developer mode is on. Turn it off from the top bar".
- **Turn it off: the badge.** While it is on, a "Developer mode" chip sits in the top bar on every screen, so a
  screenshot or a support question shows it. Its ✕ turns developer mode off in one tap.
- **The Debug index** (`/debug`) has a "Developer mode on this device" switch, on and off.

It stays on, on that device, until it is turned off there: across reloads, browser restarts, Android app restarts and
app updates (see [Storage and privacy](#storage-and-privacy)).

Turning it off hides the gated features at once, except an open firmware flasher, which keeps the radios it offered
when the page opened so a running flash is never cut off. On prod, turning it off while on a Debug page goes home.

## What it unlocks on prod

| Feature                     | Prod-hidden by                                                      | Gate resolver              |
| --------------------------- | ------------------------------------------------------------------- | -------------------------- |
| Debug pages (`/debug/*`)    | always (routes, the avatar menu's Debug item, Tools' Debug section) | `resolveDebugPagesGate`    |
| Firmware flashing per radio | `prodFlashDisabled` on the radio's `FirmwareUpdaterDescriptor`      | `resolveFirmwareFlashGate` |
| Codeplug Write and Restore  | `prodWriteDisabled` on a radio-io descriptor or compatible profile  | `resolveRadioWriteGate`    |

Nothing else changes for anyone who never taps.

## Detail it shows

On every build, developer mode also shows internal detail an ordinary user never needs:

- **The UV-5R Mini's flash layout** (`L1`, `L2`) in the firmware flasher: on Your radio and Prepare ("Flash layout:
  L2" with the prepared image, or beside a refusal), on a refused file's retry banner, and as the layouts of patch files from disk;
  for a radio report Studio refuses because its layout is unknown, what the radio reported (its `VM` entry).
  Without it the flasher says "your radio's firmware"
  ([firmware flashing](../firmware-flashing/README.md#wizard-steps)). Display only: which file is prepared, and every
  check on it, is the same either way.

## The gate

Every prod-hidden feature asks one function, `resolveProdFeatureGate(prodHidden, { buildEnv?, developerMode? })` in
`src/app/services/prodFeatureGate.ts`, directly or through its resolver in the table above. No feature keeps its own
`buildEnv === 'prod'` check. The rule:

- not prod-hidden → shown;
- not the prod build → shown;
- prod build, developer mode on → shown;
- otherwise hidden.

Both options default to the live values (`__BUILD_ENV__`, and developer mode read from storage at call time); tests
pass them. Components that show a gated feature call `useDeveloperMode()` so they re-render when it flips, and pass the
value on.

**Adding a prod-hidden feature:** give it a flag, call `resolveProdFeatureGate` (or a small resolver over it), and add
a test for prod off (hidden), prod on (shown) and pre-prod (shown). **Adding a Debug page:** add it to `debugRoutes`
in `src/app/routes/debug/debugRoutes.tsx`; the router mounts that list under `DebugGate`, and `App.test.tsx` fails if a
`/debug` route sits anywhere else.

## What it never changes

Developer mode is visibility only. The safety interlocks inside each feature are the feature's own code and never read
it: the firmware updaters' pins, stock checks, "already installed" checks and frame guards; the Write allow-lists and
read-only paths; the danger-zone wizards. Platform checks stay the feature's own concern too, with **one exception**:
in the Android app the flasher offers a radio whose updater is marked `capacitorSupported: 'developerMode'` only while
developer mode is on, in any build (not only prod). Today those are the DM-32UV, the AT-D890UV, the RT95 front panel and
the UV-5R Mini, each until a full flash from a phone has been proven on hardware for that radio. The RT95 main board
stays hidden in the app with developer mode on or off, and the exception is visibility only: each radio's pins, stock
checks and frame guards are the same code everywhere and never read developer mode (a test holds that no updater, stock
check or radio module imports the switch or a gate). Web
Serial or USB availability is unchanged. The Write gate's existing native-app exemption for descriptor-level
`prodWriteDisabled` is unchanged.

## Storage and privacy

One `localStorage` key, `codeplug-studio:developerMode` (`"on"` or absent), per browser profile. It is never synced,
never written to a project, YAML, backup, Google Drive file or share link, and never sent anywhere. Other tabs of the
same profile follow a change through the `storage` event. The Debug localStorage page lists the key as "Developer mode
(this device)". If storage is unavailable, developer mode reads as off.

`localStorage` keeps the key across reloads and restarts, and in the Android app across app restarts and updates (the
app's WebView origin does not change between versions). It is lost with the rest of the app's local data when the
browser's site data is cleared, or when the Android app is uninstalled and installed again or its storage is cleared
in Android's settings. Deleting the key on the Debug localStorage page also turns it off. Nothing else in Studio
removes it.

## Known gaps

- The Write panel and the keps page re-read developer mode on each render. A running Write is never torn down, and
  `prepareRadioWriteImage` checks the gate again before upload, so turning developer mode off mid-flow can abort
  before any write, never during one. Unused while no profile carries `prodWriteDisabled`.
- The landing page's support matrix shows developer mode as it was when the page mounted.
- In the Android app developer mode unlocks the Debug pages (which of them run there:
  [Debug, In the Android app](../debug/README.md#in-the-android-app)) and the UV-5R Mini's flasher only; no other radio's
  flasher is offered there yet. The Mini's flash from a phone has not been tried on hardware
  ([firmware flashing, Android app](../firmware-flashing/README.md#android-app)).

## Not done / rejected

- A server-side or account-level switch: there is no backend, and the ask is per device.
- Hiding the gesture behind a build flag: the owner runs the prod build of the Android app and needs it there.

## Related

- [Debug](../debug/README.md) · [Firmware flashing](../firmware-flashing/README.md) ·
  [Radio read/write](../radio-read-write/README.md) · [App shell](../app-shell/README.md)
- [BuildFooter](../../../src/app/components/BuildFooter/BuildFooter.md) ·
  [DeveloperModeBadge](../../../src/app/components/DeveloperModeBadge/DeveloperModeBadge.md)
