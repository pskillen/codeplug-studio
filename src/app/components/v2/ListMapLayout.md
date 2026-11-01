# ListMapLayout

List + map composition for pages whose rows have a location (Channels, Zones; directory search follows) ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498)). Replaces `LibraryMapStack`. Used by Channels, Zones and the repeater directory search.

## Purpose

One component for both form factors. Desktop: the list scrolls with the page and the map is sticky and as tall as the first screen below the app chrome. Mobile: a full-screen map under a [MapSheet](./MapSheet.md) (peek / half / full) with a Map | List toggle that only snaps the sheet.

## Props

| Prop               | Type                            | Notes                                                                                                                                                                               |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `head`             | `ReactNode`                     | Page header. Above the split on desktop; top of the sheet body on mobile                                                                                                            |
| `list`             | `ReactNode`                     | Table or cards. Left pane on desktop, sheet body on mobile                                                                                                                          |
| `map`              | `ReactNode`                     | Live map, rendered once, fills its container (pass `height="100%"` to `CodeplugMap`)                                                                                                |
| `mapExtras`        | `ReactNode`                     | Controls tied to the map (e.g. Show my location). Above the map on desktop, in the sheet on mobile                                                                                  |
| `mapNote`          | `ReactNode`                     | Legend under the map on desktop; after the extras on mobile                                                                                                                         |
| `title`            | `string`                        | Mobile top bar title (next to the toggle)                                                                                                                                           |
| `sheetHeader`      | `ReactNode`                     | Mobile peek summary (e.g. "128 channels / 74 on map")                                                                                                                               |
| `initialSnap`      | `'peek' \| 'half' \| 'full'`    | Default `half`. Pass `full` when nothing is on the map so the sheet starts as the list                                                                                              |
| `sheetLabel`       | `string`                        | Accessible name of the sheet                                                                                                                                                        |
| `desktopClassName` | `string`                        | Class for the desktop root (page padding)                                                                                                                                           |
| `mobile`           | `'sheet' \| 'stack' \| 'swipe'` | `sheet` (default): full-screen map under the bottom sheet, full-bleed route. `stack`: map above the list in normal flow, for pages that scroll a long form first (directory search) |

## Usage

```tsx
<DesignSystemV2Provider>
  <ListMapLayout
    desktopClassName={pageClasses.page}
    title="Channels"
    head={<LibraryInventoryHeader title="Channels" actions={actions} />}
    list={table}
    map={<CodeplugMap channels={channels} height="100%" />}
    mapExtras={<UseMyLocationButton />}
    sheetHeader={<Summary />}
  />
</DesignSystemV2Provider>
```

## Behaviour

- Desktop map height comes from `stickyMapHeight` (`lib/stickyMapHeight.ts`): the viewport minus the space above the pane, clamped to at least 360 px and at most the viewport minus gutters. It is re-measured on resize and when the page body changes size. The list pane scrolls horizontally if its table is wider than the pane.
- Mobile fills the viewport, so the route must be full-bleed on mobile: add it to `MOBILE_FULL_BLEED_PATHS` in `src/app/nav/fullBleedRoutes.ts`. The page root must be the `DesignSystemV2Provider` (AppLayout passes the height through its scope div).
- The mobile map's own toolbar (label / zone toggles, Map settings link) is a single scrollable row above the edge-to-edge map.
- The Map | List toggle maps Map to `peek` and List to `full`; `half` counts as Map.

## Experimental: `mobile="swipe"`

Dev-only experiment, used by the Channels list only. Instead of the bottom sheet, mobile shows two side-by-side full-height panes (list left, map right, each 88% of the width) in a CSS scroll-snap track (`scroll-snap-type: x mandatory`), so a swipe always settles on one pane. The other pane peeks in at the screen edge (about 12%, 48 px on a 390 px phone). The route must still be full-bleed on mobile.

- The visible map sets `touch-action: none` so Leaflet keeps its own pan and zoom; dragging across the map never swipes the track.
- Switching panes: swipe or tap the peeking strip (a transparent button covers the inactive pane, `Show list` / `Show map`), or use the Map | List toggle in the top bar, which follows the current pane.
- Grab handle: each peek button draws a vertical pill (5 x 48 px) with a small chevron, centred vertically on the seam edge of the peeking pane (left edge of the peeking map, right edge of the peeking list). It is decorative (`aria-hidden`); the button is the control (`Show map` / `Show list`), its hit area is the whole 48 px strip, and `touch-action: pan-x` lets a drag on it swipe the track while a tap switches panes. Keyboard focus draws a ring around the handle. Colours come from DSV2 tokens, so it works in light and dark.
- On the map pane the map's option row (labels, zones, Map settings) wraps within the pane instead of scrolling off the right edge.
- The list pane scrolls vertically on its own. Smooth scrolling is off under `prefers-reduced-motion`.
- On becoming the map pane the layout dispatches a window `resize` so Leaflet re-measures.
- `sheetHeader` and `initialSnap` are ignored in this mode.

## Related

- [docs/features/map/README.md](../../../../docs/features/map/README.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
