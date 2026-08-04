# ToggleSwitch

Hand-built on/off switch matching DS reference.

## Purpose

Skip-scan, show-on-map, and similar boolean toggles in channel editor sections.

## Props

| Prop       | Type        | Notes           |
| ---------- | ----------- | --------------- |
| `checked`  | `boolean`   | On state        |
| `onChange` | `(b) => void` | Toggle handler  |
| `label`    | `ReactNode` | Optional label  |

## Usage

```tsx
<ToggleSwitch checked={skip} onChange={setSkip} label="Skip scan" />
```

## Behaviour

- Live demos: `/styleguide/v2/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
