# SatelliteKepsWriteTargetModal

## Purpose

Workflow A (#859, [feature-design.md §8](../../../../docs/features/satellite-keps/feature-design.md#8-the-write-workflows)): the target-selection modal behind the Satellite Keps library page's **Write Keps to Radio** button. Lets the operator pick a radio — a build's persisted Web Serial egress ("Your radios"), or a registered adapter with no persisted build ("Other supported radios") — then connects and uploads the library's **enabled** satellites, reusing the same [`RadioIoProgressModal`](../builds/RadioIoProgressModal.md) shell Workflow B uses for its **Write Keps** trigger (on the dedicated `BuildSatelliteKepsPage` build tab since #1085, previously an inline `BuildRadioIoPanel` button).

## Props

| Prop        | Type             | Description                                                                                                                                       |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`    | `boolean`        | Show the flow. Internally, the component only mounts while `true` — each open is a fresh mount, so there is no separate "reset on reopen" effect. |
| `onClose`   | `() => void`     | Dismiss the whole flow (target select, or after a completed/cancelled write)                                                                      |
| `projectId` | `string \| null` | Active project — needed to list builds/egress paths and enabled satellites                                                                        |

## Usage

```tsx
<SatelliteKepsWriteTargetModal
  opened={writeModalOpen}
  onClose={() => setWriteModalOpen(false)}
  projectId={projectId}
/>
```

## Behaviour

- **Target list:** "Recommended / Your radios" enumerates the project's `RadioBuild`s with a `web-serial` `EgressPath` whose `profileId` is registered in `hasSatelliteKepsWriteAdapter` (`src/app/services/satelliteKepsWriteAdapters.ts`). "Other supported radios" lists the registry's remaining compatible profiles from `listRadioDescriptors()`, deduplicated by `profileId` against anything already shown under "Your radios".
- **Connect:** reuses `openRadioSessionForEgress` (`src/app/services/radioIoSession.ts`) — the same connect path `BuildRadioIoPanel` uses. A "Your radios" selection passes its real persisted `EgressPath`; an "Other supported radios" selection builds an **unpersisted, ad-hoc `EgressPath` stub** (`id: ''`, `revision: 0`, …) carrying only `formatId`/`profileId`. This is safe _only_ because the satellite-keps write path never reads `egress.hydration` — it must not be copied for a codeplug write.
- **Write:** looks up the profile's adapter via `getSatelliteKepsWriteAdapter` and uploads the project's **enabled** satellites (`persistence.listSatellites`, filtered).
- **Progress:** [`RadioIoProgressModal`](../builds/RadioIoProgressModal.md) with `operation="keps-write"` — the same distinct step list/title Workflow B uses, not the codeplug write's shell.
- **Prod gate:** respects `resolveRadioWriteGate`/`resolveRadioWriteProdDisabledMessage` exactly as `BuildRadioIoPanel` does before opening a port.
- **Capacity overage:** `RadioWriteBlockedError.capacity` (`{ selected, max, radioLabel }`) drives the design's exact `{selected} / {max}` error copy — see `radioIoAtD890SatelliteWrite.ts`.
- **Serial lock:** applies `useUnsavedNavigationGuard(busy)` to its own busy state — see [BuildRadioIoPanel.md](../builds/BuildRadioIoPanel.md) for why no separate cross-page lock primitive exists (single-page app; one route mounted at a time; documented accepted limitation for cross-**tab** collisions).
- On write completion, returns to the target-select view (still mounted) with a written/skipped summary alert, rather than auto-closing — lets the operator review skip reasons or pick another target before dismissing.

## Related

- [radio-read-write hub](../../../../docs/features/radio-read-write/README.md)
- [satellite-keps feature hub](../../../../docs/features/satellite-keps/README.md)
- [BuildRadioIoPanel.md](../builds/BuildRadioIoPanel.md) — Workflow B, the contextual sibling
- [RadioIoProgressModal.md](../builds/RadioIoProgressModal.md)
- Service: `src/app/services/satelliteKepsWriteAdapters.ts`
