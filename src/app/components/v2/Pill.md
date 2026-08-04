# Pill

Compact label chip for chrome status and semantic (band/mode) tags.

## Purpose

Small, high-contrast labels. Named tones cover accent/status chrome; `tone="semantic"` is the escape hatch for saturated one-off fills (band/mode). Re-skinning domain `BandPill` / `ModePill` onto this is out of scope for #916.

## Props

| Prop        | Type                                                                                         | Notes                                |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| `tone`      | `'neutral' \| 'accent' \| 'accentSolid' \| 'success' \| 'warning' \| 'semantic' \| 'dashed'` | Default `neutral`                    |
| `color`     | `string`                                                                                     | Required for `tone="semantic"`       |
| `textColor` | `string`                                                                                     | Semantic only                        |
| `children`  | `ReactNode`                                                                                  | Label text                           |
| `onRemove`  | `() => void`                                                                                 | Trailing ✕ for membership chips      |
| `onClick`   | `() => void`                                                                                 | With `tone="dashed"`, renders button |

## Usage

```tsx
<Pill tone="accent">Overridden</Pill>
<Pill tone="semantic" color="#e03131">
  DMR
</Pill>
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/v2/data-display`

## Related

- [OverrideField.md](./OverrideField.md) (uses accent pill for override state)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
