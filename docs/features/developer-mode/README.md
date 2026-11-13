# Developer mode

**Status:** shipped on every build, prod and the Android app included.
**Tracking:** [#1650](https://github.com/pskillen/codeplug-studio/issues/1650)

A hidden, per-device switch, like Android's "tap the build number". On the production site it shows the features
prod hides: the Debug pages, firmware flashing for radios whose updater is still prod-gated, and Write on radio
profiles marked prod-only-hidden. On every other build (local, next, dev, staging) those features are always shown, so
developer mode changes nothing there except the badge.

**Source:** `src/app/services/prodFeatureGate.ts` (the gate), `src/integrations/preferences/developerMode.ts`
(storage), `src/app/services/developerModeTaps.ts` (the gesture), `src/app/hooks/useDeveloperMode.ts`,
`src/app/components/DeveloperModeBadge/`, `src/app/components/BuildFooter/`, `src/app/routes/debug/DebugGate.tsx`.

## Turning it on and off

- **Five taps on the version** in the page footer ("Codeplug Studio · prod · 1.2.3"), each within 2 seconds of the
  last. From the second tap a short toast counts down ("3 more taps to turn on developer mode"); the fifth turns it on
  and says so. The same gesture turns it off.
- **The badge.** While it is on, a "Developer mode" chip sits in the top bar on every screen, so a screenshot or a
  support question shows it. Its ✕ turns developer mode off in one tap.
- **The Debug index** (`/debug`) has a "Developer mode on this device" switch.

Turning it off hides the gated features at once, except an open firmware flasher, which keeps the radios it offered
when the page opened so a running flash is never cut off. On prod, turning it off while on a Debug page goes home.

## What it unlocks on prod

| Feature                     | Prod-hidden by                                                     | Gate resolver              |
| --------------------------- | ------------------------------------------------------------------ | -------------------------- |
| Debug pages (`/debug/*`)    | always (routes, the avatar menu's Debug item)                      | `resolveDebugPagesGate`    |
| Firmware flashing per radio | `prodFlashDisabled` on the radio's `FirmwareUpdaterDescriptor`     | `resolveFirmwareFlashGate` |
| Codeplug Write and Restore  | `prodWriteDisabled` on a radio-io descriptor or compatible profile | `resolveRadioWriteGate`    |

Nothing else changes for anyone who never taps.

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
read-only paths; the danger-zone wizards. Platform checks stay the feature's own concern too: on the Android app the
flasher still offers only radios marked `capacitorSupported`, and Web Serial or USB availability is unchanged. The
Write gate's existing native-app exemption for descriptor-level `prodWriteDisabled` is unchanged.

## Storage and privacy

One `localStorage` key, `codeplug-studio:developerMode` (`"on"` or absent), per browser profile. It is never synced,
never written to a project, YAML, backup, Google Drive file or share link, and never sent anywhere. Other tabs of the
same profile follow a change through the `storage` event. The Debug localStorage page lists the key as "Developer mode
(this device)". If storage is unavailable, developer mode reads as off.

## Not done / rejected

- A server-side or account-level switch: there is no backend, and the ask is per device.
- Hiding the gesture behind a build flag: the owner runs the prod build of the Android app and needs it there.

## Related

- [Debug](../debug/README.md) · [Firmware flashing](../firmware-flashing/README.md) ·
  [Radio read/write](../radio-read-write/README.md) · [App shell](../app-shell/README.md)
- [BuildFooter](../../../src/app/components/BuildFooter/BuildFooter.md) ·
  [DeveloperModeBadge](../../../src/app/components/DeveloperModeBadge/DeveloperModeBadge.md)
