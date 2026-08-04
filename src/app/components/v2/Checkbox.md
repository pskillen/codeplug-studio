# Checkbox

v2-styled row-selection checkbox.

## Purpose

DataTable bulk-select and list row checkboxes.

## Props

| Prop              | Type                    | Notes              |
| ----------------- | ----------------------- | ------------------ |
| `checked`         | `boolean`               | Checked state      |
| `onCheckedChange` | `(checked) => void`     | Toggle callback    |

## Usage

```tsx
<Checkbox checked={selected} onCheckedChange={setSelected} aria-label="Select row" />
```

## Behaviour

- Live demos: `/styleguide/v2/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
