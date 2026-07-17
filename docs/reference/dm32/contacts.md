# DM32 — Contacts.csv

DMR private-call contacts (`DigitalContact`).

| Column     | Internal                   | Notes                                                                                          |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `No.`      | _(export only)_            | Sequential on export                                                                           |
| `ID`       | `DigitalContact.digitalId` | DMR ID                                                                                         |
| `Repeater` | —                          | Unmodelled — **always empty**                                                                  |
| `Name`     | `DigitalContact.name`      | Wire name from assemble                                                                        |
| `City`     | `DigitalContact.city`      |                                                                                                |
| `Province` | `DigitalContact.state`     | Library `state` → CPS `Province`                                                               |
| `Country`  | `DigitalContact.country`   |                                                                                                |
| `Remark`   | `DigitalContact.remarks`   | Distinct from internal `comment`                                                               |
| `Type`     | —                          | **Constant** `Private Call` (group calls live in `Talkgroups.csv`)                             |
| `Alert Call` | —                        | **Constant** `0` — Studio does not use CPS Alert Call                                          |

`DigitalContact.callsign` is not a DM32 `Contacts.csv` column (Anytone has a separate Callsign column).

Group calls live in `Talkgroups.csv`, not here.
