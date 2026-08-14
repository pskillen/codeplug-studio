# SegmentedControl

Mutually exclusive segmented option picker.

## Purpose

DMR timeslot (TS1/TS2) and similar compact exclusive choices.

## Props

| Prop       | Type                 | Notes             |
| ---------- | -------------------- | ----------------- |
| `options`  | `{ value, label }[]` | Segment options   |
| `value`    | `string`             | Active value      |
| `onChange` | `(value) => void`    | Selection handler |
| `size`     | `'sm' \| 'md'`       | Default `sm`      |
| `aria-label` | `string`             | Optional name for the `role="group"` |

## Usage

```tsx
<SegmentedControl
  options={[
    { value: 'ts1', label: 'TS1' },
    { value: 'ts2', label: 'TS2' },
  ]}
  value={ts}
  onChange={setTs}
/>
```

## Behaviour

- Native `<button>` segments in the tab order; Enter/Space select. `:focus-visible` outline on the option.
- Optional `aria-label` names the `role="group"`.
- Live demos: `/styleguide/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
