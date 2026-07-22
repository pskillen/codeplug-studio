# OpenGD77 profile — `opengd77-md9600`

Thin adapter stub. **Radio home (caps, power, features):** [TYT MD-9600 / Retevis RT-90](../../../../radios/tyt/md-9600/README.md).

| | |
| --- | --- |
| **Profile id** | `opengd77-md9600` |
| **Status** | Power ladder validated ([#441](https://github.com/pskillen/codeplug-studio/issues/441)); cardinality still matches 1701 wire pending CPS export check |
| **Wire verification** | Same layout family as `opengd77-1701` — [file-format.md — Wire verification](../file-format.md#wire-verification) |
| **Code** | [`profiles.ts`](../../../../../src/core/import-export/formats/opengd77/profiles.ts) (`OPENGD77_MD9600_LADDER`) |

## Adapter-only notes

| Profile id | Zone members | TG members | Max channels |
| --- | --- | --- | --- |
| `opengd77-md9600` | 80 | 32 | 1023 |

Generic wire: [power-squelch.md](../power-squelch.md) · [DTMF / APRS](../dtmf-aprs.md) · [channels.md](../channels.md). Sibling stub: [baofeng-1701](baofeng-1701.md).
