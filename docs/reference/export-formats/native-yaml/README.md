# Native YAML wire reference (v1)

Tier 3 schema for Codeplug Studio's full-project interchange format. Internal type semantics (null meaning, mode applicability) are in [data-model](../../../features/data-model/README.md).

**Tracking:** [#56](https://github.com/pskillen/codeplug-studio/issues/56)

**Source:** `src/core/import-export/projectDocument.ts`, `formats/native-yaml/`

## Version fields

| Field                 | Type    | Required | Meaning                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`       | `1`     | yes      | Native YAML envelope version. Only `1` is accepted in this release.                                                                                                                                                                                                                                                                                                                                          |
| `studioSchemaVersion` | integer | yes      | Must equal `STUDIO_SCHEMA_VERSION` in `src/core/models/schemaVersion.ts` (currently `14`). Imports accept `2`–`14`; v9 files without `library.scanLists` migrate on load; legacy `channelOverrides.scanListId` in YAML hoists to `Channel.scanListId` on load; legacy `scanSkip` on channels migrates to `scanInclusion` on load; legacy `ssb-usb` / `ssb-lsb` mode values migrate to `ssb` + `ssbSideband`. |

Bump `schemaVersion` when the YAML envelope shape changes. Bump `studioSchemaVersion` (constant) when persisted row types change.

## Top-level envelope

| Field                 | Type                 | Required          |
| --------------------- | -------------------- | ----------------- |
| `schemaVersion`       | `1`                  | yes               |
| `studioSchemaVersion` | integer              | yes               |
| `project`             | `ProjectMeta` object | yes               |
| `library`             | `Library` object     | yes               |
| `formatBuilds`        | `FormatBuild[]`      | yes (may be `[]`) |

## Persistable row (all entities)

Every stored entity includes:

| Field       | Type              | Notes                                                         |
| ----------- | ----------------- | ------------------------------------------------------------- |
| `id`        | string (UUID)     | Primary key                                                   |
| `projectId` | string (UUID)     | Owning project — must match `project.id` and all sibling rows |
| `revision`  | integer           | Optimistic concurrency counter                                |
| `updatedAt` | string (ISO 8601) | Last mutation timestamp                                       |

## `project` (`ProjectMeta`)

| Field                      | Type                 | Required |
| -------------------------- | -------------------- | -------- |
| _(persistable row fields)_ |                      | yes      |
| `name`                     | string               | yes      |
| `description`              | string               | yes      |
| `notes`                    | string               | yes      |
| `author`                   | string               | yes      |
| `createdAt`                | string (ISO 8601)    | yes      |
| `interchange`              | `ProjectInterchange` | no       |

### `interchange` (`ProjectInterchange`)

Optional portable destination memory — updated on import **or** export. Omitted when never synced to a file.

**`localFile`**

| Field        | Type              | Required | Notes                         |
| ------------ | ----------------- | -------- | ----------------------------- |
| `fileName`   | string            | yes      | Last local import/export name |
| `exportedAt` | string (ISO 8601) | yes      | Last portable sync timestamp  |

**`googleDrive`**

| Field             | Type              | Required | Notes                                                                        |
| ----------------- | ----------------- | -------- | ---------------------------------------------------------------------------- |
| `folderId`        | string            | yes      |                                                                              |
| `folderName`      | string            | no       |                                                                              |
| `fileId`          | string            | yes      |                                                                              |
| `fileName`        | string            | yes      |                                                                              |
| `exportedAt`      | string (ISO 8601) | yes      | Last portable sync timestamp                                                 |
| `remoteProjectId` | string            | no       | Last known `project.id` in linked file at sync (IndexedDB only; not in YAML) |

CPS format destination keys (e.g. `opengd77`) are reserved for Phase 4+.

## `library` object

| Key               | Type               |
| ----------------- | ------------------ |
| `channels`        | `Channel[]`        |
| `zones`           | `Zone[]`           |
| `talkGroups`      | `TalkGroup[]`      |
| `digitalContacts` | `DigitalContact[]` |
| `analogContacts`  | `AnalogContact[]`  |
| `rxGroupLists`    | `RxGroupList[]`    |
| `scanLists`       | `ScanList[]`       |

Arrays may be empty. Serialiser emits all seven keys.

### `Channel`

| Field                 | Type                                | Nullable |
| --------------------- | ----------------------------------- | -------- |
| _(persistable row)_   |                                     |          |
| `name`                | string                              | no       |
| `callsign`            | string                              | no       |
| `rxFrequency`         | number (Hz)                         | yes      |
| `txFrequency`         | number (Hz)                         | yes      |
| `location`            | `{ lat: number; lon: number }`      | yes      |
| `useLocation`         | boolean                             | no       |
| `hideFromInternalMap` | boolean                             | no       | Optional; when `true`, channel omitted from internal Codeplug Studio maps only (not CPS export) |
| `maidenheadLocator`   | string                              | yes      |
| `power`               | number (0–100)                      | yes      |
| `scanInclusion`       | `default` \| `skip` \| `alwaysScan` | no       | Legacy `scanSkip` boolean accepted on import (`true`→`skip`, `false`→`default`)                 |
| `scanListId`          | string (UUID)                       | yes      | Optional FK to `library.scanLists[].id` — Channel.CSV Scan List column                          |
| `comment`             | string                              | no       |
| `primaryMode`         | channel mode string                 | yes      | Optional; dual-mode CPS primary (`fm`, `dmr`, …)                                                |
| `modeProfiles`        | `ChannelModeProfile[]`              | no       |

Mode profile discriminant is `mode`. DMR profiles may include `dmrMode: dmo-simplex | repeater | null` (`null` = infer at export from RX/TX). See [data-model](../../../features/data-model/README.md) for per-mode fields. Analog `ssb` profiles may include `ssbSideband: usb | lsb` (defaults to `usb`). Import accepts legacy `ssb-usb` / `ssb-lsb` mode strings and normalises them on load.

### `Zone`

| Field               | Type                | Notes                                                                                                                |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| _(persistable row)_ |                     |                                                                                                                      |
| `name`              | string              |                                                                                                                      |
| `members`           | `ZoneMemberEntry[]` | `kind: channel` (`channelId`, optional `includeInScanList`: `default`\|`include`\|`skip`) or `kind: zone` (`zoneId`) |
| `comment`           | string              |                                                                                                                      |
| `omitFromExport`    | boolean             | optional; when `true`, zone omitted from `Zones.csv` export row (nested flatten into parents still applies)          |
| `order`             | integer             | optional; 1-based library baseline for top-level zone export order (build `zoneOverrides.orderOrSlot` wins when set) |

DM32 zone export flags (`exportScanList`, `scanCarrierFrequencyHz`) live on **`zoneGrouping` layout zone entries**, not on library zones (schema v4+). Legacy `exportScratchChannel` on zone entries is accepted on import but ignored on export — use build `exportSettings.exportScratchChannels` ([#140](https://github.com/pskillen/codeplug-studio/issues/140)).

### `TalkGroup` / `DigitalContact`

| Field               | Type                                    |
| ------------------- | --------------------------------------- |
| _(persistable row)_ |                                         |
| `mode`              | digital mode string (`dmr`, `dstar`, …) |
| `name`              | string                                  |
| `digitalId`         | integer                                 |
| `comment`           | string                                  |

### `AnalogContact`

| Field               | Type   |
| ------------------- | ------ |
| _(persistable row)_ |        |
| `name`              | string |
| `code`              | string |
| `comment`           | string |

### `RxGroupList`

| Field               | Type                                                      |
| ------------------- | --------------------------------------------------------- |
| _(persistable row)_ |                                                           |
| `name`              | string                                                    |
| `members`           | `{ ref: EntityRef; timeSlotOverride?: 1 \| 2 \| null }[]` |

### `ScanList`

| Field               | Type       |
| ------------------- | ---------- |
| _(persistable row)_ |            |
| `name`              | string     |
| `memberChannelIds`  | `string[]` |

### `EntityRef`

| Field  | Type          | Values                                                    |
| ------ | ------------- | --------------------------------------------------------- |
| `kind` | string        | `channel`, `talkGroup`, `digitalContact`, `analogContact` |
| `id`   | string (UUID) | Must resolve in `library`                                 |

## `formatBuilds[]`

| Field                           | Type                             |
| ------------------------------- | -------------------------------- |
| _(persistable row)_             |                                  |
| `formatId`                      | string                           |
| `profileId`                     | string                           |
| `name`                          | string                           |
| `layout`                        | `TraitLayout`                    |
| `channelOverrides`              | `BuildEntityOverride[]`          |
| `zoneOverrides`                 | `BuildEntityOverride[]`          |
| `talkGroupOverrides`            | `BuildEntityOverride[]`          |
| `rxGroupListOverrides`          | `BuildEntityOverride[]`          |
| `scanListOverrides`             | `BuildEntityOverride[]`          |
| `contactOverrides`              | `BuildEntityOverride[]`          |
| `exportUnlinkedChannels`        | boolean (optional)               |
| `exportUnlinkedTalkGroups`      | boolean (optional)               |
| `exportUnlinkedRxGroupLists`    | boolean (optional)               |
| `exportUnlinkedDigitalContacts` | boolean (optional)               |
| `exportUnlinkedAnalogContacts`  | boolean (optional)               |
| `exportSettings`                | `BuildExportSettings` (optional) |
| `cpsWireHydration`              | `CpsWireHydration` (optional)    |

`exportSettings` fields: `defaultScanInclusion`, `shortenNames`, `maxNameLength`, `nameModeOverride`, `useChannelAbbreviation`, `useTalkGroupAbbreviation`, `exportZoneDerivedScanLists`, `expandModes`, `expandRxGroupLists`, …

`cpsWireHydration` is a labelled escape hatch for unmodelled CPS donor/retain bags used at merge export (`formatId` discriminant + opaque `retain`). NeonPlug bags use `formatId: neonplug` — see [neonplug/merge.md](../neonplug/merge.md). Not wire-stash for modelled library entities. **Required interchange behaviour:** when present on a build, native YAML export must emit it and import must restore it on the corresponding `formatBuilds[]` row.

Legacy `*Selections` arrays migrate to `*Overrides` on import.

### `BuildEntityOverride`

| Field             | Type    | Notes                                                                    |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `libraryEntityId` | string  | Required — plain channel UUID, or composite expansion key (see below)    |
| `excluded`        | boolean | Omit entity from this build's export                                     |
| `forceInclude`    | boolean | Zone overrides only — export standalone despite library `omitFromExport` |
| `wireName`        | string  | CPS wire string override                                                 |
| `orderOrSlot`     | number  | 1-based top-level export position; CHIRP gaps → blank memory slots       |

Sparse storage: omit keys when unset at export.

**Channel override `libraryEntityId` shapes** (build `channelOverrides` only):

| Shape                     | Example                                  | When used                                                                     |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Plain channel UUID        | `22222222-2222-4222-8222-222222222222`   | Default wire-name override for the channel                                    |
| Multi-mode expansion      | `{channelId}:-D`                         | Per-mode row when `exportSettings.expandModes` is true (`-D`, `-F`, `-DS`, …) |
| Multi-talkgroup expansion | `{channelId}:-D:talkGroup:{talkGroupId}` | Per RX-list member row when multi-talkgroup expansion is active               |

Import validates that the underlying channel (and talk group ref, when present) exists in the library. Other override arrays (`zoneOverrides`, `talkGroupOverrides`, …) use plain entity UUIDs only.

### `TraitLayout`

| Field      | Type                   |
| ---------- | ---------------------- |
| `sections` | `TraitLayoutSection[]` |

Section discriminant is `kind`:

**`zoneGrouping`**

| Field   | Type                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| `kind`  | `zoneGrouping`                                                                                |
| `zones` | `{ id, name, channelIds, exportScratchChannel?, exportScanList?, scanCarrierFrequencyHz? }[]` |

**`flatMemory`**

| Field        | Type                      |
| ------------ | ------------------------- |
| `kind`       | `flatMemory`              |
| `channelIds` | string[]                  |
| `scanFlags`  | `Record<string, boolean>` |

**`scanLists`** (legacy layout — import only)

| Field       | Type                         |
| ----------- | ---------------------------- |
| `kind`      | `scanLists`                  |
| `scanLists` | `{ id, name, channelIds }[]` |

Legacy build layout scan lists hoist to `library.scanLists` on import; new projects curate scan lists in the library ([#257](https://github.com/pskillen/codeplug-studio/issues/257)).

## Serialisation rules (#57)

- Keys sorted alphabetically at each object level for stable diffs
- Array order preserved from the in-memory model
- Nullable fields emit YAML `null` explicitly (not omitted)
- No wire stash or CPS provenance fields

## Validation rules (#58)

Import rejects when:

1. YAML cannot be parsed
2. Top-level shape is not an object with required keys
3. `schemaVersion !== 1`
4. `studioSchemaVersion` not in `2`–`14` (current `STUDIO_SCHEMA_VERSION`)
5. Any row has `projectId` ≠ `project.id`
6. Duplicate `id` within one entity array
7. Any `EntityRef` or `libraryEntityId` does not resolve (channel overrides accept plain UUIDs or composite expansion keys — see `BuildEntityOverride`)
8. Zone `members` contain non-channel refs
9. `TraitLayout` `channelIds` missing from library
10. DMR `rxGroupListId` missing from library

**Nullable fields:** columns marked nullable in the tables above may be omitted from YAML or set to `null`; import normalises both to `null` in the library model. Export may omit keys when the stored row has no value (e.g. legacy IndexedDB rows).

**Optional string fields** on mode profiles (e.g. YSF `wiresDtmfId`, D-STAR `rpt1Call` / `rpt2Call`) may be omitted; import applies the same defaults as `defaultModeProfile` in `src/core/domain/modeProfiles.ts` (empty string, or `CQCQCQ` for D-STAR `urCall`, or `none` for analogue tones). SSB `ssbSideband` defaults to `usb` when omitted.

## Example document

```yaml
schemaVersion: 1
studioSchemaVersion: 2
project:
  id: 11111111-1111-4111-8111-111111111111
  projectId: 11111111-1111-4111-8111-111111111111
  revision: 1
  updatedAt: '2026-07-02T10:00:00.000Z'
  name: Demo project
  description: ''
  notes: ''
  author: ''
  createdAt: '2026-07-02T10:00:00.000Z'
library:
  analogContacts: []
  channels:
    - id: 22222222-2222-4222-8222-222222222222
      projectId: 11111111-1111-4111-8111-111111111111
      revision: 1
      updatedAt: '2026-07-02T10:00:00.000Z'
      name: GB3DA Demo
      callsign: GB3DA
      rxFrequency: 430912500
      txFrequency: 430912500
      location: null
      useLocation: false
      maidenheadLocator: null
      power: null
      scanSkip: false
      comment: ''
      modeProfiles:
        - mode: fm
          squelch: null
          rxTone: none
          txTone: none
          bandwidthKHz: null
  digitalContacts: []
  rxGroupLists: []
  scanLists: []
  talkGroups: []
  zones: []
formatBuilds:
  - id: 33333333-3333-4333-8333-333333333333
    projectId: 11111111-1111-4111-8111-111111111111
    revision: 1
    updatedAt: '2026-07-02T10:00:00.000Z'
    formatId: opengd77
    profileId: opengd77-1701
    name: OpenGD77 1701
    layout:
      sections: []
    channelSelections:
      - libraryEntityId: 22222222-2222-4222-8222-222222222222
        overrides:
          name: GB3DA Demo
    zoneSelections: []
    talkGroupSelections: []
    rxGroupListSelections: []
    contactSelections: []
```

## Related

- [native-yaml feature doc](../../../features/import-export/native-yaml/README.md)
- [data-model](../../../features/data-model/README.md)
