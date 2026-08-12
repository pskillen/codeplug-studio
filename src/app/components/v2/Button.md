# Button

Design-system v2 button with primary/secondary/outline/dashed/ghost/destructive variants.

## Purpose

Action control styled to v2 tokens. Wraps Mantine `Button` (`unstyled`) for keyboard and a11y behaviour; visual variants live in the CSS module (Mantine has no built-in dashed variant).

## Props

| Prop       | Type                                                                            | Notes                    |
| ---------- | ------------------------------------------------------------------------------- | ------------------------ |
| `variant`  | `'primary' \| 'secondary' \| 'outline' \| 'dashed' \| 'ghost' \| 'destructive'` | Default `primary`        |
| `size`     | `'sm' \| 'md' \| 'lg'`                                                          | Default `md`             |
| `children` | `ReactNode`                                                                     | Label / content          |
| …          | Remaining Mantine `ButtonProps` except `variant` / `size` / `color`             | `onClick`, `disabled`, … |

## Usage

```tsx
import { DesignSystemV2Provider, Button } from '@app/components/v2';

<DesignSystemV2Provider>
  <Button variant="primary">Save</Button>
  <Button variant="dashed" size="sm">
    Add channel
  </Button>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider` so `--dsv2-*` tokens resolve.
- Live demos: `/styleguide/forms`

## Related

- [DesignSystemV2Provider.md](./DesignSystemV2Provider.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
