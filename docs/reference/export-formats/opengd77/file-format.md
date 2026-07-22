# OpenGD77 CSV — file format rules

Cross-cutting wire-format rules for all OpenGD77 CPS CSV files. Per-file column tables live in sibling docs.

## Header-name parsing

- Columns are matched by **header name**, not column index. CPS export order may vary; adapters must not hard-code positions.
- The first row is the header row — do not modify header text when bidirectional mappingping.
- Canonical header spellings live in [`src/core/import-export/formats/opengd77/columns.ts`](../../../../src/core/import-export/formats/opengd77/columns.ts) and per-file reference docs.
- UTF-8 BOM at file start is stripped on import.
- Leading **tab** characters in cell values are stripped on channel import (CPS uses tabs to force spreadsheet text mode for frequencies).

## Name-based foreign keys

OpenGD77 CPS builds internal indexes from **exact name matches** across files. Typos or case changes silently break links at CPS import — our adapters preserve names for export bidirectional mapping.

| From           | Column(s)             | References                      |
| -------------- | --------------------- | ------------------------------- |
| `Channels.csv` | `Contact`             | `Contacts.csv` → `Contact Name` |
| `Channels.csv` | `TG List`             | `TG_Lists.csv` → `TG List Name` |
| `TG_Lists.csv` | `Contact1`…`ContactN` | `Contacts.csv` → `Contact Name` |
| `Zones.csv`    | `Channel1`…`ChannelN` | `Channels.csv` → `Channel Name` |

Matching is **case-sensitive**. Renaming a channel requires updating every zone reference; renaming a contact requires updating channels and TG list members.

Member column **count** (`ChannelN`, `ContactN`) is radio-profile-specific — see [profiles.md](profiles.md).

## Internal vs vendor fields

At the vendor boundary:

- `Channel.name`, `Channel.contactName`, `Channel.rxGroupListName` are **wire/display names**, not internal relationship keys.
- Internal models use stable UUIDs (`Channel.id`, `Zone.memberChannelIds`, …).
- `Zone.meta.imported.memberWireNames` and `RxGroupList.meta.imported.memberWireNames` preserve imported vendor names for export and unresolved-member reporting.
- `Channel.opengd77Extras` holds OpenGD77-only columns not mapped to first-class model fields (see [channels.md](channels.md)).

## Boolean and enum conversion

| Wire pattern                              | Internal                | Import                                                 | Export                                   |
| ----------------------------------------- | ----------------------- | ------------------------------------------------------ | ---------------------------------------- |
| `Yes` / `No` (case-insensitive on import) | `boolean`               | `parseYesNo`                                           | `wireYesNo` → `Yes` / `No`               |
| `Off` / non-empty VOX                     | `voxEnabled: boolean`   | `Off` or empty → `false`; any other non-empty → `true` | `wireVoxEnabled` → `Off` / `On`          |
| `Group` / `Private` (`ID Type`)           | `TalkGroup` / `Contact` | case-insensitive `group` check                         | `Group` / `Private`                      |
| `Analogue` / `Digital`                    | `ChannelMode`           | see [channel-modes.md](../../channel-modes.md)         | lossy collapse to `Analogue` / `Digital` |

Most other fields are stored and bidirectional mappingped as **strings** without normalisation (frequencies, tones, power levels, `Rx Only`, etc.).

## Bidirectional mapping tiers

| Tier                    | Meaning                                                  | Examples                                                                                                          |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Lossless**            | Parsed to typed/boolean model fields and serialised back | `All Skip` ↔ `scanSkip`, `VOX`, `Use Location`, `Channel Type` for FM/DMR                                         |
| **String pass-through** | Stored as string; export writes stored value             | Frequencies, tones, `Rx Only`, `Contact`, `TG List`                                                               |
| **vendorExtras**        | Stored in `Channel.vendorExtras[header]`                 | `Zone Skip`, `No Beep`, `No Eco`, `TS1_TA_Tx`, `TS2_TA_Tx ID`                                                     |
| **Lossy**               | Internal richness not representable on wire              | Specific modes (`ysf`, `am`, …) collapse to `Analogue`/`Digital` — see [channel-modes.md](../../channel-modes.md) |
| **Header-only**         | Export includes headers; body not modelled               | `DTMF.csv`, `APRS.csv` (except channel `APRS` name)                                                               |
| **Not imported**        | File skipped entirely on import                          | `DTMF.csv`, `APRS.csv` today                                                                                      |

## Locale and line endings

Per G4EML CPS documentation and forum guidance:

- Delimiter follows Windows locale: comma (`,`) or semicolon (`;`).
- Decimal separator in frequencies may be `.` or `,`.
- CPS auto-detects format on import; do not change delimiter style unless re-importing on the same locale.
- Some CPS versions require **CRLF** line endings; Mac-style CR-only exports may fail CPS import (forum reports).

Our browser parser accepts standard comma-separated CSV as exported by the CPS on typical UK/US locales.

**Studio export / `cps-verify`:** Codeplug Studio writes OpenGD77 CSV with **LF** line endings and **selective RFC 4180 quoting** (`escapeCsvField` — quote only when the field contains comma, quote, or newline). The wire verifier for Studio-oriented checks requires **LF** (not CRLF) for this format.

## Wire verification

Structural rules enforced by `cps-verify` for profile `opengd77-1701` ([wire-verification.md](../../../build/testing/wire-verification.md)):

| Rule           | Expectation                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Line endings   | **LF** (Studio export)                                                                                                                          |
| Quoting        | Selective RFC 4180                                                                                                                              |
| Headers        | Exact modelled column set + order when the file is present (`Channels`, `Zones`, `Contacts`, `TG_Lists`; DTMF/APRS header-only when present)    |
| Foreign keys   | Name refs per table above; empty / `None` / `Off` sentinels                                                                                     |
| Cardinality    | Zone members ≤ 80; TG list members ≤ 32; channel name ≤ 16 ([`opengd77-1701`](profiles.md) / [dm-1701](../../radios/baofeng/dm-1701/README.md)) |
| Required files | Core set when `Channels.csv` present: Zones, Contacts, TG_Lists                                                                                 |

## Export-time radio profiles

Cardinality limits (max channels, zone member slots, TG list member slots, name display length) and feature availability (APRS configs, DTMF, airband) **diverge by radio or radio family**. These belong in [profiles.md](profiles.md) / radio homes, not in generic column tables.

Intended architecture:

1. Operator edits a **radio-agnostic** codeplug in the app.
2. At export, operator selects a **radio profile** (e.g. Baofeng 1701).
3. Exporter applies profile limits (truncate/pad member columns, validate counts) while serialising generic wire columns.

Today's shipped exporter uses [Baofeng 1701 / `opengd77-1701`](profiles.md) constants (80 zone members, 32 TG list members) without a profile picker.

## App import requirements vs CPS

Our channel parser requires header columns `Channel Name`, `Latitude`, and `Longitude` to be **present** (CPS always exports them). Rows without a channel name are skipped. Rows with invalid or missing lat/lon get `location: null`.

This is stricter than "channels without map coordinates" in some hand-edited CSVs — missing header columns throw a parse error.

## Related

- [OpenGD77 reference hub](README.md)
- [Channels](channels.md) · [Zones](zones.md) · [Contacts](contacts.md) · [TG lists](tg-lists.md)
- [Studio profiles](profiles.md)
