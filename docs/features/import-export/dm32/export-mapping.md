# DM32 export mapping

Product-level overview of how Codeplug Studio projects **library + build** into Baofeng DM-32UV CPS CSV files.

**Wire tables:** [docs/reference/dm32/](../../../reference/dm32/README.md)  
**Code:** `src/core/import-export/formats/dm32/`

## Input

- **`AssembledBuild`** — export projection from `assemble(build, library)` (channels, zones, contacts, talk groups, RX lists with wire names and overrides).
- **`LibrarySlice`** — raw library entities for RX-list member expansion (`expandMultiTalkGroupMemberWireRows`).
- **`CpsExportOptions`** — export-time name shortening, TG abbreviation, profile override.

## Output files

| File | Source |
| --- | --- |
| `Channels.csv` | Expanded channel rows (RX-list fan-out; `expandModes: false`) |
| `Zones.csv` | Assembled zones; member names match expanded channel wire names |
| `Talkgroups.csv` | Assembled talk groups with profile name limits |
| `Contacts.csv` | Digital contacts (private call wire shape) |
| `RXGroupLists.csv` | Assembled RX group lists |
| `DTMFContacts.csv` | Analog contacts |
| `Scan.csv` | Zone-derived scan synthesis ([#129](../../issues/129)) when enabled |

## Expansion rules (DM32-specific)

| Option | Value | Effect |
| --- | --- | --- |
| `expandModes` | `false` | Multi-mode channels stay on one row (`Fixed Analog` / `Fixed Digital`) |
| `expandRxGroupLists` | `true` | One channel row per RX-list member |
| `skipExpandWhenTxContactSet` | `true` | Skip fan-out when channel has both TX contact and RX list |
| Non-expandable lists | `ALL` | Native CPS list — no fan-out |

## Documented loss

- `DMR-ID.csv` — not exported; channel `DMR ID` column uses profile default label.
- Scan import — export may emit `Scan.csv`; import deferred to Phase 5b.

## Related

- [dm32/README.md](README.md) — feature hub
- [name-shortening.md](../name-shortening.md) — wire name pipeline
