# LibraryMapStack

**Purpose:** C7 list + map composition for library list pages — stacked (Channels) or split (Zones), with an optional mobile collapse toggle for the map pane.

## Props

| Prop              | Type                   | Notes                                                                                                   |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `layout`          | `'stacked' \| 'split'` | `stacked`: map below list on all widths. `split`: list + map side by side on desktop, stacked on mobile |
| `list`            | `ReactNode`            | List pane content                                                                                       |
| `map`             | `ReactNode`            | Map pane content — typically a [MapPanel](../v2/MapPanel.md) wrapping a live map                        |
| `mobileMapToggle` | `boolean`              | Default `true`. When true, narrow viewports show a Show map / Hide map toggle above the map pane        |
| `className`       | `string`               | Optional root class                                                                                     |

## Usage

```tsx
<LibraryMapStack layout="stacked" list={listContent} map={mapContent} />
```

## Behaviour

- On mobile (`mobileMapToggle` true), the map pane is **visible by default** — it starts expanded so nearby-repeater/geographic context is discoverable immediately, and can be collapsed via the "Hide map" toggle.
- On desktop, or when `mobileMapToggle` is false, the map always renders (toggle row is not shown).
- `split` layout on desktop renders list and map as flex siblings; on mobile it falls back to the same stacked + toggle behaviour as `stacked`.
- On mobile, the map pane bleeds to the viewport edge (negative margin cancelling `--dsv2-page-padding-x`) instead of sitting inset inside the page gutter — small screens are scarce real estate and the map is the one element on these pages worth going edge-to-edge for. Callers should pass a taller `height` on the `MapPanel` child at mobile widths (e.g. `height={isMobile ? 560 : 420}`) so the extra width isn't paired with a cramped, wide-but-short map.

## Related

- [docs/features/map/README.md](../../../../docs/features/map/README.md)
- [MapPanel](../v2/MapPanel.md)
