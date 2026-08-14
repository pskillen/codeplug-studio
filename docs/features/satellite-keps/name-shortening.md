# Satellite name shortening

How Codeplug Studio turns long Celestrak-style spacecraft names into distinct, radio-safe wire names at **write time**.

**Tracking:** [#1090](https://github.com/pskillen/codeplug-studio/issues/1090)  
**Hub:** [README.md](README.md)

---

## Problem

Amateur spacecraft names are often longer than a radio's name field (8 characters on Anytone D890 and OpenGD77). Blind truncation loses identity when many names share prefixes (`CUBE…`, `MONITOR-…`, constellation siblings). Operators also want stable, editable short names on a **build**, not a new surprise every refresh.

---

## Where it runs

| Layer        | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Library**  | `Satellite.name` stays unbounded — full Celestrak `OBJECT_NAME`.                                                                                                                                                                                                                                                                                                                                                                                            |
| **Core**     | `shortenSatelliteNames()` — vendor-neutral whole-set assignment; `resolveSatelliteTransmitterWriteNames()` — per-transmitter encoded names; `findEncodedNameCollisions()` — UI warning helper.                                                                                                                                                                                                                                                              |
| **Build**    | `RadioBuild.satelliteOverrides[]` — sparse pins. D890 `wireName` is keyed by **transmitter** UUID (full ≤`N` encoded name). OpenGD77 `wireName` is keyed by **satellite** UUID (one spacecraft name copied onto Freq 1/2/3 child rows). OpenGD77 `satelliteBankSlot` is a separate field keyed by **transmitter** UUID.                                                                                                                                     |
| **App**      | **Satellite keps** build tab — nested preview table. D890: inline encoded-name edit on each transmitter row. OpenGD77: edit on the **parent** spacecraft row; three child rows (Freq 1/2/3) with Radio candidates then slot name then chosen-radio details ([`SatelliteEncodedNameCell`](../../../src/app/components/builds/satelliteKeps/SatelliteEncodedNameCell.tsx)).                                                                                   |
| **Radio-io** | D890 `packSatelliteWriteRecords` / `previewSatelliteWriteRecords` consume resolved per-transmitter names. Overrides skip name+label combine; generated rows use `encodeSatelliteTransmitterWireName`. OpenGD77 `packSatelliteBank` writes **one 8-byte spacecraft name** per bank slot (`OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH`); transmitter labels are not combined. Collision warnings group by satellite id on OpenGD77 (cross-spacecraft only). |

Workflow A (library **Write Keps**) has no build context — names are computed ephemerally per write with no override UI.

Name length and charset come from the target radio limits module (e.g. `AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH`, `OPENGD77_FAMILY_LIMITS.SATELLITE_NAME_LENGTH`), not literals in the shortener.

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

These suggestion strings are **pre-`~N` disambiguation**: they match `encodeSatelliteTransmitterWireName` on the familiar/OSCAR short name alone. Whole-set uniqueness may still append `~2`, `~3`, … to the **effective** generated `encodedName` via `disambiguateEncoded` in `resolveSatelliteTransmitterWriteNames` when two auto-generated rows collide. The UI suggestions intentionally stay on the undecorated familiar/OSCAR forms so the operator can pin a clean name; the live effective cell (and write path) show the disambiguated value when no override is set.

Auto-generated encoded names stay unique within the write set. **Manual overrides may duplicate** — the UI shows a non-blocking warning; write is not blocked.

---

## UI behaviour

On **Build → Satellite keps → Preview satellites to write**:

- Expand a spacecraft row: D890 shows each transmitter; OpenGD77 shows FM / APRS / beacon slots.
- **D890:** click **Edit** beside the encoded name on a **transmitter** row.
- **OpenGD77:** click **Edit** on the **parent** spacecraft row (one name for all three radio slots). Child rows are **FM / APRS / beacon slots**; encoded name is parent-only.
- **Familiar** / **OSCAR** (when present) fill the draft only — they do not persist until **Apply**.
- **Reset** clears the override immediately so the name tracks live generation again, and empties the draft (placeholder shows Familiar).
- Manual edit + Apply persists a custom full encoded name.
- Duplicate encoded names: D890 warns across transmitters; OpenGD77 warns only when **two spacecraft** shorten to the same 8 characters (the three slot rows of one satellite are not a collision).
- OpenGD77 child rows: **Radio** (eligible candidates, or `(none)`; Select when a slot is contested), **Slot** (`FM slot` / `APRS slot` / `Beacon slot`), then mode and frequencies of the chosen candidate. `satelliteBankSlot` is pinned on the chosen transmitter for this build.

---

## Wire reference

D890 name field layout and Studio-only name+label combining: [satellite-keps.md](../../reference/radios/anytone/at-d890uv/satellite-keps.md). Hardware length ceiling: [limits.md](../../reference/radios/anytone/at-d890uv/limits.md).

OpenGD77 spacecraft name field: [satellite-orbitals.md](../../reference/radios/opengd77/satellite-orbitals.md).

---

## Tests

- Unit: `shortenSatelliteNames.test.ts`, `resolveSatelliteTransmitterWriteNames.test.ts`, `findEncodedNameCollisions.test.ts`.
- Integration: `satelliteCodec.test.ts`, `BuildSatelliteKepsPage.test.tsx`.
