# TextInput

v2 text/number input with optional label.

## Purpose

Standalone bordered input or `variant="plain"` inner control inside `FormField`.

## Props

| Prop      | Type                    | Notes                  |
| --------- | ----------------------- | ---------------------- |
| `label`   | `string`                | Optional, linked label |
| `mono`    | `boolean`               | Tabular mono numerics  |
| `variant` | `'default' \| 'plain'`  | Default bordered box   |
| …         | Native input attributes | `value`, `onChange`, … |

## Usage

```tsx
<TextInput label="Name" value={name} onChange={…} />
<FormField label="Name"><TextInput variant="plain" … /></FormField>
```

## Behaviour

- Live demos: `/styleguide/v2/forms`

## Related

- [FormField.md](./FormField.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
