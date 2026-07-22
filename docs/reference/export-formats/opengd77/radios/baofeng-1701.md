# OpenGD77 profile — `opengd77-1701`

Thin adapter stub. **Radio home (caps, power, features):** [Baofeng DM-1701 / Retevis RT-84](../../../../radios/baofeng/dm-1701/README.md).

| | |
| --- | --- |
| **Profile id** | `opengd77-1701` |
| **Wire verification** | `cps-verify` profile `opengd77-1701` — [file-format.md — Wire verification](../file-format.md#wire-verification) |
| **Code** | [`profiles.ts`](../../../../../src/core/import-export/formats/opengd77/profiles.ts) |

## Adapter-only notes

Profile selection at import/export via `profiles.ts`:

| Profile id | Zone members | TG members | Max channels |
| --- | --- | --- | --- |
| `opengd77-1701` | 80 | 32 | 1023 |
| `opengd77-md9600` | 80 | 32 | 1023 |

Generic wire: [power-squelch.md](../power-squelch.md) · [DTMF / APRS](../dtmf-aprs.md) · [channels.md](../channels.md).
