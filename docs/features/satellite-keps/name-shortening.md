# Satellite name shortening

How Codeplug Studio turns long Celestrak-style spacecraft names into distinct, radio-safe wire names at **write time**.

**Tracking:** [#1090](https://github.com/pskillen/codeplug-studio/issues/1090)  
**Hub:** [README.md](README.md)

---

## Problem

Amateur spacecraft names are often longer than a radio's name field (8 characters on Anytone D890 and OpenGD77). Blind truncation loses identity when many names share prefixes (`CUBE…`, `MONITOR-…`, constellation siblings). Operators also want stable, editable short names on a **build**, not a new surprise every refresh.

---

## Where it runs

| Layer        | Responsibility                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Library**  | `Satellite.name` stays unbounded — full Celestrak `OBJECT_NAME`.                                                                                                                                        |
| **Core**     | `shortenSatelliteNames()` — vendor-neutral whole-set assignment; `resolveSatelliteTransmitterWriteNames()` — per-transmitter encoded names; `findEncodedNameCollisions()` — UI warning helper.          |
| **Build**    | `RadioBuild.satelliteOverrides[]` — sparse `wireName` pins per **transmitter** (`libraryEntityId` = transmitter UUID). Value is the **full** ≤`N` encoded name field written to the radio.              |
| **App**      | **Satellite keps** build tab — nested preview table; inline edit on each transmitter row ([`SatelliteEncodedNameCell`](../../../src/app/components/builds/satelliteKeps/SatelliteEncodedNameCell.tsx)). |
| **Radio-io** | D890 `packSatelliteWriteRecords` / `previewSatelliteWriteRecords` consume resolved per-transmitter names. Overrides skip name+label combine; generated rows use `encodeSatelliteTransmitterWireName`.   |

Workflow A (library **Write Keps**) has no build context — names are computed ephemerally per write with no override UI.

Name length and charset come from the target radio limits module (e.g. `AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH` in `src/core/radios/anytone/at-d890uv/limits.ts`), not literals in the shortener.

---

## Algorithm (familiar-name-first)

Shortening is a **whole-set assignment** at the **satellite short-name** layer: inputs are the satellites about to be written plus `N` (max length). Outputs are unique short strings ≤ `N` among auto-generated rows.

Per satellite, candidates are tried in order:

1. Base name as-is when it fits.
2. Separator squeeze — drop decorative punctuation from the head, keep index separator (`ES'HAIL 2` → `ESHAIL 2`).
3. Head shorten — keep series index; size stem consistently across siblings (`GEOSCAN 6` → `GEOSCA 6`, `INNOSAT 16` / `INNOSAT 3` → `INNOS 16` / `INNOS 3`).
4. Optional `SAT` / `SATELLITE` affix strip when the head still overflows (not applied to load-bearing stems like `INNOSAT`).
5. Tier A OSCAR alias (`AO-85`) — overflow/collision only (familiar name wins when it fits, e.g. `GREENCUBE` not `IO-117`).
6. Tier B catalogue alias (`RS58S`) — collision fallback.
7. Tier C alternate parenthetical — last resort before forced disambiguation.

Assignment is deterministic: sort by NORAD catalogue ID; lowest ID keeps a contested string; others advance down their ladders.

Each eligible `(satellite, transmitter)` pair then gets an **encoded name**: familiar short name + optional transmitter label in leftover bytes (`encodeSatelliteTransmitterWireName`), unless the operator pinned a full-field override on that transmitter.

**Suggestions exposed to the UI** (per transmitter, encoded):

- **Familiar** — familiar-path short name + label combine.
- **OSCAR** — Tier A alias + label combine when the library name has an OSCAR parenthetical; hidden when absent.

Auto-generated encoded names stay unique within the write set. **Manual overrides may duplicate** — the UI shows a non-blocking warning; write is not blocked.

---

## UI behaviour

On **Build → Satellite keps → Preview satellites to write**:

- Expand a spacecraft row to see each transmitter (radio).
- Click **Edit** beside the encoded name to open the inline editor.
- **Familiar** / **OSCAR** (when present) store that suggestion as an explicit override.
- **Reset** clears the override so the name tracks live generation again.
- Manual edit + Apply persists a custom full encoded name.
- Duplicate encoded names across transmitters show a yellow **Duplicate encoded names** alert (informational only).

---

## Wire reference

D890 name field layout and Studio-only name+label combining: [satellite-keps.md](../../reference/radios/anytone/at-d890uv/satellite-keps.md). Hardware length ceiling: [limits.md](../../reference/radios/anytone/at-d890uv/limits.md).

---

## Tests

- Unit: `shortenSatelliteNames.test.ts`, `resolveSatelliteTransmitterWriteNames.test.ts`, `findEncodedNameCollisions.test.ts`.
- Integration: `satelliteCodec.test.ts`, `BuildSatelliteKepsPage.test.tsx`.
