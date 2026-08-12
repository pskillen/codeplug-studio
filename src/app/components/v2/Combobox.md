# Combobox

Async search-select with committed and searching states.

## Purpose

Location/address, airport, and repeater-style typeahead pickers. Two visual states: committed (a chip-like row with the selected label and a "Change" link) vs. searching (bordered input + floating results dropdown).

## Props

| Prop            | Type                                       | Notes                                                                    |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `value`         | `ComboboxOption<T> \| null`                | Committed selection — renders the committed chip state when set          |
| `inputValue`    | `string`                                   | Required                                                                 |
| `onInputChange` | `(value: string) => void`                  | Required                                                                 |
| `options`       | `ComboboxOption<T>[]`                      | Required — `{ value, label, sublabel? }`                                 |
| `loading`       | `boolean`                                  | Shows a spinner in the input                                             |
| `onSelect`      | `(option: ComboboxOption<T>) => void`      | Required                                                                 |
| `placeholder`   | `string`                                   | Default `Search…`                                                        |
| `emptyMessage`  | `string`                                   | Default `No results`                                                     |
| `renderOption`  | `(option: ComboboxOption<T>) => ReactNode` | Custom option rendering                                                  |
| `onClear`       | `() => void`                               | Shows the "Change" link in the committed state; clears back to searching |
| `icon`          | `ReactNode`                                | Leading icon for both states. Default search icon                        |

## Usage

```tsx
import { Combobox, DesignSystemV2Provider } from '@app/components/v2';

<DesignSystemV2Provider>
  <Combobox
    value={selected}
    inputValue={query}
    onInputChange={setQuery}
    options={results}
    loading={searching}
    onSelect={setSelected}
    onClear={() => setSelected(null)}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Dropdown opens on input focus while `inputValue` is non-empty; closes on outside click (`mousedown` listener) or option select.
- **Generalized icon, not location-specific**: the mk2 DS bundle hardcodes a map-pin icon for the committed state (its only worked example is a location picker). This component accepts an `icon` prop instead, defaulting to a search icon, so non-location consumers aren't stuck with a pin. Live consumers: `GeocodeCentreField` on zone-from-location ([#943](https://github.com/pskillen/codeplug-studio/issues/943)) and grow-zone recommendations.
- Live demos: `/styleguide/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
