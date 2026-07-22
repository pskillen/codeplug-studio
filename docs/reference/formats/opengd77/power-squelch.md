# OpenGD77 — Power and squelch wire mapping

OpenGD77 `Channels.csv` columns `Power` and `Squelch` map to internal percent fields at the adapter boundary. Implementation: [`channelWire.ts`](../../../../src/core/import-export/formats/opengd77/channelWire.ts) (import) and [`channelWire.ts`](../../../../src/core/import-export/formats/opengd77/channelWire.ts) (export).

Internal semantics (vendor-neutral): see [data model — Channel](../../../features/data-model/README.md#channel).

## Power (`Power` column)

| OpenGD77 wire         | Internal `power`             |
| --------------------- | ---------------------------- |
| `Master`, `P1`, empty | `null` (radio default)       |
| `P2`                  | `25`                         |
| `P4`                  | `50`                         |
| `P8`                  | `75`                         |
| `P100`                | `100`                        |
| Other `Pn`            | `n` (percent), clamped 0–100 |

Export picks the nearest ladder step for non-exact percent values.

## Squelch (`Squelch` column)

Mode-dependent wire rules — see [channels.md](channels.md#mode-dependent-columns).

| OpenGD77 wire               | Internal `squelch`                    | Applies  |
| --------------------------- | ------------------------------------- | -------- |
| `Master`, `Disabled`, empty | `null` (radio default)                | Analogue |
| `N%` (e.g. `75%`)           | `N` (percent 0–100)                   | Analogue |
| _(any)_                     | ignored on import; export always `''` | Digital  |

## Related

- [Channels.csv column reference](channels.md)
- [OpenGD77 reference hub](README.md)
