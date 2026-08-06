# ProgressModal

Blocking progress modal with per-step status — the intended shape for radio write/verify flows.

## Purpose

Long-running blocking operations (radio write, bulk export) that need a step list, an optional progress bar, and a distinct not-dismissible-while-running state. Domain-agnostic on purpose so the builds ticket ([#924](https://github.com/pskillen/codeplug-studio/issues/924)) can adopt it for the real write/verify flow.

## Props

| Prop       | Type                               | Notes                                                           |
| ---------- | ---------------------------------- | --------------------------------------------------------------- |
| `open`     | `boolean`                          | Required                                                        |
| `title`    | `ReactNode`                        | Default `Writing to radio`                                      |
| `phase`    | `'running' \| 'finished'`          | Required                                                        |
| `steps`    | `{ id, label, detail?, status }[]` | `status`: `pending \| active \| success \| error`               |
| `progress` | `number`                           | 0–100, renders a progress bar when provided                     |
| `note`     | `ReactNode`                        | Shown only while running; default disconnect warning            |
| `summary`  | `ReactNode`                        | Shown only once finished                                        |
| `onClose`  | `() => void`                       | Required                                                        |
| `onRetry`  | `() => void`                       | Shown as a Retry footer button only when finished with an error |
| `inline`   | `boolean`                          | Passed through to `ModalShell`                                  |

## Usage

```tsx
import { DesignSystemV2Provider, ProgressModal } from '@app/components/v2';

<DesignSystemV2Provider>
  <ProgressModal
    open
    phase="running"
    steps={[
      { id: 'connect', label: 'Connect', status: 'success' },
      { id: 'write', label: 'Write channels', status: 'active' },
      { id: 'verify', label: 'Verify', status: 'pending' },
    ]}
    onClose={() => setOpen(false)}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Not dismissible while `phase === 'running'` — no close button, escape, or backdrop dismiss.
- Footer is hidden entirely while running; once finished it shows Close (+ Retry when `onRetry` is provided and any step has `status="error"`).
- Header shows a destructive alert icon once finished with an error.
- Live demos: `/styleguide/v2/overlays`

## Related

- [ModalShell.md](./ModalShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
