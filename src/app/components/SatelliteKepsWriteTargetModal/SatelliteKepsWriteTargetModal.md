# SatelliteKepsWriteTargetModal

## Purpose

Workflow A (#859, [feature-design.md §8](../../../../docs/features/satellite-keps/feature-design.md#8-the-write-workflows)): the build picker behind the library **Write keps…** action. Lists only builds with a Web Serial egress whose profile has a keps write adapter; **Continue** opens [`useRadioWriteDialog`](../builds/RadioWriteDialog/useRadioWriteDialog.tsx) with only Satellite keps ticked (same Write dialog as Workflow B and Export).

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

- **Target list:** builds with a `web-serial` egress whose `profileId` is registered in `hasSatelliteKepsWriteAdapter`. Empty state when none qualify.
- **Continue:** closes the picker and mounts the chosen build's Write dialog with keps-only ticks; the write uses that build's `satelliteOverrides` like any other write from that build.
- **Serial lock:** navigation while the Write dialog is busy is handled by the dialog hook's `busy` flag on pages that mount it (this modal unmounts after Continue).

## Related

- [radio-read-write hub](../../../../docs/features/radio-read-write/README.md)
- [satellite-keps feature hub](../../../../docs/features/satellite-keps/README.md)
- [BuildRadioIoPanel.md](../builds/BuildRadioIoPanel.md) — Workflow B, the contextual sibling
- [RadioIoProgressModal.md](../builds/RadioIoProgressModal.md)
- Service: `src/app/services/satelliteKepsWriteAdapters.ts`
