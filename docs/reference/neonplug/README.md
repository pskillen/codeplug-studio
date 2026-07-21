# NeonPlug interchange reference

> **Studio status:** Channel + DM32UV org export + `.neonplug` ZIP shipped ([#539](https://github.com/pskillen/codeplug-studio/issues/539), [#540](https://github.com/pskillen/codeplug-studio/issues/540)); merge-into-base + export UI ([#551](https://github.com/pskillen/codeplug-studio/issues/551), [#542](https://github.com/pskillen/codeplug-studio/issues/542)); scaffold [#538](https://github.com/pskillen/codeplug-studio/issues/538). Import remains planned under epic [#536](https://github.com/pskillen/codeplug-studio/issues/536). Profiles and adapter live in `src/core/import-export/formats/neonplug/`.

Authoritative reference for **NeonPlug** `.neonplug` files — the backup / interchange format used by [NeonPlug](https://github.com/infamy/NeonPlug) ([neonplug.app](https://neonplug.app)). One wire format among several at Studio’s import/export boundary (siblings: DM32 CSV, CHIRP CSV, OpenGD77, Anytone, native YAML).

**Tracking:** [#537](https://github.com/pskillen/codeplug-studio/issues/537) (this reference) · scaffold [#538](https://github.com/pskillen/codeplug-studio/issues/538) · epic [#536](https://github.com/pskillen/codeplug-studio/issues/536)

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

| JSON key        | Reference                                                                     | Studio modelling                                                                                                                              | Notes                                                                 |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `channels`      | [channels.md](channels.md)                                                    | `Channel[]`                                                                                                                                   | Shared Channel shape across radios                                    |
| `zones`         | [zones.md](zones.md)                                                          | Build **zone grouping** trait layout                                                                                                          | Channel **numbers**, not UUIDs                                        |
| `scanLists`     | [scan-lists.md](scan-lists.md)                                                | Zone-derived scan projection (DM32UV)                                                                                                         | Channel **numbers**; synthetic `{zone} Scan` carriers in `channels[]` |
| `contacts`      | [contacts.md](contacts.md)                                                    | `TalkGroup[]` then `DigitalContact[]`                                                                                                         | Single NeonPlug contact book                                          |
| `rxGroups`      | [rx-groups.md](rx-groups.md)                                                  | `RxGroupList[]`                                                                                                                               | `talkGroupIndices` = DMR IDs                                          |
| `radioIds`      | [contacts.md](contacts.md#dmr-radio-ids)                                      | **Omit** on greenfield (`[]`); **retain** on merge                                                                                            | No operator DMR-ID list in library                                    |
| `quickContacts` | [contacts.md](contacts.md#quick-contacts)                                     | **Omit** on greenfield; **retain** on merge                                                                                                   | Radio talk-group table with raw bytes                                 |
| `radioInfo`     | [radio-info-and-settings.md](radio-info-and-settings.md)                      | Profile stub on greenfield; **retain** on merge                                                                                               | Model string selects radio pathway                                    |
| `radioSettings` | [radio-info-and-settings.md](radio-info-and-settings.md) · [aprs.md](aprs.md) | **`null`** on greenfield; **retain** on merge, then **APRS slice overwrite** ([#559](https://github.com/pskillen/codeplug-studio/issues/559)) | Large DM32 settings bag; APRS globals patched from Studio             |

| `messages` | [radio-info-and-settings.md](radio-info-and-settings.md) | Empty on greenfield; **retain** on merge | Quick text messages |
| `digitalEmergencies` | [radio-info-and-settings.md](radio-info-and-settings.md) | Empty on greenfield; **retain** on merge | |
| `digitalEmergencyConfig` | [radio-info-and-settings.md](radio-info-and-settings.md) | `null` on greenfield; **retain** on merge | |
| `analogEmergencies` | [radio-info-and-settings.md](radio-info-and-settings.md) | Empty on greenfield; **retain** on merge | |
| `encryptionKeys` | [radio-info-and-settings.md](radio-info-and-settings.md) | Empty on greenfield; **retain** on merge | Do not stash secrets in library |
| `exportDate` / `version` | [file-format.md](file-format.md) | Envelope only | |

## Foreign keys (wire edge)

NeonPlug uses **1-based channel numbers** and **list indexes** — not names and not Studio UUIDs. Name fields are display labels only at this boundary.

| From                        | To                              | Key form                                   |
| --------------------------- | ------------------------------- | ------------------------------------------ |
| Zone `channels[]`           | `channels[].number`             | Channel number                             |
| Scan list `channels[]`      | `channels[].number`             | Channel number                             |
| Channel `contactId`         | Talk-group / contact list index | Integer index (`0` = none)                 |
| Channel `rxGroupListId`     | `rxGroups` list                 | `0` = none; else **1-based** list position |
| Channel `scanListId`        | `scanLists` entry               | `0` = none; else **1-based** (max **15**)  |
| Channel `dmrRadioIdIndex`   | `radioIds[]`                    | 0-based index; `255` / omit = none         |
| RX group `talkGroupIndices` | Talk-group **DMR IDs**          | Up to 32 integers (not book indexes)       |

On **import**, Studio must allocate UUID `id` FKs and drop NeonPlug numbers as relationship keys. On **export**, assign stable channel numbers from assemble order / profile rules.

## Studio profiles

| NeonPlug radio    | Studio `profileId`  | Traits                                                  |
| ----------------- | ------------------- | ------------------------------------------------------- |
| DM-32UV / DP570UV | `neonplug-dm32uv`   | Zone grouping + zone-derived scan lists + m×n expansion |
| UV5R-Mini         | `neonplug-uv5rmini` | Flat memory + per-channel scan flag (like CHIRP UV-5R)  |

Per-radio notes and caps: [`radios/`](radios/README.md). DM-32UV caps match DM32 CPS; UV5R-Mini uses NeonPlug binary **999** / **12** (not CHIRP CSV **128** / **7**).

**Out of scope for epic #536:** Yaesu FT-65 / FT-4 / FT-25 (NeonPlug supports them; no Studio pathway yet).

## Lossy / deferred fields (summary)

| Area                      | Greenfield export | Merge-into-base export                                                               |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Radio settings / VFO bags | Omit (`null`)     | **Retain** from donor; **APRS globals overwritten** from Studio ([aprs.md](aprs.md)) |

| Emergencies / messages | Empty / `null` | **Retain** from donor |
| Encryption keys | Empty — never round-trip via library stash | **Retain** opaque from donor (not into library) |
| Radio IDs | Empty (`[]`) | **Always retain** from donor |
| Quick contacts | Empty | **Retain** from donor |
| Unknown Channel bitfields | Export safe defaults (`0` / `false`) | Same (Studio channels overwrite) |
| Scan priority / hang / CTC | Defaults (`ctcScanMode`/`scanTxMode` = 0) | Same (Studio scan lists overwrite) |
| Calibration | Not in `CodeplugData` export surface | Not modelled |

Detail: [radio-info-and-settings.md](radio-info-and-settings.md) · [merge.md](merge.md) · [aprs.md](aprs.md).

## Related

- Epic: [#536](https://github.com/pskillen/codeplug-studio/issues/536)
- Feature hub: [import-export/neonplug](../../features/import-export/neonplug/README.md)
- Merge policy: [merge.md](merge.md)
- Sibling wires: [DM32 CSV](../dm32/README.md), [CHIRP CSV](../chirp/README.md)
- [Data model](../../features/data-model/README.md)
- [Adding a new format](../../features/import-export/adding-a-new-format.md)
