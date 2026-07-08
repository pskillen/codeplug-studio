# Anytone CPS manifest (`.LST`)

Wire format for the CPS **project manifest** sidecar shipped with AT-D890UV export folders. Studio generates manifests on **export only** — import does not parse `.LST` ([#229](https://github.com/pskillen/codeplug-studio/issues/229)).

**Fixture (full 38-file reference order):** [`test-data/anytone/at-d890uv/meep.LST`](../../../test-data/anytone/at-d890uv/meep.LST)

## Filename

| Part | Rule |
| ---- | ---- |
| Stem | Sanitised **project** `name` (not build name) — trim, lowercase, remove whitespace, strip characters outside `[a-z0-9_-]` |
| Extension | `.LST` (uppercase) |
| Example | Project `meep` → `meep.LST` |

## Line format

Text file, UTF-8, one record per line, `LF` line endings.

| Line | Content |
| ---- | ------- |
| 1 | Decimal count of manifest entries (CSV files in the ZIP) |
| 2…N+1 | `{canonicalIndex},"{FileName.CSV}"` |

- **Quoting:** filename wrapped in ASCII double quotes; no escape sequences observed in operator samples.
- **Indices:** zero-based position in the **canonical 38-file CPS order** (see table below). Partial exports **keep canonical indices** — they do not renumber from 0..count−1. Example: DMR-only Studio export uses indices `0,1,2,3,5,8,15` (see operator partial sample `meep copy.LST`).
- **Ordering:** manifest lines sorted ascending by canonical index.

## Approach A (Studio v1)

The manifest lists **only CSV files present in the export ZIP** — no stub entries for unmodelled CPS tables.

| Rule | Behaviour |
| ---- | --------- |
| Count | Number of CSV members (excludes `.LST` itself) |
| Members | Intersection of exported CSV filenames and canonical order |
| Missing banks | Omitted entirely (no header-only placeholders) |

## Canonical file order (AT-D890UV export-all)

Indices match operator `export-all` fixture `meep.LST`.

| Index | Filename |
| ----- | -------- |
| 0 | `Channel.CSV` |
| 1 | `RadioIDList.CSV` |
| 2 | `DMRZone.CSV` |
| 3 | `ScanList.CSV` |
| 4 | `AnalogAddressBook.CSV` |
| 5 | `DMRTalkGroups.CSV` |
| 6 | `PrefabricatedSMS.CSV` |
| 7 | `FM.CSV` |
| 8 | `DMRReceiveGroupCallList.CSV` |
| 9 | `5ToneEncode.CSV` |
| 10 | `2ToneEncode.CSV` |
| 11 | `DTMFEncode.CSV` |
| 12 | `HotKey_QuickCall.CSV` |
| 13 | `HotKey_State.CSV` |
| 14 | `HotKey_HotKey.CSV` |
| 15 | `DMRDigitalContactList.CSV` |
| 16 | `AutoRepeaterOffsetFrequencys.CSV` |
| 17 | `RoamingChannel.CSV` |
| 18 | `RoamingZone.CSV` |
| 19 | `APRS.CSV` |
| 20 | `GPSRoaming.CSV` |
| 21 | `OptionalSetting.CSV` |
| 22 | `AlertTone.CSV` |
| 23 | `NXEncryptionCode.CSV` |
| 24 | `NXStateMSG.CSV` |
| 25 | `NXReceiveGroupCallList.CSV` |
| 26 | `NXTalkGroup.CSV` |
| 27 | `AMAir.CSV` |
| 28 | `AESEncryptionCode.CSV` |
| 29 | `ARC4EncryptionCode.CSV` |
| 30 | `AMZone.CSV` |
| 31 | `NXDigitalContactList.CSV` |
| 32 | `TalkGroupWhitelist(Repeater).CSV` |
| 33 | `DigitalContactWhitelist(Repeater).CSV` |
| 34 | `NXSetting.CSV` |
| 35 | `MDC1200AddressBook.CSV` |
| 36 | `MDC1200Encode.CSV` |
| 37 | `EncryptionCode.CSV` |

## Implementation

- Serialiser: `src/core/import-export/formats/anytone/lstManifest.ts`
- Wired from `exportBuildAll` when `CpsExportOptions.projectName` is set

## Related

- [README — file inventory](README.md)
- [file-format.md](file-format.md)
