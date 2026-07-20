# NeonPlug interchange reference

> **Studio status:** Wire reference only. Import/export adapters are planned under epic [#536](https://github.com/pskillen/codeplug-studio/issues/536). No `src/core/import-export/formats/neonplug/` yet.

Authoritative reference for **NeonPlug** `.neonplug` files — the backup / interchange format used by [NeonPlug](https://github.com/infamy/NeonPlug) ([neonplug.app](https://neonplug.app)). One wire format among several at Studio’s import/export boundary (siblings: DM32 CSV, CHIRP CSV, OpenGD77, Anytone, native YAML).

**Tracking:** [#537](https://github.com/pskillen/codeplug-studio/issues/537) (this reference) · epic [#536](https://github.com/pskillen/codeplug-studio/issues/536)

## What a `.neonplug` file is

| Property           | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| On-disk extension  | `.neonplug`                                                |
| Container          | ZIP (`application/zip`, DEFLATE)                           |
| Required ZIP entry | `codeplug.json` (exact basename)                           |
| JSON model         | NeonPlug `CodeplugData` (`src/services/codeplugExport.ts`) |
| Envelope `version` | `"1.0.0"` (string) at time of writing                      |
| `exportDate`       | ISO 8601 string                                            |

See [file-format.md](file-format.md) for packaging rules and skip-vs-error guidance.

## Ground truth

| Source                                                                                                      | Role                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [NeonPlug `codeplugExport.ts`](https://github.com/infamy/NeonPlug/blob/main/src/services/codeplugExport.ts) | ZIP ↔ JSON round-trip; `CodeplugData`  |
| [NeonPlug `src/models/`](https://github.com/infamy/NeonPlug/tree/main/src/models)                           | Entity TypeScript shapes               |
| [NeonPlug `src/radios/`](https://github.com/infamy/NeonPlug/tree/main/src/radios)                           | Per-radio capabilities / UV5R mapping  |
| Sample exports from [neonplug.app](https://neonplug.app)                                                    | Fixture candidates for Studio adapters |

NeonPlug is MIT-licensed. Studio docs cite field names and enums from that source; adapters must **map at the boundary** into Studio’s library model — do not treat NeonPlug types as the internal model.

## Entity inventory (`codeplug.json`)

| JSON key                 | Reference                                                | Studio modelling (planned)                              | Notes                                 |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `channels`               | [channels.md](channels.md)                               | `Channel[]`                                             | Shared Channel shape across radios    |
| `zones`                  | [zones.md](zones.md)                                     | Build **zone grouping** trait layout                    | Channel **numbers**, not UUIDs        |
| `scanLists`              | [scan-lists.md](scan-lists.md)                           | Zone-derived / scan trait projection                    | Channel **numbers**                   |
| `contacts`               | [contacts.md](contacts.md)                               | `TalkGroup[]` / `DigitalContact[]` (boundary split TBD) | NeonPlug “contact book” rows          |
| `rxGroups`               | [rx-groups.md](rx-groups.md)                             | `RxGroupList[]`                                         | Talk-group indices                    |
| `radioIds`               | [contacts.md](contacts.md#dmr-radio-ids)                 | Project / radio identity (if modelled)                  | Byte arrays on wire                   |
| `quickContacts`          | [contacts.md](contacts.md#quick-contacts)                | Likely lossy / omit on first export                     | Radio talk-group table with raw bytes |
| `radioInfo`              | [radio-info-and-settings.md](radio-info-and-settings.md) | Profile / export metadata                               | Model string selects radio pathway    |
| `radioSettings`          | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy** — omit or defaults                            | Large DM32 settings bag               |
| `messages`               | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy**                                               | Quick text messages                   |
| `digitalEmergencies`     | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy**                                               |                                       |
| `digitalEmergencyConfig` | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy**                                               |                                       |
| `analogEmergencies`      | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy**                                               |                                       |
| `encryptionKeys`         | [radio-info-and-settings.md](radio-info-and-settings.md) | **Lossy** — do not stash secrets in library             |                                       |
| `exportDate` / `version` | [file-format.md](file-format.md)                         | Envelope only                                           |                                       |

## Foreign keys (wire edge)

NeonPlug uses **1-based channel numbers** and **list indexes** — not names and not Studio UUIDs. Name fields are display labels only at this boundary.

| From                        | To                              | Key form                            |
| --------------------------- | ------------------------------- | ----------------------------------- |
| Zone `channels[]`           | `channels[].number`             | Channel number                      |
| Scan list `channels[]`      | `channels[].number`             | Channel number                      |
| Channel `contactId`         | Talk-group / contact list index | Integer index (`0` = none)          |
| Channel `rxGroupListId`     | `rxGroups` / RX group list      | Integer (`0` = none)                |
| Channel `scanListId`        | `scanLists` entry               | Integer index bits in Channel model |
| Channel `dmrRadioIdIndex`   | `radioIds[]`                    | 0-based index; `255` / omit = none  |
| RX group `talkGroupIndices` | Contact / talk-group numbers    | Up to 32 integers                   |

On **import**, Studio must allocate UUID `id` FKs and drop NeonPlug numbers as relationship keys. On **export**, assign stable channel numbers from assemble order / profile rules.

## Proposed Studio profiles

| NeonPlug radio    | Proposed `profileId` | Closest existing traits                                 |
| ----------------- | -------------------- | ------------------------------------------------------- |
| DM-32UV / DP570UV | `neonplug-dm32uv`    | Zone grouping + zone-derived scan lists (like DM32 CSV) |
| UV5R-Mini         | `neonplug-uv5rmini`  | Flat memory + per-channel scan flag (like CHIRP UV-5R)  |

Per-radio notes: [`radios/`](radios/README.md).

**Out of scope for epic #536:** Yaesu FT-65 / FT-4 / FT-25 (NeonPlug supports them; no Studio pathway yet).

## Lossy / deferred fields (summary)

| Area                      | Planned Studio behaviour (M1 export)       |
| ------------------------- | ------------------------------------------ |
| Radio settings / VFO bags | Omit (`null`) or document defaults         |
| Emergencies               | Empty arrays                               |
| Encryption keys           | Empty — never round-trip secrets via stash |
| Quick contacts / messages | Empty unless a clear library source exists |
| Unknown Channel bitfields | Export safe defaults (`0` / `false`)       |
| Calibration               | Not in `CodeplugData` export surface       |

Detail: [radio-info-and-settings.md](radio-info-and-settings.md).

## Related

- Epic: [#536](https://github.com/pskillen/codeplug-studio/issues/536)
- Feature hub (planned): [import-export/neonplug](../../features/import-export/neonplug/README.md)
- Sibling wires: [DM32 CSV](../dm32/README.md), [CHIRP CSV](../chirp/README.md)
- [Data model](../../features/data-model/README.md)
- [Adding a new format](../../features/import-export/adding-a-new-format.md)
