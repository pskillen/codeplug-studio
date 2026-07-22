# MD-9600 — limits

OpenGD77 CPS caps for this hardware. Cardinality still matches the 1701 wire layout pending a CPS export check. Adapters warn or truncate at the **export boundary** — library CRUD stays unlimited.

| Constraint      | Value    | Notes                    |
| --------------- | -------- | ------------------------ |
| Max channels    | **1023** | Same wire format as 1701 |
| Zone members    | **80**   | `Channel1`…`Channel80`   |
| TG list members | **32**   | `Contact1`…`Contact32`   |

## Adapter application

| Adapter                    | Behaviour when over limit                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenGD77 `opengd77-md9600` | Same wire cardinality as `opengd77-1701`; see [file-format.md — Wire verification](../../../export-formats/opengd77/file-format.md#wire-verification) |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
- Sibling caps: [DM-1701 limits](../../baofeng/dm-1701/limits.md)
