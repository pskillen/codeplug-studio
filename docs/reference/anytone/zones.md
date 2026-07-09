# Anytone — DMRZone.CSV

DMR zone layout for AT-D890UV. Maps to **build zone grouping** trait layout — not library `Zone` shape directly (organisation is build-scoped per [DESIGN.md](../../../DESIGN.md)).

**Fixture:** [`test-data/anytone/at-d890uv/DMRZone.CSV`](../../../test-data/anytone/at-d890uv/DMRZone.CSV)

## Headers

| Header                             | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `No.`                              | Zone index                                            |
| `Zone Name`                        | Wire zone name; case-sensitive FK                     |
| `Zone Channel Member`              | Pipe-separated channel names                          |
| `Zone Channel Member RX Frequency` | Pipe-separated RX MHz (aligned with members)          |
| `Zone Channel Member TX Frequency` | Pipe-separated TX MHz                                 |
| `A Channel`                        | A-side active channel name                            |
| `A Channel RX Frequency`           | A-side RX MHz                                         |
| `A Channel TX Frequency`           | A-side TX MHz                                         |
| `B Channel`                        | B-side active channel name                            |
| `B Channel RX Frequency`           | B-side RX MHz                                         |
| `B Channel TX Frequency`           | B-side TX MHz                                         |
| `Zone Hide `                       | Hide zone flag (`0` / `1`) — trailing space in header |

## Internal mapping

| Wire                      | Internal (target)                                      |
| ------------------------- | ------------------------------------------------------ |
| `Zone Name`               | Build zone entry `wireName`                            |
| `Zone Channel Member`     | Ordered `memberChannelIds` via name → UUID at boundary |
| A/B channel + frequencies | Format-specific active-channel hints for CPS           |
| `Zone Hide `              | Build layout export flag (TBD)                         |

Member order in pipe-separated columns must stay aligned on import and export.

## Related

- [am-air.md](am-air.md) — `AMZone.CSV` (separate 5-column AM-bank schema; do not reuse DMR columns)
- [scan-lists.md](scan-lists.md)
- [Build zone grouping feature doc](../../features/builds/zone-grouping.md)
