# StatusDot

Small filled-dot status indicator with a label.

## Purpose

Write status, sync state, and per-row status in `WriteVerifyReport` — anywhere a compact inline status needs a color + short label without a full `Pill`.

## Props

| Prop        | Type                                                               | Notes               |
| ----------- | ------------------------------------------------------------------ | ------------------- |
| `label`     | `ReactNode`                                                        | Required            |
| `tone`      | `'success' \| 'warning' \| 'destructive' \| 'neutral' \| 'accent'` | Default `success`   |
| `className` | `string`                                                           | Optional root class |

## Usage

```tsx
import { DesignSystemV2Provider, StatusDot } from '@app/components/v2';

<DesignSystemV2Provider>
  <StatusDot label="Verified" tone="success" />
  <StatusDot label="1 channel failed" tone="destructive" />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- 6px filled circle, inline-flex with the label.
- Live demos: `/styleguide/feedback`

## Related

- [WriteVerifyReport.md](./WriteVerifyReport.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
