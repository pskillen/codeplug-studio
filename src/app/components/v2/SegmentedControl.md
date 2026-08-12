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

- Live demos: `/styleguide/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
