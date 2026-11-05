# ListMapLayout

List + map composition for pages whose rows have a location (Channels, Zones, repeater directory search) ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498)). Replaces `LibraryMapStack`. Used by Channels, Zones and the repeater directory search.

## Purpose

One component for both form factors. Desktop: the controls and list scroll with the page and the map is sticky and as tall as the first screen below the app chrome. Mobile: **list | map swipe panes** with the page controls in a bottom [MapSheet](./MapSheet.md) that overlays both panes.

## Props

| Prop                   | Type                         | Notes                                                                                                                                                           |
| ---------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `head`                 | `ReactNode`                  | Page header. Above the split on desktop; top of the controls sheet on mobile                                                                                    |
| `notices`              | `ReactNode`                  | Feedback about the list (bulk-edit result, sort hint). Top of the list pane on both form factors, above `controls`                                              |
| `controls`             | `ReactNode`                  | Filters, search, view switches. Top of the list pane on desktop; in the controls sheet on mobile                                                                |
| `listHeadControls`     | `ReactNode`                  | Mobile only: controls pinned at the top of the list pane, above the list (search, filters), so active filters are never hidden in the sheet. Ignored on desktop |
| `list`                 | `ReactNode`                  | Table or cards. Left pane on desktop, the list swipe pane on mobile (it starts straight at the table)                                                           |
| `map`                  | `ReactNode`                  | Live map, rendered once, fills its container (pass `height="100%"` to `CodeplugMap`)                                                                            |
| `mapExtras`            | `ReactNode`                  | Controls tied to the map (e.g. Show my location). Above the map on desktop, in the controls sheet on mobile                                                     |
| `mapNote`              | `ReactNode`                  | Legend under the map on desktop; after the extras in the controls sheet on mobile                                                                               |
| `title`                | `string`                     | Mobile top bar title (next to the Map \| List toggle)                                                                                                           |
| `controlsSummary`      | `ReactNode`                  | One line in the sheet's peek bar, e.g. "128 channels · 3 filters". Tapping it opens the sheet                                                                   |
| `controlsAction`       | `ReactNode`                  | Compact action at the right of the peek bar (a small `Button`, e.g. New or Search)                                                                              |
| `initialControlsSnap`  | `'peek' \| 'half' \| 'full'` | Default `peek`                                                                                                                                                  |
| `controlsSnap`         | `'peek' \| 'half' \| 'full'` | Controlled snap. The directory search uses it to open at `full` and drop to `peek` when results arrive                                                          |
| `onControlsSnapChange` | `(snap) => void`             | Fired on every snap change, controlled or not                                                                                                                   |
| `sheetLabel`           | `string`                     | Accessible name stem: panes are "X list" / "X map", the sheet "X controls"                                                                                      |
| `desktopClassName`     | `string`                     | Class for the desktop root (page padding)                                                                                                                       |

## Usage

```tsx
<DesignSystemV2Provider>
  <ListMapLayout
    desktopClassName={pageClasses.page}
    title="Channels"
    head={<LibraryInventoryHeader title="Channels" actions={actions} />}
    controls={<FiltersAndSearch />}
    list={table}
    map={<CodeplugMap channels={channels} height="100%" />}
    mapExtras={<UseMyLocationButton />}
    controlsSummary="128 channels · 3 filters"
    controlsAction={<Button size="sm">New</Button>}
  />
</DesignSystemV2Provider>
```

## Behaviour

- Desktop map height comes from `stickyMapHeight` (`lib/stickyMapHeight.ts`): the viewport minus the space above the pane, clamped to at least 360 px and at most the viewport minus gutters. It is re-measured on resize and when the page body changes size. The list pane scrolls horizontally if its table is wider than the pane.
- Desktop split: list and map share the width 1.7 : 1, and the map pane never drops below `min(420px, 40%)` (the list gives way first). The routes in `MOBILE_FULL_BLEED_PATHS` also skip AppLayout's centred 75% column on desktop (`isWideDesktopPath`), so the split gets the whole window ([#1524](https://github.com/pskillen/codeplug-studio/issues/1524)).
- Mobile fills the viewport, so the route must be full-bleed on mobile: add it to `MOBILE_FULL_BLEED_PATHS` in `src/app/nav/fullBleedRoutes.ts` (Channels, Zones and the UK, IRTS and RepeaterBook directory searches today). The page root must be the `DesignSystemV2Provider` (AppLayout passes the height through its scope div).
- The mobile map's own toolbar (label / zone toggles, Map settings link) wraps within the map pane.

