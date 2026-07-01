# Amateur callsign token patterns

Heuristic token shapes used when splitting CPS **channel wire names** into internal `callsign` + `name` fields at the import/export boundary. Not an ITU allocation authority — patterns are approximate and extended over time.

> **Studio note:** Channel wire-name parsing ships with import/export (Phase 4+). Patterns below are the target contract; implementation will live under `src/core/import-export/`.

**Feature behaviour:** import adapters split wire names on ingest; export adapters compose from library `callsign` + `name` fields — see per-format channel docs (e.g. [opengd77/channels.md](opengd77/channels.md)).

## Rules common to all patterns

- Token must contain **at least one digit** (`0`–`9`).
- Matching is case-insensitive; stored `callsign` is uppercased.
- Portable indicators (`/M`, `/P`) stay on the token — e.g. `GB7GL/M` is one token.
- Patterns are tested left-to-right; **leftmost** matching token wins.

## Phase 1 regions

| Region       | Prefix / shape                                                                                                                | Examples                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **UK**       | `GB` + digit + 2–3 letters; `MB` + digit + 2-3 letters (simplex repeater); also `G`, `M`, `GM`, `GW`, `GI`, `GD`, `2E` blocks | `GB7GL`, `GB3DA`, `MB7IOH`, `G0ABC`, `M0PSE`, `2E0XYZ` |
| **USA**      | `K`, `N`, `W`, `A`, `AA`–`AL` + optional extra letter + digit + suffix                                                        | `W1AW`, `K1JT`, `N3ZZZ`, `AE7QG`                       |
| **Canada**   | `VA`–`VG`, `VO`, `VY`, `CY` + digit + suffix                                                                                  | `VE3ABC`, `VA2XYZ`                                     |
| **Spain**    | `EA`–`EH` + digit + suffix                                                                                                    | `EA4AB`, `EB1ABC`                                      |
| **Portugal** | `CT`, `CU`, `CS` + digit + suffix                                                                                             | `CT1ABC`, `CS5XYZ`                                     |
| **Italy**    | `I` + optional `W`/`K`/`Z` + digit + suffix                                                                                   | `I1ABC`, `IW0ABC`                                      |
| **France**   | `F` + optional letter + digit + suffix                                                                                        | `F4ABC`, `F1XYZ`                                       |
| **Poland**   | `SP`, `SN`, `SO`, `SQ`, `HF`, `3Z` + digit + suffix                                                                           | `SP9ABC`, `SN0XYZ`                                     |
| **Germany**  | `DL`, `DM`, `DO`, `DN` + digit + suffix                                                                                       | `DL1ABC`, `DO1XYZ`                                     |

UK repeater beacons commonly match `^[A-Z]{2}\d[A-Z]{2,3}$` (e.g. `GB7GL`, `GB3DA`).

## Phase 2 (deferred)

Broader ITU coverage — Benelux, Nordics, Australia (`VK`), Japan (`JA`), Brazil, and others.

## Related

- [data-model README](../features/data-model/README.md) — `callsign` and `name` fields
- [ukrepeater](ukrepeater/README.md) — repeater callsign search
