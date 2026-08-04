# CountTile

Big-number stat tile for inventory summaries and build counts.

## Purpose

Displays a prominent numeric value with an optional `/total` denominator and a tertiary label — used on Summary and Builds screens.

## Props

| Prop        | Type        | Notes                        |
| ----------- | ----------- | ---------------------------- |
| `value`     | `ReactNode` | Primary count                |
| `total`     | `ReactNode` | Optional denominator         |
| `label`     | `string`    | Tertiary caption below value |
| `className` | `string`    | Optional root class          |

## Usage

```tsx
import { DesignSystemV2Provider, CountTile } from '@app/components/v2';

<DesignSystemV2Provider>
  <CountTile value={42} label="Channels" />
  <CountTile value={18} total={24} label="Included in build" />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider` so `--dsv2-*` tokens resolve.
- Value uses tabular numerics for aligned grids.
- Live demos: `/styleguide/v2/data-display`

## Related

- [DesignSystemV2Provider.md](./DesignSystemV2Provider.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