## Mobile: swipe panes

Two side-by-side full-height panes (list left, map right, each 92% of the width) in a CSS scroll-snap track (`scroll-snap-type: x mandatory`), so a swipe always settles on one pane. The other pane peeks in at the screen edge (about 8%, 31 px on a 390 px phone).

- The visible map sets `touch-action: none` so Leaflet keeps its own pan and zoom; dragging across the map never swipes the track.
- Switching panes: swipe or tap the peeking strip (a transparent button covers the inactive pane, `Show list` / `Show map`), or use the Map | List toggle in the top bar, which follows the current pane.
- Grab handle: one solid tab (24 x 64 px, `--dsv2-surface` fill, `--dsv2-border` outline, popover shadow) straddling the seam between the active pane and the peeking one, with a chevron pointing the way it will go and two grip lines. It is a single `Show map` / `Show list` button with a 44 x 88 px hit area, living in a zero-width sticky anchor that is the first child of the scroll track, so a horizontal drag on it scrolls the track (`touch-action: pan-x`) and a tap switches panes. It sits at 92% of the track width while the list shows and 8% while the map shows (container query units). The peek strips themselves stay tappable and draggable but are hidden from assistive tech. Keyboard focus draws a ring around the tab.
- On the map pane the map's option row wraps within the pane instead of scrolling off the right edge.
- The list pane scrolls vertically on its own. Smooth scrolling is off under `prefers-reduced-motion`.
- On becoming the map pane the layout dispatches a window `resize` so Leaflet re-measures.
- Seam dead zone: a transparent, `aria-hidden` strip (24 px wide, full pane height, `touch-action: pan-x`) in the same sticky anchor, on the active pane's side of the seam under the handle tab. Taps and clicks there never reach the table or map beneath (e.g. the Channels row delete button). Horizontal drags in it still swipe between panes; a vertical drag starting in it does not scroll the list (accepted trade-off). The list pane has `padding-right` equal to the strip (`--swipe-dead`), so the table's horizontal scroller ends clear of it. On the map side Leaflet's left controls get the same margin so the zoom buttons stay clear.

## Mobile: controls sheet

`head`, `mapExtras`, `mapNote` and `controls` live in a [MapSheet](./MapSheet.md) (`compact`, `backdrop`, `toggleOnTap`) that overlays the bottom of both panes, above the tab bar. It is only rendered when there is something to put in it.

- **Peek (default, 56 px):** grabber plus one line: the `controlsSummary` text (a button; tap to open) and the `controlsAction`. The list pane's bottom padding and the map pane's bottom edge both clear the peek bar (`--controls-peek`), so the last row is reachable and the map attribution stays visible. Page-specific choice: Channels and Zones show "N channels · M filters" / "N zones" with a compact **New** button; directory search shows "Search <source>" or "N results · M selected" with **Search** (or **Add (n)** once rows are selected). The search box stays in the sheet rather than the peek bar.
- **Half / full:** the full controls, scrolling inside the sheet, with a dimmed backdrop. Tapping the backdrop, the summary or the grabber collapses to peek (a grabber tap toggles peek and half); dragging the grabber resizes it.
- The sheet covers only the bottom of the seam handle's column, which is vertically centred, so the handle and dead zone keep working at peek. While the sheet is open the backdrop swallows input to the panes.
- The table's own count row and "Show/hide cols" button are part of `DataTable` and stay at the top of the list pane.

## Related

- [docs/features/map/README.md](../../../../docs/features/map/README.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
