# Native YAML wire reference (v1)

Tier 3 schema for Codeplug Studio's full-project interchange format. Internal type semantics (null meaning, mode applicability) are in [data-model](../../features/data-model/README.md).

**Tracking:** [#56](https://github.com/pskillen/codeplug-studio/issues/56)

**Source:** `src/core/import-export/projectDocument.ts`, `formats/native-yaml/`

## Version fields

| Field                 | Type    | Required | Meaning                                                                                                                                                                                                     |
| --------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`       | `1`     | yes      | Native YAML envelope version. Only `1` is accepted in this release.                                                                                                                                         |
| `studioSchemaVersion` | integer | yes      | Must equal `STUDIO_SCHEMA_VERSION` in `src/core/models/schemaVersion.ts` (currently `4`). Imports accept `2`, `3`, or `4`; older zone export fields on library `Zone` migrate to DM32 build layout on load. |

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

Optional export destination memory — omitted when never exported.

**`localFile`**

| Field        | Type              | Required |
| ------------ | ----------------- | -------- |
| `fileName`   | string            | yes      |
| `exportedAt` | string (ISO 8601) | yes      |

**`googleDrive`**

| Field        | Type              | Required |
| ------------ | ----------------- | -------- |
| `folderId`   | string            | yes      |
| `folderName` | string            | no       |
| `fileId`     | string            | yes      |
| `fileName`   | string            | yes      |
| `exportedAt` | string (ISO 8601) | yes      |

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

Arrays may be empty. Serialiser emits all six keys.

### `Channel`

| Field               | Type                           | Nullable |
| ------------------- | ------------------------------ | -------- |
| _(persistable row)_ |                                |          |
| `name`              | string                         | no       |
| `callsign`          | string                         | no       |
| `rxFrequency`       | number (Hz)                    | yes      |
| `txFrequency`       | number (Hz)                    | yes      |
| `location`          | `{ lat: number; lon: number }` | yes      |
| `useLocation`       | boolean                        | no       |
| `maidenheadLocator` | string                         | yes      |
| `power`             | number (0–100)                 | yes      |
| `scanSkip`          | boolean                        | no       |
| `comment`           | string                         | no       |
| `modeProfiles`      | `ChannelModeProfile[]`         | no       |

Mode profile discriminant is `mode`. See [data-model](../../features/data-model/README.md) for per-mode fields.

### `Zone`

| Field               | Type          | Notes                    |
| ------------------- | ------------- | ------------------------ |
| _(persistable row)_ |               |                          |
| `name`              | string        |                          |
| `members`           | `EntityRef[]` | `kind` must be `channel` |
| `comment`           | string        |                          |

DM32 zone export flags (`exportScratchChannel`, `exportScanList`, `scanCarrierFrequencyHz`) live on **`zoneGrouping` layout zone entries**, not on library zones (schema v4+).

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

### `EntityRef`

| Field  | Type          | Values                                                    |
| ------ | ------------- | --------------------------------------------------------- |
| `kind` | string        | `channel`, `talkGroup`, `digitalContact`, `analogContact` |
| `id`   | string (UUID) | Must resolve in `library`                                 |

## `formatBuilds[]`

| Field                   | Type                                         |
| ----------------------- | -------------------------------------------- |
| _(persistable row)_     |                                              |
| `formatId`              | string                                       |
| `profileId`             | string                                       |
| `name`                  | string                                       |
| `layout`                | `TraitLayout`                                |
| `channelSelections`     | `{ libraryEntityId, overrides: { name } }[]` |
| `zoneSelections`        | same pattern                                 |
| `talkGroupSelections`   | same pattern                                 |
| `rxGroupListSelections` | same pattern                                 |
| `contactSelections`     | same pattern                                 |

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
4. `studioSchemaVersion` not in `2`, `3`, or `4` (current `STUDIO_SCHEMA_VERSION`)
5. Any row has `projectId` ≠ `project.id`
6. Duplicate `id` within one entity array
7. Any `EntityRef` or `libraryEntityId` does not resolve
8. Zone `members` contain non-channel refs
9. `TraitLayout` `channelIds` missing from library
10. DMR `rxGroupListId` missing from library

**Nullable fields:** columns marked nullable in the tables above may be omitted from YAML or set to `null`; import normalises both to `null` in the library model. Export may omit keys when the stored row has no value (e.g. legacy IndexedDB rows).

**Optional string fields** on mode profiles (e.g. YSF `wiresDtmfId`, D-STAR `rpt1Call` / `rpt2Call`) may be omitted; import applies the same defaults as `defaultModeProfile` in `src/core/domain/modeProfiles.ts` (empty string, or `CQCQCQ` for D-STAR `urCall`, or `none` for analogue tones).

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

- [native-yaml feature doc](../../features/import-export/native-yaml/README.md)
- [data-model](../../features/data-model/README.md)
