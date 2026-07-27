# MD-9600 — limits

OpenGD77 CPS caps for this hardware. OpenGD77 uses **one shared codeplug structure** across the radio family; Studio applies the same entity caps as `opengd77-1701` until a radio-specific CPS export proves otherwise. Adapters warn or truncate at the **export boundary** — library CRUD stays unlimited.

| Constraint         | Value                   | Notes                                                                                                           |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Max channels       | **1023**                | Same wire format as 1701                                                                                        |
| Max zones          | **68**                  | Shared codeplug — forum source; not MD-9600-specific-confirmed                                                  |
| Max RX group lists | **76**                  | Shared codeplug — forum source                                                                                  |
| Max contacts       | **1024**                | Contact bank; talk groups share this pool                                                                       |
| Max talk groups    | _(shares contact bank)_ | No separate TG table                                                                                            |
| Zone members       | **80**                  | `Channel1`…`Channel80`                                                                                          |
| TG list members    | **32**                  | `Contact1`…`Contact32`                                                                                          |
| Name lengths       | **16** chars            | Channel, zone, contact, TG, RX list (RGL name inferred — see [DM-1701 limits](../../baofeng/dm-1701/limits.md)) |

Power ladder differs from 1701 — see [power.md](power.md) ([#441](https://github.com/pskillen/codeplug-studio/issues/441)).

## Adapter application

| Adapter                    | Behaviour when over limit                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenGD77 `opengd77-md9600` | Same entity caps as `opengd77-1701`; see [file-format.md — Wire verification](../../../export-formats/opengd77/file-format.md#wire-verification) |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
- Sibling caps: [DM-1701 limits](../../baofeng/dm-1701/limits.md)
- Studio profile: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts) (`opengd77-md9600`)
