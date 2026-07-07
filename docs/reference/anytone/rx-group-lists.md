# Anytone — DMRReceiveGroupCallList.CSV

DMR receive group lists (promiscuous RX) for AT-D890UV.

**Fixture:** [`test-data/anytone/at-d890uv/DMRReceiveGroupCallList.CSV`](../../../test-data/anytone/at-d890uv/DMRReceiveGroupCallList.CSV)

## Headers

| Header              | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `No.`               | List index                                          |
| `Group Name`        | Wire RGL name; FK from `Channel.Receive Group List` |
| `Contact`           | Pipe-separated talk group **names**                 |
| `Contact TG/DMR ID` | Pipe-separated TG IDs (aligned with names)          |

## Internal mapping

| Wire                | Internal (target)                                  |
| ------------------- | -------------------------------------------------- |
| `Group Name`        | `RxGroupList.name` / build `wireName`              |
| `Contact`           | `RxGroupList.members[]` as talk-group refs         |
| `Contact TG/DMR ID` | Denormalised IDs on wire; validate against TG rows |

Native RGL file — no m×n channel expansion required (contrast DM32).

## Related

- [talk-groups.md](talk-groups.md)
- [channels.md](channels.md)
