# DM32 — Contacts.csv

DMR private-call contacts (`signalingMode: 'dmr'`).

| Column                                     | Internal             | Notes                              |
| ------------------------------------------ | -------------------- | ---------------------------------- |
| `No.`                                      | _(export only)_      | Sequential on export               |
| `ID`                                       | `Contact.identifier` | DMR ID                             |
| `Repeater`                                 | —                    | Ignored on import; empty on export |
| `Name`                                     | `Contact.name`       |                                    |
| `City` / `Province` / `Country` / `Remark` | —                    | Ignored; empty on export           |
| `Type`                                     | —                    | Always `Private Call` on export    |
| `Alert Call`                               | —                    | `0` on export                      |

Group calls live in `Talkgroups.csv`, not here.
