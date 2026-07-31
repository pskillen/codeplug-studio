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
- While busy, opens [`RadioIoProgressModal`](./RadioIoProgressModal.md) (checklist grows from `ProgressUpdate.stage` — Channels, Zones, … — plus transfer bar + keep-tab warning). Cancel aborts via `AbortSignal`.
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
