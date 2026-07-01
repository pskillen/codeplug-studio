# Zones layer

Convex hull overlays — how a library `Zone`'s members become coloured shapes on the embedded map.

Channel filtering and the plotted-channel index are defined in [channels.md](channels.md). Membership uses UUID `EntityRef` entries on `Zone.members` — vendor-neutral, not wire names.

## Code anchors

| Symbol                 | File                                             | Role                                             |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `zoneGeolocatedPoints` | `src/core/domain/mapProjection.ts`               | Resolve zone members → lat/lon with skip reasons |
| `uniqueLatLon`         | `src/core/domain/geo.ts`                         | Dedupe sites to 5 decimal places                 |
| `convexHullLatLon`     | same                                             | Andrew's monotone chain on `[lat, lon]`          |
| `zoneColor`            | same                                             | Distinct hue per zone index                      |
| Zone hull rendering    | `src/app/components/CodeplugMap/CodeplugMap.tsx` | Circle / polyline / polygon layers               |

## Inputs — the `Zone` model

| Field     | Used for                                                                    |
| --------- | --------------------------------------------------------------------------- |
| `name`    | Tooltip, popup title                                                        |
| `members` | `EntityRef[]` — only `kind: 'channel'` entries are resolved for hull points |

Duplicate member ids within one zone are deduplicated while preserving first-occurrence order.

## Controls

| Control    | Default | Effect                          |
| ---------- | ------- | ------------------------------- |
| Draw zones | on      | When off, no hull layers render |

The fixed coordinate filters (`useLocation`, skip `0,0`) apply to hull points the same way as markers.

## Behaviour

### Member resolution

For each `members` entry with `kind: 'channel'`, `zoneGeolocatedPoints` produces a point or a skip reason:

| Condition                                        | Result                                |
| ------------------------------------------------ | ------------------------------------- |
| Member id not found in library                   | `unresolved member`                   |
| Member not in plotted set (filtered / no coords) | `filtered out or missing coordinates` |
| Channel has no `location`                        | `no coordinates`                      |
| `0, 0` with skip-zero on                         | `0,0 coordinates`                     |
| `useLocation === false`                          | `Use Location = No`                   |
| Otherwise                                        | Point `[lat, lon]` added              |

Distinct sites are deduplicated with `toFixed(5)` on lat and lon.

### Hull geometry

| Geolocated member sites | Shape          | Notes                                            |
| ----------------------- | -------------- | ------------------------------------------------ |
| 0                       | none           | Popup notes missing members                      |
| 1                       | Circle         | 2.5 km radius around the site                    |
| 2                       | Polyline       | Straight line between sites                      |
| 3+                      | Convex polygon | `convexHullLatLon` — **not** a true concave hull |

Issue text sometimes says “concave hulls”; shipped behaviour matches the codeplug-tool prototype (convex hull). True concave hulls are out of scope ([#22](https://github.com/pskillen/codeplug-studio/issues/22)).

### Popups and navigation

Zone layers show a sticky tooltip with the zone name. Popups list member count, geometry note, missing-member count, and **Edit zone** when `onZoneClick` is wired (Library → `/library/zones/:id`).

A channel may belong to multiple zones; each zone builds its hull independently.

## Related

- [channels.md](channels.md) · [map hub](README.md) · [data model — Zone](../data-model/README.md)
