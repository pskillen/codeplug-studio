# Maidenhead locator conversion

Conversion between Maidenhead grid locators and WGS84 coordinates — shared `core` domain helper used by the Maidenhead reference tool, repeater import, and the channel map.

**Tracking:** [#29](https://github.com/pskillen/codeplug-studio/issues/29) · Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12)

## Purpose

### Reference tool (`/reference/maidenhead`)

Operators can convert locators and coordinates ad hoc without an active project:

- Locator ↔ coordinates at selectable precision (4 / 6 / 8 / 10 characters)
- Map click and drag marker (`MapLocationPicker`)
- Device geolocation via **Use my location**
- Address geocode (Photon by default; Mapbox when a token is set in Settings)
- Channel lookup when a project is active (seeds from channel `location`)

The [band plan](../reference/bands.md) lives at `/reference/bands`.

### Repeater import

When importing from [repeater directories](repeater-directories/README.md), records that carry a Maidenhead locator or lat/lng seed channel `location` and `useLocation` via the same helpers.

### Channel map

The [map](map/README.md) plots channels that have a stored location. Operator **You** marker appears when **Show my location** is used on library list maps.

## Code anchors

| Path                                                   | Role                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/core/domain/maidenhead.ts`                        | `locatorToCoords`, `coordsToLocator`, `isValidLocator` (4–10 char) |
| `src/app/routes/reference/MaidenheadReferencePage.tsx` | Full converter UI                                                  |
| `src/app/components/MapLocationPicker/`                | Click/drag map picker                                              |
| `src/integrations/geocode/`                            | Photon + Mapbox geocode client                                     |
| `src/integrations/preferences/`                        | Mapbox token in `localStorage`                                     |
| `src/app/hooks/useMapSettings.ts`                      | Settings ↔ preferences bridge                                      |
| `src/app/lib/channelLookup.ts`                         | Channel autocomplete helpers                                       |
| `src/integrations/repeaters/ukRepeaterClient.ts`       | Locator/coords when normalising repeater records                   |

## Inputs and outputs

| Direction        | Input                                                  | Output                                |
| ---------------- | ------------------------------------------------------ | ------------------------------------- |
| Locator → coords | 4, 6, 8, or 10-character Maidenhead (case-insensitive) | Centre of the finest specified square |
| Coords → locator | WGS84 lat/lon + precision                              | Locator at chosen precision           |

## Behaviour

- Invalid characters or length → validation message on the converter; `locatorToCoords` returns `null`.
- Southern/western hemispheres: negative lat/lon handled per standard Maidenhead rules.
- Precision: 4 = field; 6 = square (~5 km); 8 = subsquare; 10 = cell.
- Geocode: Photon needs no token; Mapbox requires token in Settings → Map.
- Channel picker disabled without an active project; uses UUID `id` refs, not wire names.

## Manual verify

1. Visit `/reference/maidenhead` (no active project required for converter/geocode).
2. Enter `IO91WM` → coordinates near London appear.
3. Change precision → locator length updates.
4. Click map / drag marker / **Use my location** → fields stay in sync.
5. Geocode a postcode (Photon); set Mapbox token in Settings and retry with Mapbox.
6. With a project active, search a channel with coordinates → **Use location**.

## Known gaps

- No `maidenheadLocator` field on channels ([#28](https://github.com/pskillen/codeplug-studio/issues/28)) — picker uses `location` only.
- No Maidenhead grid overlay on the reference map picker.
- Channel editor does not yet accept locator input (coordinates only when editing).

## Related

- [reference/](reference/README.md) · [map](map/README.md) · [repeater-directories](repeater-directories/README.md) · [bands reference](../reference/bands.md)
