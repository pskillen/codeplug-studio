# OpenGD77 CPS CSV reference

Authoritative reference for the **OpenGD77 Customer Programming Software (CPS) CSV interchange format** — **one** of the wire formats our import/export adapters speak at the format boundary (siblings: DM32 CSV, qDMR YAML, CHIRP, … documented separately). Per-radio variants (1701, MD9600, …): [`profiles.md`](profiles.md) → [`docs/reference/radios/`](../../radios/).

> **CPS CSV wire ≠ binary memory layout.** Direct radio EEPROM/FLASH maps and the OpenGD77 USB serial protocol are documented under [`docs/reference/radios/opengd77/`](../../radios/opengd77/README.md) — do not treat CSV column tables as binary offsets.

**Epic:** [#502](https://github.com/pskillen/codeplug-studio/issues/502) (import + export)

## Studio status

| Capability | Status   | Code                                                                 |
| ---------- | -------- | -------------------------------------------------------------------- |
| **Export** | Shipped  | [`adapter.ts`](../../../../src/core/import-export/formats/opengd77/adapter.ts), [`serialise.ts`](../../../../src/core/import-export/formats/opengd77/serialise.ts) |
| **Import** | Planned  | [#522](https://github.com/pskillen/codeplug-studio/issues/522)–[#526](https://github.com/pskillen/codeplug-studio/issues/526) |

Column tables below describe **shipped export** behaviour and **target import** behaviour (archive + sibling-format patterns). Where import is not yet implemented, rows are marked accordingly.

## Two-layer model

| Layer                   | Location                                                  | Contents                                                                                                          |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Generic wire format** | This directory (`channels.md`, `zones.md`, …)             | Column headers, semantic mapping to internal models, import/export conversion rules, fidelity tiers                 |
| **Radio profiles**      | [`profiles.md`](profiles.md) · [`radios/`](../../radios/) | Studio `profileId` → radio home; limits and features in radios tree                                               |

The **internal library model is format- and radio-agnostic** ([data model](../../../features/data-model/README.md)). OpenGD77 radio-variant constraints are documented in radio profiles and are **applied at export** via `profileId` on the format build.

## File set

OpenGD77 CPS exports up to six CSV files. Keep all files in one folder — lists cross-reference each other by **exact name match**.

| File           | Generic reference            | Import (Studio) | Export (Studio)    | Modelled                                         |
| -------------- | ---------------------------- | --------------- | ------------------ | ------------------------------------------------ |
| `Channels.csv` | [channels.md](channels.md)   | Planned         | Yes                | Full `Channel[]`                                 |
| `Zones.csv`    | [zones.md](zones.md)         | Planned         | Yes                | Build **zone grouping** trait layout             |
| `Contacts.csv` | [contacts.md](contacts.md)   | Planned         | Yes                | Split → `TalkGroup[]` + `Contact[]`              |
| `TG_Lists.csv` | [tg-lists.md](tg-lists.md)   | Planned         | Yes                | Full `RxGroupList[]`                             |
| `DTMF.csv`     | [dtmf-aprs.md](dtmf-aprs.md) | Skipped         | Header-only in ZIP | Not modelled                                     |
| `APRS.csv`     | [dtmf-aprs.md](dtmf-aprs.md) | Skipped         | Header-only in ZIP | Not modelled (`aprsConfigName` on channels only) |

Typical export filenames: `Channels.csv`, `Zones.csv`, `Contacts.csv`, `TG_Lists.csv`. Delimiter and decimal separator follow host OS locale (`,` or `;`; `.` or `,` in frequencies).

## Cross-cutting rules

See [file-format.md](file-format.md) for header-name parsing, case-sensitive foreign keys, unmodelled column defaults, fidelity tiers, and locale quirks.

## Classification (import — planned)

Target behaviour from archive `codeplug-tool` — **not shipped** in Studio yet. Will live in a future `parse.ts` / import adapter ([#522](https://github.com/pskillen/codeplug-studio/issues/522)):

| Signal                                         | Result              |
| ---------------------------------------------- | ------------------- |
| Filename contains `channel` (case-insensitive) | `channels`          |
| Filename contains `zone`                       | `zones`             |
| Filename contains `contact` (not `dtmf`)       | `contacts`          |
| Filename contains `tg_list` or `tg list`       | `rxGroupLists`      |
| Headers include `Contact Name` + `ID Type`     | `contacts`          |
| Headers include `TG List Name`                 | `rxGroupLists`      |
| Headers include `Channel Name` + `Latitude`    | `channels`          |
| Headers include `Zone Name`                    | `zones`             |
| Otherwise                                      | `unknown` → skipped |

## Skip vs error (import — planned)

| Outcome        | When                                                              |
| -------------- | ----------------------------------------------------------------- |
| **Skipped**    | `DTMF.csv`, `APRS.csv`, other `unknown` files                     |
| **Error**      | Recognised file fails parse (missing required columns, empty CSV) |
| **Recognised** | channels, zones, contacts, rxGroupLists                           |

## Documentation map

| Doc                                      | Purpose                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| [file-format.md](file-format.md)         | Cross-cutting wire rules                                                                 |
| [channels.md](channels.md)               | `Channels.csv` columns                                                                   |
| [power-squelch.md](power-squelch.md)     | Power and squelch wire mapping                                                           |
| [zones.md](zones.md)                     | `Zones.csv` columns                                                                      |
| [contacts.md](contacts.md)               | `Contacts.csv` columns                                                                   |
| [tg-lists.md](tg-lists.md)               | `TG_Lists.csv` columns                                                                   |
| [dtmf-aprs.md](dtmf-aprs.md)             | Deferred files + radio availability                                                      |
| [multi-talkgroup.md](multi-talkgroup.md) | N/A — native RGL; see [multi-talkgroup-expansion.md](../../multi-talkgroup-expansion.md) |
| [multi-mode.md](multi-mode.md)           | Multi-mode channel expansion (shipped)                                                   |
| [profiles.md](profiles.md)               | Studio profile id → radio home index                                                     |

## Sources

| Source                                                                                                                                                             | Use                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [G4EML CSV Export and Import Features (PDF)](https://www.opengd77.com/downloads/PC_CPS/Latest/OpenGD77_CPS_CSV%20Features.pdf)                                     | Partial — older CPS (24-col Channels); omits `APRS.csv`; use with shipped adapter code |
| [G4EML CSV Features (HTML mirror)](https://www.lyonscomputer.com.au/Radio-Transceivers/Radioddity/GD77/2025-Codeplug-Build/OpenGD77_CPS_CSV_Features-Updated.html) | Same content, searchable                                                                 |
| [`src/core/import-export/formats/opengd77/columns.ts`](../../../../src/core/import-export/formats/opengd77/columns.ts)                                             | Canonical headers in shipped export adapter                                              |
| [qDMR OpenGD77Codeplug](https://static.dm3mat.de/qdmr/libdmrconf/classOpenGD77Codeplug.html)                                                                       | Secondary limits reference                                                               |

Implementation code is expected to mirror this reference. When code and docs disagree, **code wins until fixed** — file a GitHub issue.

## Related

- [Import/export feature hub](../../../features/import-export/README.md)
- [Data model](../../../features/data-model/README.md)
- [Channel modes](../../channel-modes.md)
- Binary memory / Web Serial (separate): [radios/opengd77](../../radios/opengd77/README.md)
