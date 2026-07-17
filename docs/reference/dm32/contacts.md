# DM32 — Contacts.csv

DMR private-call contacts (`DigitalContact`).

| Column                                     | Internal                   | Notes                                                                                                                                        |
| ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`                                      | _(export only)_            | Sequential on export                                                                                                                         |
| `ID`                                       | `DigitalContact.digitalId` | DMR ID                                                                                                                                       |
| `Repeater`                                 | —                          | Unmodelled; empty on export                                                                                                                  |
| `Name`                                     | `DigitalContact.name`      | Wire name from assemble                                                                                                                      |
| `City` / `Province` / `Country` / `Remark` | —                          | Library has `city` / `state` / `country` / `remarks` — **not exported yet** ([#448](https://github.com/pskillen/codeplug-studio/issues/448)) |
| `Type`                                     | —                          | **Constant** `Private Call` on export                                                                                                        |
| `Alert Call`                               | —                          | **Constant** `0` on export — elicit non-zero values in [#404](https://github.com/pskillen/codeplug-studio/issues/404)                        |

Group calls live in `Talkgroups.csv`, not here.
