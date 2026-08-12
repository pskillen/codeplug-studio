# Satellite name shortening

How Codeplug Studio turns long Celestrak-style spacecraft names into distinct, radio-safe wire names at **write time**.

**Tracking:** [#1090](https://github.com/pskillen/codeplug-studio/issues/1090)  
**Hub:** [README.md](README.md)

---

## Problem

Amateur spacecraft names are often longer than a radio's name field (8 characters on Anytone D890 and OpenGD77). Blind truncation loses identity when many names share prefixes (`CUBE…`, `MONITOR-…`, constellation siblings). Operators also want stable, editable short names on a **build**, not a new surprise every refresh.

---

## Where it runs

| Layer | Responsibility |
| --- | --- |
| **Library** | `Satellite.name` stays unbounded — full Celestrak `OBJECT_NAME`. |
| **Core** | `shortenSatelliteNames()` — vendor-neutral whole-set assignment (`src/core/domain/satellite/shortenSatelliteNames.ts`). |
| **Build** | `RadioBuild.satelliteOverrides[]` — sparse `wireName` pins per satellite (`libraryEntityId` = satellite UUID). |
| **App** | **Satellite keps** build tab — Wire names panel with Default / Reset ([`SatelliteWireNameOverrideInput`](../../../src/app/components/builds/satelliteKeps/SatelliteWireNameOverrideInput.tsx)). |
| **Radio-io** | D890 `packSatelliteWriteRecords` / `previewSatelliteWriteRecords` consume resolved short names, then optionally append transmitter label in leftover bytes. |

Workflow A (library **Write Keps**) has no build context — names are computed ephemerally per write with no override UI.

Name length and charset come from the target radio limits module (e.g. `AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH` in `src/core/radios/anytone/at-d890uv/limits.ts`), not literals in the shortener.

---

## Algorithm (familiar-name-first)

Shortening is a **whole-set assignment**: inputs are the satellites about to be written plus `N` (max length). Outputs are unique strings ≤ `N`.

Per satellite, candidates are tried in order:

1. Stored build override (`satelliteOverrides.wireName`) — reserved; excluded from generation for others.
2. Base name as-is when it fits.
3. Separator squeeze — drop decorative punctuation from the head, keep index separator (`ES'HAIL 2` → `ESHAIL 2`).
4. Head shorten — keep series index; size stem consistently across siblings (`GEOSCAN 6` → `GEOSCA 6`, `INNOSAT 16` / `INNOSAT 3` → `INNOS 16` / `INNOS 3`).
5. Optional `SAT` / `SATELLITE` affix strip when the head still overflows (not applied to load-bearing stems like `INNOSAT`).
6. Tier A OSCAR alias (`AO-85`) — overflow/collision only (familiar name wins when it fits, e.g. `GREENCUBE` not `IO-117`).
7. Tier B catalogue alias (`RS58S`) — collision fallback.
8. Tier C alternate parenthetical — last resort before forced disambiguation.

Assignment is deterministic: sort by NORAD catalogue ID; lowest ID keeps a contested string; others advance down their ladders.

Parenthetical tiers: OSCAR `[A-Z]O-\d+`, catalogue `RS…`, everything else is alternate (never promoted over the base).

Composites (`CAS-2T & KS-1Q`) use the first component only.

---

## UI behaviour

On **Build → Satellite keps → Wire names**:

- **Default** (underlined) stores `generatedWireName` as an explicit override on the build.
- **Reset** clears the override so the name tracks live generation again.
- Manual edit + Apply persists a custom `wireName`.

The preview table below shows the final encoded value (short name + optional transmitter label suffix).

---

## Wire reference

D890 name field layout and Studio-only name+label combining: [satellite-keps.md](../../reference/radios/anytone/at-d890uv/satellite-keps.md). Hardware length ceiling: [limits.md](../../reference/radios/anytone/at-d890uv/limits.md).

---

## Tests

- Unit: `src/core/domain/satellite/shortenSatelliteNames.test.ts` (worked examples + amateur catalogue fixture).
- Integration: `satelliteCodec.test.ts`, `BuildSatelliteKepsPage.test.tsx`.
