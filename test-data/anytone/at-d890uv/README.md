# AT-D890UV fixture bundle

Redacted minimal CPS export for wire-spike tests and documentation ([#230](https://github.com/pskillen/codeplug-studio/issues/230)).

**Provenance:** Derived from operator AT-D890UV CPS export-all; personal identifiers replaced with synthetic values.

## Files

| File                          | Rows | Role                          |
| ----------------------------- | ---- | ----------------------------- |
| `Channel.CSV`                 | 4    | 2 programmed + 2 VFO          |
| `DMRZone.CSV`                 | 1    | Zone cross-linked to channels |
| `ScanList.CSV`                | 1    | Scan list                     |
| `DMRTalkGroups.CSV`           | 2    | Talk groups                   |
| `DMRReceiveGroupCallList.CSV` | 1    | RX group list                 |
| `RadioIDList.CSV`             | 1    | DMR ID label                  |
| `DMRDigitalContactList.CSV`   | 0    | Header only                   |
| `AMAir.CSV`                   | 2    | AM airband (extended)         |
| `FM.CSV`                      | 2    | Broadcast FM (extended)       |
| `APRS.CSV`                    | 1    | Global APRS config (redacted) |
| `NXSetting.CSV`               | 1    | NXDN global settings          |
| `NXTalkGroup.CSV`             | 0    | Header only                   |
| `NXDigitalContactList.CSV`    | 0    | Header only                   |
| `NXReceiveGroupCallList.CSV`  | 0    | Header only                   |

## Redaction

- Calls signs / operator labels → `TEST01`, `1234567`
- Descriptive names → `Channel 1`, `Zone A`, `TG Alpha`, …
- APRS callsigns and free text → synthetic / empty

Do not copy personal codeplugs into this tree without the same review.
