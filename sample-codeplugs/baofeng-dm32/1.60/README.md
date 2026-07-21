# Baofeng DM-32UV CPS v1.60 — working codeplug sample

Unadulterated CSV bundle exported from **official Baofeng DM-32UV CPS v1.60**. Not edited for tests.

**Purpose:** Canonical wire-shape reference (headers / cells) for [#404](https://github.com/pskillen/codeplug-studio/issues/404) elicitation and adapter gap analysis. Prefer this over `test-data/baofeng-dm32/v1.60/`, which may have been trimmed or edited for fixtures.

**Not for:** Automated golden tests (use `test-data/` / format `__fixtures__/` for minimal synthetic rows).

## Files (as saved from CPS)

DM-32UV CPS import/export is **manual, per file**, with **no fixed default names**. Filenames here are whatever this operator chose in the save dialog; close variants in Studio docs / `test-data/` (`Talkgroups.csv`, `Contacts.csv`, …) label the same roles. Wire truth is **headers and cells**, not the basename.

| File                  | Role                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `Channels.csv`        | RF channels (~376 rows; Windows/legacy encoding on some name cells) |
| `Zones.csv`           | Zones                                                               |
| `TalkGroups.csv`      | Talk groups                                                         |
| `DigitalContacts.csv` | Private DMR contacts                                                |
| `AnalogContacts.csv`  | Analog / DTMF-style contacts                                        |
| `RxGroupLists.csv`    | RX group lists                                                      |
| `ScanList.csv`        | Scan lists                                                          |
| `DMR-ID.csv`          | Radio ID table                                                      |

## Provenance

Copied from a local CPS export (2026-07-17) with no redaction. Line endings are **CRLF** as produced by CPS.
