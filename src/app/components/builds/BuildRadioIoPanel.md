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
- **Read from radio** → download → persist hydration on the **egress** → read-only summary (legacy stash radios). Migrated adapters (AT-D890UV, OpenGD77) do not need a stored bag for Write.
- **Write to radio** → blocked when `hydrationRequiredForWrite` and no bag. AT-D890UV and OpenGD77 overlay modelled channels onto an **in-session** radio image (never a blank `0xff` map). OpenGD77 `upload` always pre-write-reads FLASH, then encodes onto that prior.
- **Write Keps…** (#859, design §8 Workflow B; promoted to its own tab by #1085) — a link, not an inline trigger. Shown only when the egress profile has an entry in `hasSatelliteKepsWriteAdapter` (`src/app/services/satelliteKepsWriteAdapters.ts`; today: AT-D890UV only), it navigates to the dedicated **Satellite keps** build tab (`/builds/:id/satellite-keps`, `BuildSatelliteKepsPage` — see [feature hub](../../../../docs/features/satellite-keps/README.md)), which now owns the preview table, the pre-flight capacity check, the actual write trigger, and the post-write summary. This panel no longer opens a keps-write session itself.
- While busy, opens [`RadioIoProgressModal`](./RadioIoProgressModal.md) (checklist grows from `ProgressUpdate.stage` — Channels, Zones, … — plus transfer bar + keep-tab warning) for Read/Write. `BuildSatelliteKepsPage` opens its own separate instance for `operation: 'keps-write'`. Cancel aborts via `AbortSignal`.
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
