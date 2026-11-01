# MapToolLayout

Responsive shell for the Field tools: controls beside a full-height map on desktop, a map under a bottom sheet on mobile.

## Purpose

My locator, Distance & bearing and Nearby repeaters share one layout so they behave the same at every width. It relies on the app layout giving `/tools/*` a viewport-height, un-padded content area (`src/app/nav/fullBleedRoutes.ts`).

## Props

| Prop             | Type                 | Notes                                                                                             |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `map`            | `ReactNode`          | Rendered once; should fill its container (`FieldMap`)                                             |
| `title`          | `string`             | Heading in the desktop column (and above the stacked mobile page)                                 |
| `description`    | `ReactNode`          | Under the heading                                                                                 |
| `children`       | `ReactNode`          | Controls and results: left column on desktop, sheet body on mobile                                |
| `mobile`         | `'sheet' \| 'stack'` | `sheet` (default): full-screen map + `MapSheet`. `stack`: scrolling page with a 260px map         |
| `sheetHeader`    | `ReactNode`          | Always-visible sheet summary                                                                      |
| `initialSnap`    | `MapSheetSnap`       | Default `half`                                                                                    |
| `desktopLead`    | `ReactNode`          | Under the heading on desktop only (e.g. the readout the sheet shows as its header)                |
| `showViewToggle` | `boolean`            | Floating Map \| List toggle that snaps the sheet (Map = peek, List = full)                        |
| `mapOverlay`     | `ReactNode`          | Chip over the top-left of the mobile map                                                          |
| `mapHint`        | `ReactNode`          | Pill over the bottom of the desktop map                                                           |
| `afterMap`       | `ReactNode`          | Content after `children`: below the map in `stack` mode, below the controls in the desktop column |

## Behaviour

- Breakpoint is the shared `MOBILE_MAX_WIDTH_MEDIA_QUERY` (48em).
- Desktop: 420px left column that scrolls on its own; the map fills the remaining width and height.
- Mobile `sheet`: the Map | List toggle and `MapSheet` share one snap state.

## Related

- [MapSheet](../v2/MapSheet.md), [FieldMap](./FieldMap.md), [PlaceInput](./PlaceInput.md)
- [docs/features/field-tools/README.md](../../../../docs/features/field-tools/README.md)
