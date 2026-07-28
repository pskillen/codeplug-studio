# DM32 — RXGroupLists.csv

| Column            | Internal           | Notes                                                                                                                    |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `No.`             | _(export only)_    | Sequential on export                                                                                                     |
| `RX Group Name`   | `RxGroupList.name` | FK from channel `RX Group List`; shortened when export **Shorten long names** is on and name exceeds profile `nameLimit` |
| `Contact Members` | `memberRefs`       | Pipe-separated talk-group / contact **names**                                                                            |

**Member cap:** 32 members per list ([dm-32uv](../../radios/baofeng/dm-32uv/README.md) · [profiles.md](profiles.md)).

**List-count cap:** at most **32** RX group lists per export (`maxRxGroupLists`). When the build has more, Studio truncates `RXGroupLists.csv` and emits an overflow warning — same ceiling on NeonPlug and `radio-io-dm32uv` ([#804](https://github.com/pskillen/codeplug-studio/issues/804)).

**`ALL` list:** CPS meta list — channel column `ALL` references this name. Member pipe list is opaque wire text; preserve verbatim on bidirectional mapping.
