# StatusBanner

Inline feedback banner with success, warning, and info tones.

## Purpose

Surfaces integrity summaries (dangling references), contextual notices, and non-blocking alerts — tinted background + border per tone.

## Props

| Prop        | Type                               | Notes              |
| ----------- | ---------------------------------- | ------------------ |
| `tone`      | `'success' \| 'warning' \| 'info'` | Default `info`     |
| `children`  | `ReactNode`                        | Banner message     |
| `className` | `string`                           | Optional root class |

## Usage

```tsx
import { DesignSystemV2Provider, StatusBanner } from '@app/components/v2';

<DesignSystemV2Provider>
  <StatusBanner tone="success">No dangling references.</StatusBanner>
  <StatusBanner tone="warning">3 channels missing zone membership.</StatusBanner>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Uses Tabler icons (`IconCircleCheck` for success; `IconInfoCircle` for warning/info).
- Live demos: `/styleguide/v2/feedback`

## Related

- [DesignSystemV2Provider.md](./DesignSystemV2Provider.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
