# AT-D890UV fixture bundle

Redacted minimal CPS export for wire-spike tests and documentation ([#230](https://github.com/pskillen/codeplug-studio/issues/230)).

**Provenance:** Derived from operator AT-D890UV CPS export-all; personal identifiers replaced with synthetic values. Private-contact and multi-scan-list body rows added from operator re-export ([#297](https://github.com/pskillen/codeplug-studio/issues/297), July 2026).

## Files

| File                          | Rows | Role                                 |
| ----------------------------- | ---- | ------------------------------------ |
| `Channel.CSV`                 | 4    | 2 programmed + 2 VFO                 |
| `DMRZone.CSV`                 | 1    | Zone cross-linked to channels        |
| `ScanList.CSV`                | 2    | Scan lists (revert-channel variants) |
| `DMRTalkGroups.CSV`           | 2    | Talk groups                          |
| `DMRReceiveGroupCallList.CSV` | 1    | RX group list                        |
| `RadioIDList.CSV`             | 1    | DMR ID label                         |
| `DMRDigitalContactList.CSV`   | 1    | Private digital contact              |
| `AMAir.CSV`                   | 2    | AM airband (extended)                |
| `FM.CSV`                      | 2    | Broadcast FM (extended)              |
| `APRS.CSV`                    | 1    | Global APRS config (redacted)        |
| `NXSetting.CSV`               | 1    | NXDN global settings                 |
| `NXTalkGroup.CSV`             | 0    | Header only                          |
| `NXDigitalContactList.CSV`    | 0    | Header only                          |
| `NXReceiveGroupCallList.CSV`  | 0    | Header only                          |
| `meep.LST`                    | 38   | Full export-all manifest ref         |

## Redaction

- Calls signs / operator labels → `TEST01`, `1234567`
- Descriptive names → `Channel 1`, `Zone A`, `TG Alpha`, `Contact 1`, …
- APRS callsigns and free text → synthetic / empty

Do not copy personal codeplugs into this tree without the same review.
