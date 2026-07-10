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

Native RGL file — lean export keeps `Receive Group List` FK on `Channel.CSV`. Optional **m×n channel expansion** ([#305](https://github.com/pskillen/codeplug-studio/issues/305)) clears the FK on expanded TG rows; see [export-projections.md](../../features/import-export/anytone/export-projections.md).

## Related

- [talk-groups.md](talk-groups.md)
- [channels.md](channels.md)
