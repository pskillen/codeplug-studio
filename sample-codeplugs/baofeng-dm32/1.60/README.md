# Baofeng DM-32UV CPS v1.60 — working codeplug sample

Unadulterated CSV bundle exported from **official Baofeng DM-32UV CPS v1.60**. Not edited for tests.

**Purpose:** Canonical wire-shape reference for [#404](https://github.com/pskillen/codeplug-studio/issues/404) elicitation and adapter gap analysis. Prefer this over `test-data/baofeng-dm32/v1.60/`, which may have been trimmed or renamed for fixtures.

**Not for:** Automated golden tests (use `test-data/` / format `__fixtures__/` for minimal synthetic rows).

## Files (as exported by CPS)

| File | Notes |
| --- | --- |
| `Channels.csv` | ~376 channels; Windows/legacy encoding on some name cells |
| `Zones.csv` | |
| `TalkGroups.csv` | CPS spelling (capital **G**) |
| `DigitalContacts.csv` | Private DMR contacts |
| `AnalogContacts.csv` | Analog / DTMF-style contacts |
| `RxGroupLists.csv` | CPS spelling (`Rx…`) |
| `ScanList.csv` | Scan lists |
| `DMR-ID.csv` | Radio ID table |

These **CPS filenames differ** from names historically used in Studio docs and `test-data/` (`Talkgroups.csv`, `Contacts.csv`, `DTMFContacts.csv`, `RXGroupLists.csv`, `Scan.csv`). Treat this directory as the CPS-truth filenames until docs/adapters are reconciled.

## Provenance

Copied from a local CPS export (2026-07-17) with no redaction. Line endings are **CRLF** as produced by CPS.
