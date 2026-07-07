# Anytone — RadioIDList.CSV

DMR radio ID labels referenced from `Channel.CSV` (`Radio ID` column).

**Fixture:** [`test-data/anytone/at-d890uv/RadioIDList.CSV`](../../../test-data/anytone/at-d890uv/RadioIDList.CSV)

## Headers

| Header     | Purpose                         |
| ---------- | ------------------------------- |
| `No.`      | Index                           |
| `Radio ID` | Numeric DMR ID (e.g. `1234567`) |
| `Name`     | Label referenced by channels    |

## Internal mapping

| Wire       | Internal (target)                                      |
| ---------- | ------------------------------------------------------ |
| `Radio ID` | `ChannelModeProfileDMR.dmrId` or build/profile default |
| `Name`     | Wire label; resolved by name on import                 |

Accepted pattern: multiple channels share one radio ID row. Export may use profile default when unmodelled (similar to DM32 `DMR-ID.csv` gap).

## Related

- [channels.md](channels.md)
