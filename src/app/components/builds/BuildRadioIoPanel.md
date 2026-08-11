# BuildRadioIoPanel

## Purpose

Build Export chrome for **direct serial** read/write (desktop **Web Serial**, Android Capacitor **USB-OTG**) on **Direct radio** (`radio-io`) egress pathways when a registered adapter matches the profile. Read hydrates `EgressPath.hydration` (`radio-clone`); write runs `assemble` → encode → upload. No CPS ZIP/CSV for this format.

## Props

| Prop     | Type         | Description                                                                     |
| -------- | ------------ | ------------------------------------------------------------------------------- |
| `build`  | `RadioBuild` | Active radio build                                                              |
| `egress` | `EgressPath` | Active direct-serial pathway (`formatId`/`profileId`/hydration live here, #654) |

## Usage

```tsx
<BuildRadioIoPanel build={build} egress={activeEgress} />
```

Renders nothing when `descriptorsForEgress(egress)` is empty. Must render under `BuildLayoutProvider` (uses `reloadEgressPaths`).

## Behaviour

- Leads with [`WebSerialExperimentalAlert`](./WebSerialExperimentalAlert.md) — orange experimental warning (does not block controls).
- For **AT-D890UV** (`radio-io-at-d890uv`), shows [`AtD890WriteCoverageTable`](./AtD890WriteCoverageTable.md) — what Write updates vs defers vs leaves alone.
- When an adapter sets `prodWriteDisabled`, `resolveRadioWriteGate` hides Write on `prod` only (no adapters carry the flag today; mechanism remains for future bring-up).
- Feature-detects Web Serial **or** Capacitor USB-serial (`isRadioSerialSupported`); shows unsupported banner when neither is available.
- **Read from radio** → download → persist hydration on the **egress** → read-only summary.
- **Write to radio** → blocked until hydration exists (full-image strategy).
- **Write Keps** (#859, design §8 Workflow B) — shown only when the egress profile has an entry in `hasSatelliteKepsWriteAdapter`/`getSatelliteKepsWriteAdapter` (`src/app/services/satelliteKepsWriteAdapters.ts`; today: AT-D890UV only). Uploads the operator's **enabled** satellites from the library (`persistence.listSatellites`) in a separate PROGRAM session from the codeplug Write — does **not** require a prior Read/hydration. Shares this panel's `busy`/`operation` state with Read/Write, so it mutually disables with them (design §9 "disable the adjacent button" — same-tab serial-lock mechanism; no separate lock primitive).
  - **Pre-flight capacity check** (#1068): before opening a session, counts write-eligible `(satellite, transmitter)` records via `getSatelliteKepsWriteCapacity(profileId)` (`satelliteKepsWriteAdapters.ts`). If it exceeds the profile's registered cap, shows a yellow "Write capacity" alert and returns — no session is opened, `kepsWriteFn` is never called. Mirrors the hard block `writeSatellitesToRadio` itself still enforces (no partial write); this only surfaces that fact earlier.
  - **Post-write summary**: written/skipped alert on completion — satellite-level `skipped` (no write-eligible transmitters at all) alongside transmitter-level `skippedTransmitters` (#1068, e.g. an SSTV transmitter dropped by the D890 mode-capability filter), each with its own reason line.
- While busy, opens [`RadioIoProgressModal`](./RadioIoProgressModal.md) (checklist grows from `ProgressUpdate.stage` — Channels, Zones, … — plus transfer bar + keep-tab warning); `operation: 'keps-write'` gets its own step list/title. Cancel aborts via `AbortSignal`.
- **AT-D890UV Write:** after upload, the progress modal offers optional **Check preserved settings** — wait for the radio to finish its automatic restart, then Studio reconnects and checks settings Studio does not set against the pre-Write snapshot. **Close** skips the check without implying a problem.
- Blocks in-app navigation and tab close while busy (`useUnsavedNavigationGuard`); releases the port on failure.
- Links to build **Radio image** (`/builds/:id/radio-image`) for the retained region map.
- In-flow attribution from `descriptor.attributionIds`.

Does **not** import radio channels into the library.

## Related

- [`WebSerialExperimentalAlert.md`](WebSerialExperimentalAlert.md) — experimental pathway warning
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- Services: `src/app/services/radioIoSession.ts`
