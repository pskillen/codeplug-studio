# SearchInput

Filter-bar search with icon and optional detected-tag Pill.

## Purpose

Channels list name/callsign filter and similar list filter bars.

## Props

| Prop          | Type     | Notes               |
| ------------- | -------- | ------------------- |
| `value`       | `string` | Input value         |
| `onChange`    | handler  | Input change        |
| `placeholder` | `string` | Default `Search…`   |
| `detectedTag` | `string` | Suffix neutral Pill |

## Usage

```tsx
<SearchInput value={q} onChange={…} detectedTag={activeFilter} />
```

## Behaviour

- Live demos: `/styleguide/forms`

## Related

- [Pill.md](./Pill.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
