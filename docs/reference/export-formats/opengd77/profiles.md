# OpenGD77 Studio profiles

Index of Studio `profileId` values for the OpenGD77 CPS CSV adapter → radio homes under [`docs/reference/radios/`](../../radios/). Shared CSV column set; cardinality and power ladders differ by radio.

Generic wire: [README.md](README.md).

| Profile id        | Radio                           | Path                                                                             | Notes                                                                        |
| ----------------- | ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `opengd77-1701`   | Baofeng DM-1701 / Retevis RT-84 | [../../radios/baofeng/dm-1701/README.md](../../radios/baofeng/dm-1701/README.md) | Zone members 80, TG list 32, max channels 1023; `cps-verify` `opengd77-1701` |
| `opengd77-md9600` | TYT MD-9600 / Retevis RT-90     | [../../radios/tyt/md-9600/README.md](../../radios/tyt/md-9600/README.md)         | Same cardinality as 1701 pending CPS export check; `OPENGD77_MD9600_LADDER`  |

Code: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts). Wire verification: [file-format.md — Wire verification](file-format.md#wire-verification).
