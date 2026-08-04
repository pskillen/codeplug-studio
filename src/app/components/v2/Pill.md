# Pill

Compact label chip for chrome status and semantic (band/mode) tags.

## Purpose

Small, high-contrast labels. Named tones cover accent/status chrome; `tone="semantic"` is the escape hatch for saturated one-off fills (band/mode). Re-skinning domain `BandPill` / `ModePill` onto this is out of scope for #916.

## Props

| Prop        | Type                                                                             | Notes                          |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------ |
| `tone`      | `'neutral' \| 'accent' \| 'accentSolid' \| 'success' \| 'warning' \| 'semantic'` | Default `neutral`              |
| `color`     | `string`                                                                         | Required for `tone="semantic"` |
| `textColor` | `string`                                                                         | Semantic only; default `#fff`  |
| `children`  | `ReactNode`                                                                      | Label text                     |

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
