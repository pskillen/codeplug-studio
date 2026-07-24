# RadioIoProgressModal

## Purpose

Blocking modal during Web Serial **Read** / **Write** on a Direct radio FormatBuild. Shows coarse steps, a transfer progress bar (from existing `ProgressUpdate`), and a prominent keep-tab-open warning. Does not change radio adapter code.

## Props

| Prop                | Type                                                              | Description                                                      |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `opened`            | `boolean`                                                         | Show while an operation is in progress                           |
| `operation`         | `'read' \| 'write'`                                               | Chooses step list and title                                      |
| `phase`             | `'connecting' \| 'preparing' \| 'transfer' \| 'saving' \| 'done'` | Active coarse phase                                              |
| `progress`          | `ProgressUpdate \| null`                                          | Block-level progress during `transfer` (`msg`, optional `stage`) |
| `transferStages`    | `readonly string[]`                                               | Checklist labels accumulated from `progress.stage`               |
| `navigationBlocked` | `boolean`                                                         | Extra alert after an in-app navigation attempt                   |
| `onCancel`          | `() => void`                                                      | Abort the in-flight transfer                                     |
| `onClose`           | `() => void`                                                      | Dismiss after `phase === 'done'` (Write stays open until Close)  |

## Usage

```tsx
<RadioIoProgressModal
  opened={busy}
  operation={operation}
  phase={phase}
  progress={progress}
  transferStages={transferStages}
  navigationBlocked={navBlockedHint}
  onCancel={handleCancel}
/>
```

## Behaviour

- Modal cannot be dismissed via escape, overlay click, or close button while transferring — only **Cancel** (parent aborts). On success (`phase === 'done'`), **Close** dismisses so the operator can review the checklist (especially Write).
- Parent should pair with `useUnsavedNavigationGuard(busy)` + `beforeunload` so route changes and tab close are blocked while open.
- When adapters emit `ProgressUpdate.stage`, the parent appends unique labels to `transferStages` so the checklist grows (Read: Discover memory map → Channels → Zones → …; Write: Channels → Zones → Scan lists → …).

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
