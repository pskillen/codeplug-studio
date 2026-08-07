# CountryComboboxField

## Purpose

Country typeahead for directory filter forms — v2 `Combobox` inside `FormField`, backed by `REPEATERBOOK_COUNTRY_NAMES`.

## Props

| Prop          | Type                      | Description                    |
| ------------- | ------------------------- | ------------------------------ |
| `label`       | `string`                  | Form field label               |
| `value`       | `string`                  | Current input / selected value |
| `onChange`    | `(value: string) => void` | Input and selection handler    |
| `placeholder` | `string`                  | Optional combobox placeholder  |
| `hint`        | `string`                  | Optional field hint            |
| `className`   | `string`                  | Optional wrapper class         |

## Behaviour

- Filters the shared country list client-side (max 20 options)
- Used on RepeaterBook and RadioID directory search filters (mk2 C5)

## Related

- [Combobox](../v2/Combobox.md)
- [repeater-directories](../../../docs/features/repeater-directories/README.md)
