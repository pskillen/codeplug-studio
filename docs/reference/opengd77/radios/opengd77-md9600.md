# TYT MD-9600 / Retevis RT-90 — OpenGD77 profile

**Profile id:** `opengd77-md9600`  
**Status:** Provisional — power ladder and cardinality match 1701 until validated against CPS export (archive reference #109).

## Capacity and cardinality

| Constraint      | Value | Notes                    |
| --------------- | ----- | ------------------------ |
| Max channels    | 1023  | Same wire format as 1701 |
| Zone members    | 80    | `Channel1`…`Channel80`   |
| TG list members | 32    | `Contact1`…`Contact32`   |

## Power ladder (P-index → percent)

Top step is band-dependent on hardware (40 W UHF / 50 W VHF); both map to 100% internally.

| Wire     | Approx. watts | Percent |
| -------- | ------------- | ------- |
| `P8`     | 40–50 W       | 100     |
| `P7`     | 25 W          | 60      |
| `P6`     | 10 W          | 40      |
| `P5`     | 5 W           | 20      |
| `P4`     | 2 W           | 8       |
| `P3`     | 1 W           | 4       |
| `P2`     | 500 mW        | 2       |
| `P1`     | 100 mW        | 1       |
| `Master` | radio default | `null`  |

## Related

- [Radio profiles hub](README.md)
- [Baofeng 1701 profile](baofeng-1701.md)
