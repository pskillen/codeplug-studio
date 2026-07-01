# OpenGD77 CPS CSV reference

> **Studio status:** Wire reference ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool); OpenGD77 import/export adapters ship Phase 4–6 under `src/core/import-export/formats/opengd77/`. Import/export columns below describe **target** behaviour from the archive implementation.

Authoritative reference for the **OpenGD77 Customer Programming Software (CPS) CSV interchange format** — **one** of the wire formats our import/export adapters speak at the format boundary (siblings: DM32 CSV, qDMR YAML, CHIRP, … documented separately). Per-radio variants (1701, MD9600, …) live in [`radios/`](radios/README.md).

**Tracking:** archive reference (codeplug-tool#43)

## Two-layer model

| Layer                   | Location                                      | Contents                                                                                                          |
| ----------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Generic wire format** | This directory (`channels.md`, `zones.md`, …) | Column headers, semantic mapping to internal models, import/export conversion rules, import/export fidelity tiers |
| **Radio profiles**      | [`radios/`](radios/README.md)                 | Per-radio limits (max channels, zone member count), feature availability (APRS, DTMF), layout conventions         |

The **internal library model is format- and radio-agnostic** ([data model](../../features/data-model/README.md)). OpenGD77 radio-variant constraints are documented in radio profiles and are intended to be **applied at export time** when the operator picks a target OpenGD77 radio variant. The archive adapter was calibrated to the [Baofeng 1701 variant](radios/baofeng-1701.md).

## File set

OpenGD77 CPS exports up to six CSV files. Keep all files in one folder — lists cross-reference each other by **exact name match**.

| File           | Generic reference            | Import (app) | Export (app)       | Modelled                                         |
| -------------- | ---------------------------- | ------------ | ------------------ | ------------------------------------------------ |
| `Channels.csv` | [channels.md](channels.md)   | Yes          | Yes                | Full `Channel[]`                                 |
| `Zones.csv`    | [zones.md](zones.md)         | Yes          | Yes                | Build **zone grouping** trait layout             |
| `Contacts.csv` | [contacts.md](contacts.md)   | Yes          | Yes                | Split → `TalkGroup[]` + `Contact[]`              |
| `TG_Lists.csv` | [tg-lists.md](tg-lists.md)   | Yes          | Yes                | Full `RxGroupList[]`                             |
| `DTMF.csv`     | [dtmf-aprs.md](dtmf-aprs.md) | Skipped      | Header-only in ZIP | Not modelled                                     |
| `APRS.csv`     | [dtmf-aprs.md](dtmf-aprs.md) | Skipped      | Header-only in ZIP | Not modelled (`aprsConfigName` on channels only) |

Typical export filenames: `Channels.csv`, `Zones.csv`, `Contacts.csv`, `TG_Lists.csv`. Delimiter and decimal separator follow host OS locale (`,` or `;`; `.` or `,` in frequencies).

## Cross-cutting rules

See [file-format.md](file-format.md) for header-name parsing, case-sensitive foreign keys, `vendorExtras`, import/export fidelity tiers, and locale quirks.

## Classification (import)

`detectKind(fileName, headerRow)` in [`src/core/import-export/formats/opengd77/adapter.ts`](../../../src/core/import-export/formats/opengd77/adapter.ts):

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

## Skip vs error

| Outcome        | When                                                              |
| -------------- | ----------------------------------------------------------------- |
| **Skipped**    | `DTMF.csv`, `APRS.csv`, other `unknown` files                     |
| **Error**      | Recognised file fails parse (missing required columns, empty CSV) |
| **Recognised** | channels, zones, contacts, rxGroupLists                           |

## Documentation map

| Doc                                      | Purpose                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [file-format.md](file-format.md)         | Cross-cutting wire rules                                                                           |
| [channels.md](channels.md)               | `Channels.csv` columns                                                                             |
| [power-squelch.md](power-squelch.md)     | Power and squelch wire mapping                                                                     |
| [zones.md](zones.md)                     | `Zones.csv` columns                                                                                |
| [contacts.md](contacts.md)               | `Contacts.csv` columns                                                                             |
| [tg-lists.md](tg-lists.md)               | `TG_Lists.csv` columns                                                                             |
| [dtmf-aprs.md](dtmf-aprs.md)             | Deferred files + radio availability                                                                |
| [multi-talkgroup.md](multi-talkgroup.md) | N/A — native RGL; see [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) |
| [multi-mode.md](multi-mode.md)           | Multi-mode channel expansion (archive reference #46)                                               |
| [radios/README.md](radios/README.md)     | Radio profile concept and index                                                                    |

## Sources

| Source                                                                                                                                                             | Use                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| [G4EML CSV Export and Import Features (PDF)](https://www.opengd77.com/downloads/PC_CPS/Latest/OpenGD77_CPS_CSV%20Features.pdf)                                     | Primary upstream column semantics and CPS limits |
| [G4EML CSV Features (HTML mirror)](https://www.lyonscomputer.com.au/Radio-Transceivers/Radioddity/GD77/2025-Codeplug-Build/OpenGD77_CPS_CSV_Features-Updated.html) | Same content, searchable                         |
| [`src/core/import-export/formats/opengd77/columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts)                                                | Canonical headers in shipped adapter             |
| [qDMR OpenGD77Codeplug](https://static.dm3mat.de/qdmr/libdmrconf/classOpenGD77Codeplug.html)                                                                       | Secondary limits reference                       |

Implementation code is expected to mirror this reference. When code and docs disagree, **code wins until fixed** — file a GitHub issue.

## Related

- Import/export (Phase 4+) — see [DESIGN.md](../../DESIGN.md)
- [Data model](../../features/data-model/README.md)
- [Channel modes](../channel-modes.md)
