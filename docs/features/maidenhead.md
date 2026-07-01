# Maidenhead locator conversion

Conversion between Maidenhead grid locators and WGS84 coordinates — shared `core` domain helper used by the `/reference` page, repeater import, and the channel map.

**Tracking:** Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)) · shipped in [PR #15](https://github.com/pskillen/codeplug-studio/pull/15)

## Purpose

### Reference page (`/reference`)

Operators can convert locators and coordinates ad hoc without an active project:

- Locator → coordinates (4/6/8-character input)
- Coordinates → 6-character locator

Band lookup and the band-plan table live on the same page; see [bands reference](../reference/bands.md).

### Repeater import

When importing from [repeater directories](repeater-directories/README.md), records that carry a Maidenhead locator or lat/lng seed channel `location` and `useLocation` via the same helpers.

### Channel map

The [map](map/README.md) plots channels that have a stored location; locator display on channel CRUD is deferred to a later phase.

## Code anchors

| Path                                             | Role                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `src/core/domain/maidenhead.ts`                  | `locatorToCoords`, `coordsToLocator`, `isValidLocator` |
| `src/app/routes/ReferencePage.tsx`               | Standalone Maidenhead converter section                |
| `src/integrations/repeaters/ukRepeaterClient.ts` | Locator/coords when normalising repeater records       |

## Inputs and outputs

| Direction        | Input                                              | Output                                |
| ---------------- | -------------------------------------------------- | ------------------------------------- |
| Locator → coords | 4, 6, or 8-character Maidenhead (case-insensitive) | Centre of the finest specified square |
| Coords → locator | WGS84 lat/lon                                      | 6-character locator (field + square)  |

## Behaviour

- Invalid characters or length → validation message on the converter; `locatorToCoords` returns `null`.
- Southern/western hemispheres: negative lat/lon handled per standard Maidenhead rules.
- Precision: 4 char = field; 6 = square (~5 km); 8 = subsquare.
- Round-trip at fixed precision: `coordsToLocator(locatorToCoords(loc))` should equal normalised `loc` at that precision.

## Manual verify

1. Visit `/reference` (no active project required).
2. Enter `IO91WM` → coordinates near London appear.
3. Enter lat/lon → a 6-char locator appears.
4. Import a repeater with a known locator → channel appears on the map with the expected position.

## Known gaps

- No dedicated `/#/reference/maidenhead` sub-route (single `/reference` page).
- No map click/drag picker, geocoding, or device geolocation on the converter.
- Channel edit form does not yet accept locator input (coordinates only when editing).

## Related

- [map](map/README.md) · [repeater-directories](repeater-directories/README.md) · [bands reference](../reference/bands.md)
