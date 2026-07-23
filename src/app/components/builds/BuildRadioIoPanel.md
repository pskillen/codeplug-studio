# BuildRadioIoPanel

## Purpose

Build Export chrome for **Web Serial** read/write on **Direct radio** (`radio-io`) egress pathways when a registered adapter matches the profile. Read hydrates `EgressPath.hydration` (`radio-clone`); write runs `assemble` → encode → upload. No CPS ZIP/CSV for this format.

## Props

| Prop     | Type         | Description                                                                  |
| -------- | ------------ | ---------------------------------------------------------------------------- |
| `build`  | `RadioBuild` | Active radio build                                                           |
| `egress` | `EgressPath` | Active Web Serial pathway (`formatId`/`profileId`/hydration live here, #654) |

## Usage

```tsx
<BuildRadioIoPanel build={build} egress={activeEgress} />
```

Renders nothing when `descriptorsForEgress(egress)` is empty. Must render under `BuildLayoutProvider` (uses `reloadEgressPaths`).

## Behaviour

- Feature-detects Web Serial; shows unsupported banner when missing.
- **Read from radio** → download → persist hydration on the **egress** → read-only summary.
- **Write to radio** → blocked until hydration exists (full-image strategy).
- While busy, opens [`RadioIoProgressModal`](./RadioIoProgressModal.md) (steps + transfer progress bar + keep-tab warning). Cancel aborts via `AbortSignal`.
- Blocks in-app navigation and tab close while busy (`useUnsavedNavigationGuard`); releases the port on failure.
- Links to build **Radio image** (`/builds/:id/radio-image`) for the retained region map.
- In-flow attribution from `descriptor.attributionIds`.

Does **not** import radio channels into the library.

## Related

- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- Services: `src/app/services/radioIoSession.ts`
