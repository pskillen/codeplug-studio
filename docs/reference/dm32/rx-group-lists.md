# DM32 — RXGroupLists.csv

| Column | Internal | Notes |
| --- | --- | --- |
| `No.` | _(export only)_ | Sequential on export |
| `RX Group Name` | `RxGroupList.name` | FK from channel `RX Group List` |
| `Contact Members` | `memberRefs` | Pipe-separated talk-group / contact **names** |

**Cap:** 32 members per list ([baofeng-dm32uv.md](radios/baofeng-dm32uv.md)).

**`ALL` list:** CPS meta list — channel column `ALL` references this name. Member pipe list is opaque wire text; preserve verbatim on bidirectional mapping.
