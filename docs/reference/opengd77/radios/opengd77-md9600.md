# TYT MD-9600 / Retevis RT-90 — OpenGD77 profile

**Profile id:** `opengd77-md9600`  
**Status:** Power ladder validated from radio menu elicitation ([#441](https://github.com/pskillen/codeplug-studio/issues/441)). Cardinality still matches the 1701 wire layout pending a CPS export check.

## Capacity and cardinality

| Constraint      | Value | Notes                    |
| --------------- | ----- | ------------------------ |
| Max channels    | 1023  | Same wire format as 1701 |
| Zone members    | 80    | `Channel1`…`Channel80`   |
| TG list members | 32    | `Contact1`…`Contact32`   |

## Power ladder (P-index → percent)

Source: MD-9600 radio menu levels (operator elicitation). Fixed steps map to CPS `P1`…`P9` (lowest → highest). `Master` is radio default (`power: null`). Menu also shows `+W-`; CPS wire for that entry is unknown and not mapped.

| Wire     | Approx. watts (menu) | Percent |
| -------- | -------------------- | ------- |
| `P9`     | 40 W (VHF + UHF)     | 100     |
| `P8`     | 25 W                 | 63      |
| `P7`     | 10 W                 | 25      |
| `P6`     | 5 W                  | 13      |
| `P5`     | 1 W                  | 5       |
| `P4`     | 750 mW               | 4       |
| `P3`     | 500 mW               | 3       |
| `P2`     | 250 mW               | 2       |
| `P1`     | 100 mW               | 1       |
| `Master` | radio default        | `null`  |

Implementation: `OPENGD77_MD9600_LADDER` in [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts).

## Related

- [Radio profiles hub](README.md)
- [Baofeng 1701 profile](baofeng-1701.md)
- [#441](https://github.com/pskillen/codeplug-studio/issues/441) — MD-9600 power ladder validation
