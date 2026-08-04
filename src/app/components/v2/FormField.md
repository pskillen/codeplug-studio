# FormField

Label-above-bordered-box field wrapper for editor sections.

## Purpose

Channel editor Identity/Frequencies/etc. — label + bordered body; slots controls or static `value`.

## Props

| Prop       | Type        | Notes                             |
| ---------- | ----------- | --------------------------------- |
| `label`    | `string`    | Field label                       |
| `mono`     | `boolean`   | Tabular numerics on body          |
| `value`    | `ReactNode` | Static read-only display          |
| `children` | `ReactNode` | Editable controls when no `value` |

## Usage

```tsx
<FormField label="Name" value={ch.name} />
<FormField label="Name">
  <TextInput variant="plain" … />
</FormField>
```

## Behaviour

- Live demos: `/styleguide/v2/forms`

## Related

- [TextInput.md](./TextInput.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
