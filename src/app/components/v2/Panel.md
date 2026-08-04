# Panel

Bordered container with optional titled header for editor sections and summary panels.

## Purpose

Standard v2 content panel — `18px 20px` padding, `10px` radius, `1px` border. Used on Summary breakdowns, Channel editor sections, and anywhere a titled bordered block is needed.

## Props

| Prop        | Type        | Notes                                     |
| ----------- | ----------- | ----------------------------------------- |
| `id`        | `string`    | Anchor id for `SectionNav` scroll targets |
| `title`     | `string`    | Section heading                           |
| `sub`       | `string`    | Optional description below title          |
| `children`  | `ReactNode` | Panel body                                |
| `className` | `string`    | Optional root class                       |

## Usage

```tsx
import { DesignSystemV2Provider, Panel } from '@app/components/v2';

<DesignSystemV2Provider>
  <Panel id="Identity" title="Identity">
    <FormField label="Name">…</FormField>
  </Panel>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Title renders as `<h2>` for section semantics.
- Live demos: `/styleguide/v2/data-display`

## Related

- [SectionNav.md](./SectionNav.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
