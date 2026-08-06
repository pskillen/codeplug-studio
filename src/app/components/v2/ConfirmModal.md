# ConfirmModal

Standard and destructive confirmation dialog on top of `ModalShell`.

## Purpose

The common "are you sure?" pattern — delete confirmations, destructive bulk actions, and any action needing an explicit second step.

## Props

| Prop              | Type                         | Notes                                                       |
| ----------------- | ---------------------------- | ----------------------------------------------------------- |
| `open`            | `boolean`                    | Required                                                    |
| `onClose`         | `() => void`                 | Required                                                    |
| `onConfirm`       | `() => void`                 | Required                                                    |
| `title`           | `ReactNode`                  | Header title                                                |
| `children`        | `ReactNode`                  | Body content                                                |
| `confirmLabel`    | `string`                     | Default `Confirm`                                           |
| `cancelLabel`     | `string`                     | Default `Cancel`                                            |
| `tone`            | `'default' \| 'destructive'` | Default `default` — swaps icon + confirm button color       |
| `busy`            | `boolean`                    | Disables dismiss + both buttons, confirm label → `Working…` |
| `confirmDisabled` | `boolean`                    | Disables confirm independently of `busy`                    |
| `inline`          | `boolean`                    | Passed through to `ModalShell`                              |

## Usage

```tsx
import { ConfirmModal, DesignSystemV2Provider } from '@app/components/v2';

<DesignSystemV2Provider>
  <ConfirmModal
    open={open}
    onClose={() => setOpen(false)}
    onConfirm={handleDelete}
    title="Delete zone?"
    tone="destructive"
  >
    This cannot be undone.
  </ConfirmModal>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- `size="sm"` on the underlying `ModalShell`.
- `destructive` tone swaps the header icon to `IconAlertTriangle` and the confirm button to the `destructive` `Button` variant; `default` tone uses `IconHelpCircle` with the `primary` variant.
- Live demos: `/styleguide/v2/overlays`

## Related

- [ModalShell.md](./ModalShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
