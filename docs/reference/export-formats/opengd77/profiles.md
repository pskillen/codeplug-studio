# OpenGD77 Studio profiles

Index of Studio `profileId` values for the OpenGD77 CPS CSV adapter → radio homes under [`docs/reference/radios/`](../../radios/). Shared CSV column set; cardinality and power ladders differ by radio.

Generic wire: [README.md](README.md).

| Profile id        | Radio                           | Path                                                                             | Notes                                                                                                     |
| ----------------- | ------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `opengd77-1701`   | Baofeng DM-1701 / Retevis RT-84 | [../../radios/baofeng/dm-1701/README.md](../../radios/baofeng/dm-1701/README.md) | 1023 ch, 68 zones, 76 TG lists, 1024 contacts, 80 zone / 32 TG-list members; `cps-verify` `opengd77-1701` |
| `opengd77-md9600` | TYT MD-9600 / Retevis RT-90     | [../../radios/tyt/md-9600/README.md](../../radios/tyt/md-9600/README.md)         | Same entity caps as 1701; `OPENGD77_MD9600_LADDER` for power only                                         |

**Export boundary:** modelled radios are **FM + DMR only** — CSV export and Web Serial Write drop other digital mode profiles (YSF, D-STAR, …) with warnings ([#773](https://github.com/pskillen/codeplug-studio/issues/773)). Library channels may still hold other modes for cross-format reuse.

Code: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts). Wire verification: [file-format.md — Wire verification](file-format.md#wire-verification).
