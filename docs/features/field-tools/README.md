# Field tools

Tier-1 reference for the three map-first tools under **Tools**: **My locator**, **Distance & bearing** and **Nearby repeaters**. None needs an open project and none writes to a project; the only write is an explicit **+ Add** of a repeater to the open project's library. Nearby remembers its filter choices in this browser.

**Tracking:** [#1497](https://github.com/pskillen/codeplug-studio/issues/1497) (tools + nearby repeaters) · bottom-sheet reuse [#1498](https://github.com/pskillen/codeplug-studio/issues/1498) · Meshtastic source and remembered filters [#1518](https://github.com/pskillen/codeplug-studio/issues/1518) · earlier Maidenhead page [#29](https://github.com/pskillen/codeplug-studio/issues/29), [#490](https://github.com/pskillen/codeplug-studio/issues/490)

**Source:** `src/app/routes/tools/`, `src/app/components/FieldTools/`, `src/app/components/v2/MapSheet.tsx`, `src/core/domain/fieldGeo.ts`

## Implementation status

| Area                                      | Status      | Notes                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| My locator (`/tools/locator`)             | Shipped     | GPS on open; big locator, coordinates, accuracy; 4/6/8 precision chips; Copy, Share (Web Share API, else copies), Refresh; square outlined on map                                                                                    |
| Locator lookup box                        | Shipped     | Locator, address or postcode (and library channel when a project is open); map click also moves the point                                                                                                                            |
| Cross-links                               | Shipped     | "Distance from here →" (`/tools/bearing?alat&alon`), "Repeaters near here →" (`/tools/nearby?lat&lon`), "Repeaters near B →"                                                                                                         |
| Distance & bearing (`/tools/bearing`)     | Shipped     | Draggable A/B pins, map click moves B, A defaults to GPS, swap, distance in mi/km, bearing A→B with compass point, return bearing                                                                                                    |
| Shareable bearing URL                     | Shipped     | `alat alon al blat blon bl` params, mirrored with `replace`                                                                                                                                                                          |
| Library channel as a point                | Shipped     | Callsign or name of a located channel, only when a project is open                                                                                                                                                                   |
| Nearby repeaters (`/tools/nearby`)        | Shipped     | Point (GPS, address, locator, pin drag or map click), radius chips, source chips, band/mode/operational filters, nearest first with distance and bearing                                                                             |
| Nearby: numbered markers, ring, selection | Shipped     | Row and marker highlight each other; radius ring; reference pin; markers coloured by mode                                                                                                                                            |
| Nearby: ukrepeater.net source             | Shipped     | One `locator/<4-char>` request per square the radius touches; ranked client-side                                                                                                                                                     |
| Nearby: My library source                 | Shipped     | Open project's channels with `useLocation` and coordinates                                                                                                                                                                           |
| Nearby: + Add and bulk add                | Shipped     | Only with a project; `repeaterListingToChannel` + `persistence.putChannel`; callsign already in library shows "In library"                                                                                                           |
| Nearby: Meshtastic source                 | Shipped     | Meshflow public nearby endpoint ([meshflow-api#432](https://github.com/pskillen/meshflow-api/issues/432)); display only, no + Add; band/mode chips do not apply; off by default; notes for a radius over 100 km and the 500-node cap |
| Nearby: remembered filters                | Shipped     | Radius, sources, band/mode/operational stored in localStorage (`mm9pdy-codeplug-studio.list.nearby`) like Channels list prefs; the point is not stored; a URL with filter params wins                                                |
| Nearby: IRTS source                       | Outstanding | The IRTS catalogue (Anytone CSV) carries no coordinates, so it cannot be queried around a point                                                                                                                                      |
| Nearby: RepeaterBook source               | Outstanding | Needs a per-user token and a state/country query, not a point; a bounding-box query would need a new client                                                                                                                          |
| Nearby: BrandMeister source               | Outstanding | Callsign-only lookup; no geographic query                                                                                                                                                                                            |
| Desktop layout                            | Shipped     | 420px scrolling left column; map fills the rest of the viewport under the chrome                                                                                                                                                     |
| Mobile layout                             | Shipped     | Full-screen map under a [MapSheet](../../../src/app/components/v2/MapSheet.md) (peek / half / full); Map \| List toggle snaps it                                                                                                     |
| `/reference/maidenhead` redirect          | Shipped     | `?mode=bearing` / `?tab=bearing` go to `/tools/bearing`, everything else to `/tools/locator`                                                                                                                                         |
| Distance unit preference                  | Shipped     | km / mi chips; stored as `codeplug-studio:distanceUnit`, default miles                                                                                                                                                               |

## Purpose

Quick answers in the field: "what is my locator?", "how far and which way to that repeater?", "what can I hit from here?". They are tools, not library flows: opening one asks for GPS (where it makes sense) and shows a result. State lives in the URL so a link reproduces the view; nothing is written to the project. Nearby also remembers its radius, source and filter chips in this browser (never the search point).

## Layout

| Breakpoint       | Layout                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop (> 48em) | Fixed 420px left column (controls + results) that scrolls on its own; the map fills the remaining width and the viewport height below the app chrome         |
| Mobile (≤ 48em)  | Distance & bearing and Nearby: full-screen map behind a bottom sheet; My locator: scrolling page with a short map. The bottom tab bar shows **Tools** active |

`/tools/*` is a full-bleed route (`src/app/nav/fullBleedRoutes.ts`): `AppLayout` locks the shell to `100dvh`, removes the content padding and 75% width, and hides the build footer so the map owns the space.

## The three tools

### My locator

Requests GPS on open (unless the URL carries `lat`/`lon`), then shows the locator at the chosen precision (4, 6 or 8 characters; casing `IO75ui`), coordinates and `±accuracy`. **Copy** copies the locator; **Share** uses `navigator.share` with locator and coordinates, falling back to the clipboard; **Refresh** re-reads GPS. The map outlines the locator square; click the map or use the lookup box to look somewhere else.

### Distance & bearing

Point **A** defaults to GPS (label "My location") unless the URL has A. Each of A and B accepts a locator, an address or postcode, or a library channel callsign/name (project open). Clicking the map moves B; either pin can be dragged. The readout shows distance in the chosen unit with the other unit beneath, the bearing A → B with compass octant, and the return bearing. Metrics reuse `pathMetricsBetween` from `geoDistance.ts`.

### Nearby repeaters

Choose a point, then radius, sources and filters. Results are the union of the selected sources within the radius, sorted nearest first (`rankByDistance`), capped at 60 rows with a note when more exist. Library channels whose callsign also appears in the directory results are folded into the directory row. Rows show band and mode pills, receive frequency, distance and bearing; **In library** replaces **+ Add** when the callsign is already in the project.

**Marker colours.** Markers use the shared mode colours from [channel modes](../../reference/channel-modes.md): a repeater's first mode, `other` when it has none, and the reserved `meshtastic` colour for mesh nodes.

**Meshtastic rows.** The **Meshtastic** source chip adds Meshtastic routers and repeaters heard in the last 30 days, from [Meshflow](../../reference/remote-directories/meshflow/README.md). They are ordinary rows and numbered markers, ranked with the others. Each shows the node's short name (bold), long name, and `Role · heard 3 h ago`. They have no frequency, band or mode pills, and no **+ Add**; they never count towards bulk add. The chip is **off by default** (the page is about amateur repeaters, rows are capped at 60, and the search point is only sent to Meshflow when you ask). The band and mode chips do not apply to mesh rows (they have no amateur band or mode), and **Operational** keeps them; the Meshtastic chip is the only control for them. Meshflow searches at most 100 km, so a larger radius shows a note; if Meshflow caps the list at its nearest 500 nodes, another note says so. A Meshflow failure shows its own alert and the other sources still render.

URL params: `lat lon pl` (point and label), `r` (radius in km), `s` (`ukrepeater,library,meshtastic`, or `none`), `b` (band ids), `m` (modes), `op=1` (operational only).

**Remembered filters.** Radius, sources, band, mode and operational choices are stored globally (not per project) under `mm9pdy-codeplug-studio.list.nearby`, through `@integrations/listPrefs`. Opening `/tools/nearby` with none of `r s b m op` in the URL applies the stored choices (the search point params are ignored for this check); a URL that carries any of them wins and leaves storage alone until you change a chip. After that the URL is the only source, so clearing a chip does not bring the old value back. Stored values are validated against the page's known sources, bands and modes, so stale data falls back to defaults. The search point is never stored: GPS or a search sets it on each visit.

## Boundaries

- Pure maths and parsing live in `src/core/domain/fieldGeo.ts` (ranking, distance/bearing labels, locator square bounds, covering 4-character squares, URL point parsing) with Vitest coverage; core stays free of React.
- Directory access goes through `@integrations/repeaters` (`searchUkRepeatersByLocator`) with its existing session cache and rate-limit gate; the unit preference goes through `@integrations/preferences`.
- Meshflow access goes through `@integrations/meshflow` (session cache plus rate-limit gate); it owns the wire shape, request rounding and role humanising, and the app only sees a normalised node. Remembered filters go through `@integrations/listPrefs`.
- Adding a repeater reuses the directory import path (`repeaterListingToChannel`, `persistence.putChannel`) and the callsign-only duplicate gate from [repeater-directories](../repeater-directories/README.md).

## Code anchors

| Path                                                    | Role                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/app/routes/tools/LocatorPage.tsx`                  | My locator                                                       |
| `src/app/routes/tools/BearingPage.tsx`                  | Distance & bearing                                               |
| `src/app/routes/tools/NearbyPage.tsx`                   | Nearby repeaters                                                 |
| `src/app/routes/tools/MaidenheadRedirectPage.tsx`       | `/reference/maidenhead` redirect                                 |
| `src/app/components/FieldTools/`                        | `FieldMap`, `MapToolLayout`, `PlaceInput` (sidecars alongside)   |
| `src/app/components/v2/MapSheet.tsx`, `mapSheetSnap.ts` | Three-snap bottom sheet and its pure snap logic                  |
| `src/app/lib/resolvePlace.ts`                           | Locator → library channel → geocode resolution                   |
| `src/app/lib/nearbyRepeaters.ts`                        | Merge directory listings and library channels; band/mode filters |
| `src/app/hooks/useUkRepeatersNear.ts`                   | Per-square ukrepeater.net requests around a point                |
| `src/app/hooks/useMeshtasticNodesNear.ts`               | Meshflow request around a point (only when the source is on)     |
| `src/app/hooks/useNearbyQuery.ts`                       | Nearby filters: URL params, hydration from and writes to storage |
| `src/integrations/meshflow/`                            | Meshflow client, wire mapping, cache and rate limit              |
| `src/app/lib/listPrefs/urlSync.ts`                      | Nearby prefs to and from URL params                              |
| `src/core/domain/fieldGeo.ts`                           | Ranking, units, locator bounds, URL point parsing                |

## Manual verify

1. Open `/tools/locator` and allow location: locator, coordinates and accuracy appear; the square is outlined. Switch precision chips; Copy; Refresh.
2. Open `/tools/bearing`: A is "My location". Click the map: B moves and the distance, bearing and return bearing update. Drag a pin; swap; reload the shared URL.
3. Open `/tools/nearby`: ukrepeater.net results appear nearest first with a ring on the map. Click a row, then a marker: both highlight together. Change radius, band and mode chips.
4. Import `test-data/export-smoke/rich-project.yaml`: **My library** and **+ Add** appear; adding a repeater flips its row to **In library**.
5. Turn on **Meshtastic** (needs Meshflow reachable, or `VITE_MESHFLOW_API_BASE_URL` pointing at a local one): node rows appear ranked in with the others, with short name, long name and `Role · heard … ago`, and no **+ Add**. Select **2m** and **DMR**: mesh rows stay. Choose 100 mi: the "only within 100 km" note appears.
6. Reload `/tools/nearby` with no filter params: radius, source and filter chips come back as you left them, while the point comes from GPS or search. Open `/tools/nearby?lat=55.86&lon=-4.25&s=ukrepeater`: the URL wins.
7. On a phone-width viewport, drag the sheet handle between peek, half and full; the Map | List toggle snaps it to peek and full.
8. Visit `/reference/maidenhead` and `/reference/maidenhead?mode=bearing`: both redirect.

## Related

- [maidenhead.md](../maidenhead.md) · [repeater-directories](../repeater-directories/README.md) · [map](../map/README.md) · [reference](../reference/README.md) · [design-system-v2](../design-system-v2/README.md)
