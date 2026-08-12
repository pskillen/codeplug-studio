# OverrideField

Library-default vs per-build override row with reset affordance.

## Purpose

Presents a labelled field that can stay on the library default or be overridden for the current format build — the pattern used in export/build settings UIs.

## Props

| Prop          | Type         | Notes                                 |
| ------------- | ------------ | ------------------------------------- |
| `label`       | `string`     | Field title                           |
| `description` | `string`     | Optional supporting copy              |
| `overridden`  | `boolean`    | Switches default vs overridden chrome |
| `onOverride`  | `() => void` | Shown when not overridden             |
| `onReset`     | `() => void` | Shown when overridden                 |
| `children`    | `ReactNode`  | Optional control(s) under the header  |

## Usage

```tsx
<OverrideField
  label="Wire name"
  description="CPS channel name for this build"
  overridden={hasOverride}
  onOverride={() => setHasOverride(true)}
  onReset={() => setHasOverride(false)}
>
  <TextInput value={wireName} onChange={…} />
</OverrideField>
```

## Behaviour

- Unoverridden: “using library default” + “Override for this build” ghost button.
- Overridden: accent `Pill` “Overridden for this build” + “Reset”.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/forms`

## Related

- [Pill.md](./Pill.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
