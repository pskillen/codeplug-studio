# DismissibleNotice

Chrome-level inline dismissible notice — single-line, no re-show once dismissed.

## Purpose

Non-blocking session/drift notices (e.g. Drive session expired, dangling reference warnings shown inline in chrome). Distinct from the page-level persistent `StatusBanner`, which is a bordered card and doesn't dismiss. Replaces the retired v1 `SoftWarning` tone/dismiss shape.

## Props

| Prop        | Type                                     | Notes                               |
| ----------- | ---------------------------------------- | ----------------------------------- |
| `tone`      | `'warning' \| 'info'`                    | Default `warning`                   |
| `children`  | `ReactNode`                              | Required — the message              |
| `action`    | `{ label: string, onClick: () => void }` | Optional inline text-link action    |
| `onDismiss` | `() => void`                             | Called when the notice is dismissed |

## Usage

```tsx
import { DesignSystemV2Provider, DismissibleNotice } from '@app/components/v2';

<DesignSystemV2Provider>
  <DismissibleNotice tone="warning" action={{ label: 'Reconnect', onClick: reconnect }}>
    Drive session expired.
  </DismissibleNotice>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Internal `dismissed` state — renders `null` once dismissed. **No re-show prop or API** — a dismissed notice stays gone until the component remounts.
- Live demos: `/styleguide/feedback`

## Related

- [StatusBanner.md](./StatusBanner.md) — the page-level persistent counterpart
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
