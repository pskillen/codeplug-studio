# Zones layer

Convex hull overlays — how a library `Zone`'s members become coloured shapes on the embedded map.

Channel filtering and the plotted-channel index are defined in [channels.md](channels.md). Membership uses `Zone.members` (`kind: 'channel'` and/or nested `kind: 'zone'`) — vendor-neutral, not wire names. Map hulls resolve the **effective** (flattened) channel set via `resolveEffectiveZoneChannelIds` — see [nested-zones.md](../library/nested-zones.md).

## Code anchors

| Symbol                           | File                                             | Role                                                   |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `resolveEffectiveZoneChannelIds` | `src/core/domain/zoneHierarchy.ts`               | Flatten nested zones → channel ids for hulls           |
| `zoneGeolocatedPoints`           | `src/core/domain/mapProjection.ts`               | Resolve effective channels → lat/lon with skip reasons |
| `uniqueLatLon`                   | `src/core/domain/geo.ts`                         | Dedupe sites to 5 decimal places                       |
| `convexHullLatLon`               | same                                             | Andrew's monotone chain on `[lat, lon]`                |
| `zoneColor`                      | same                                             | Distinct hue per zone index                            |
| `selectChannelsWithinRadius`     | `src/core/domain/proximityZone.ts`               | Channels within radius of a point (zone-from-location) |
| Zone hull rendering              | `src/app/components/CodeplugMap/CodeplugMap.tsx` | Circle / polyline / polygon layers                     |

## Inputs — the `Zone` model

| Field     | Used for                                                                  |
| --------- | ------------------------------------------------------------------------- |
| `name`    | Tooltip, popup title                                                      |
| `members` | Channel and/or nested zone refs — flattened to channels for hull geometry |

Duplicate member ids within one zone are deduplicated while preserving first-occurrence order.

## Controls

### Standard map (`mapControlMode: 'standard'`)

| Control    | Default | Effect                          |
| ---------- | ------- | ------------------------------- |
| Draw zones | on      | When off, no hull layers render |

### Zone emphasis maps (`zoneEmphasis` / `zoneFromLocation`)

Used on the zone editor and **zone from location** page.

| Control          | Default | Effect                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------- |
| Draw this zone   | on      | Solid hull for the editing zone (`emphasisZoneId`)                        |
| Draw new zone    | on      | Dashed provisional hull from selected channel coords (from-location only) |
| Draw other zones | on      | Muted grey hulls for other library zones (~45% stroke opacity)            |

**Proximity preview** (zone from location): `referencePosition` + `referenceRadiusM` draw a centre pin and radius circle; `dimmedChannelIds` lowers marker opacity for channels outside the radius.

The fixed coordinate filters (`useLocation`, skip `0,0`) apply to hull points the same way as markers.

## Behaviour

### Member resolution

For the **effective channel set** (including channels from nested child zones), `zoneGeolocatedPoints` produces a point or a skip reason per channel id:

| Condition                                        | Result                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Member id not found in library                   | `unresolved member`                                        |
| Member not in plotted set (filtered / no coords) | `filtered out or missing coordinates` or `hidden from map` |
| Channel has no `location`                        | `no coordinates`                                           |
| `0, 0` with skip-zero on                         | `0,0 coordinates`                                          |
| `useLocation === false`                          | `Use Location = No`                                        |
| `hideFromInternalMap === true`                   | `hidden from map`                                          |
| Otherwise                                        | Point `[lat, lon]` added                                   |

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
