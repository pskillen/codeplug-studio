# Panel

Bordered container with optional titled header for editor sections and summary panels.

## Purpose

Standard v2 content panel — `18px 20px` padding, `10px` radius, `1px` border. Used on Summary breakdowns, Channel editor sections, and anywhere a titled bordered block is needed.

## Props

| Prop               | Type                    | Notes                                                                    |
| ------------------ | ----------------------- | ------------------------------------------------------------------------ |
| `id`               | `string`                | Anchor id for `SectionNav` scroll targets                                |
| `title`            | `string`                | Section heading                                                          |
| `sub`              | `string`                | Optional description below title                                         |
| `children`         | `ReactNode`             | Panel body                                                               |
| `className`        | `string`                | Optional root class                                                      |
| `variant`          | `'default' \| 'danger'` | `danger` — destructive tint for delete zones                             |
| `collapsible`      | `boolean`               | When true, `title` becomes a disclosure toggle that shows/hides the body |
| `defaultCollapsed` | `boolean`               | Initial state when `collapsible` is set. Defaults to expanded            |
| `badge`            | `string`                | Optional header count (visible open or collapsed), e.g. bulk-edit `2 changes` |

## Usage

```tsx
import { DesignSystemV2Provider, Panel } from '@app/components/v2';

<DesignSystemV2Provider>
  <Panel id="Identity" title="Identity">
    <FormField label="Name">…</FormField>
  </Panel>
</DesignSystemV2Provider>;
```

Collapsible, e.g. defaulting closed on a narrow viewport (caller decides `defaultCollapsed`, typically from a media query read once at mount):

```tsx
<Panel title="Orbital elements" collapsible defaultCollapsed={isMobile}>
  <FormField label="Inclination">…</FormField>
</Panel>
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Title renders as `<h2>` for section semantics; when `collapsible`, the heading wraps a `<button aria-expanded>` toggle instead of plain text — the heading level doesn't change.
- `collapsible` state is internal/uncontrolled — `defaultCollapsed` only sets the initial value; there's no controlled `collapsed`/`onCollapsedChange` pair today because no caller has needed one yet.
- `badge` sits in the header row next to the title (inside the collapse toggle when `collapsible`), so a count stays visible when the body is hidden.
- Live demos: `/styleguide/containers` (danger variant, collapsible), `/styleguide/data-display`

## Related

- [SectionNav.md](./SectionNav.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
