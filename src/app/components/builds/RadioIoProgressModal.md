# RadioIoProgressModal

## Purpose

Blocking modal during Web Serial **Read** / **Write** on a Direct radio FormatBuild. Shows coarse steps, a transfer progress bar (from existing `ProgressUpdate`), and a prominent keep-tab-open warning. Does not change radio adapter code.

## Props

| Prop                | Type                                                    | Description                                    |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `opened`            | `boolean`                                               | Show while an operation is in progress         |
| `operation`         | `'read' \| 'write'`                                     | Chooses step list and title                    |
| `phase`             | `'connecting' \| 'preparing' \| 'transfer' \| 'saving'` | Active step                                    |
| `progress`          | `ProgressUpdate \| null`                                | Block-level progress during `transfer`         |
| `navigationBlocked` | `boolean`                                               | Extra alert after an in-app navigation attempt |
| `onCancel`          | `() => void`                                            | Abort the in-flight transfer                   |

## Usage

```tsx
<RadioIoProgressModal
  opened={busy}
  operation={operation}
  phase={phase}
  progress={progress}
  navigationBlocked={navBlockedHint}
  onCancel={handleCancel}
/>
```

## Behaviour

- Modal cannot be dismissed via escape, overlay click, or close button — only **Cancel** (parent aborts) or completion.
- Parent should pair with `useUnsavedNavigationGuard(busy)` + `beforeunload` so route changes and tab close are blocked while open.

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
