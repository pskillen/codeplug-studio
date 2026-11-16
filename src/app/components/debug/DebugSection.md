# DebugSection

Titled bordered container for every block on a radio debug tab.

## Purpose

One look for debug blocks: title, optional dimmed description, a `meta` slot on the title row (address range, confidence badge, diff badge) and an optional fold. Grows from the v2 `Panel` (which only takes a string badge). Knows no radio.

## Props

| Prop               | Type        | Notes                                                   |
| ------------------ | ----------- | ------------------------------------------------------- |
| `id`               | `string`    | Anchor id for jump links                                |
| `title`            | `string`    | Heading (`<h2>`)                                        |
| `description`      | `ReactNode` | One dimmed paragraph under the title                    |
| `meta`             | `ReactNode` | Right of the title; wraps under it on a phone           |
| `collapsible`      | `boolean`   | The title becomes a disclosure button (`aria-expanded`) |
| `defaultCollapsed` | `boolean`   | Initial state when `collapsible`; state is uncontrolled |
| `children`         | `ReactNode` | Body                                                    |
| `className`        | `string`    | Optional root class                                     |

## Usage

```tsx
<DebugSection title="VHF power" meta={<code>0x3CC0</code>} collapsible defaultCollapsed>
  …
</DebugSection>
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Body is unmounted while collapsed, so lazy content (a numeric table) is built only on open.
- Uses v2 tokens; no radio literals.

## Related

- [EvidenceNotice.md](./EvidenceNotice.md), [ConfidenceBadge.md](./ConfidenceBadge.md)
- [docs/reference/styleguide/debug-pages.md](../../../../docs/reference/styleguide/debug-pages.md)
