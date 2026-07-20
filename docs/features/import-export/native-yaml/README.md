# Native YAML interchange

Studio's **full-project** portable format: `ProjectMeta`, all library entities, and every `FormatBuild` in one YAML file.

**Tracking:** [#56](https://github.com/pskillen/codeplug-studio/issues/56)–[#60](https://github.com/pskillen/codeplug-studio/issues/60)  
**Tier 3 schema:** [docs/reference/native-yaml/README.md](../../../reference/native-yaml/README.md)

**Source:** `src/core/import-export/formats/native-yaml/` · services in `src/core/services/`

## Purpose

Native YAML lets operators and contributors:

- Back up an entire project outside IndexedDB
- Move projects between browsers and Google Drive ([#61](https://github.com/pskillen/codeplug-studio/issues/61)–[#62](https://github.com/pskillen/codeplug-studio/issues/62))
- Round-trip Studio's own model **losslessly** — unlike CPS CSV export

IndexedDB remains the live edit store with per-entity revision concurrency. YAML is **interchange**, not the session working copy ([storage.md](../../../poc-migration/storage.md)).

## What is in the document

| Section        | Internal type   | Notes                                                                     |
| -------------- | --------------- | ------------------------------------------------------------------------- |
| `project`      | `ProjectMeta`   | Operator metadata row; optional `interchange` portable destination memory |
| `library`      | `Library`       | Channels, zones, contacts, talk groups, RX lists                          |
| `formatBuilds` | `FormatBuild[]` | Per-target builds with selections, overrides, trait layout                |

Envelope fields `schemaVersion` and `studioSchemaVersion` are documented in the tier 3 reference.

## Code anchors

| Module                          | Role                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `projectDocument.ts`            | `StudioProjectDocument`, `ProjectAggregate`, envelope helpers |
| `serialise.ts`                  | `ProjectAggregate` → YAML string                              |
| `parse.ts`                      | YAML string → structural parse                                |
| `validate.ts`                   | Schema version, FK integrity → `ProjectAggregate`             |
| `adapter.ts`                    | Registry-facing import/export adapter                         |
| `importProjectYaml.ts`          | Parse → seed → `seedProject` / `replaceProject`               |
| `exportProjectYaml.ts`          | `loadProjectSeed` → serialise; optional `interchange` meta    |
| `projectImportExportService.ts` | App facade over persistence singleton                         |

`ProjectAggregate` in core mirrors `ProjectSeed` in `integrations/persistence/types.ts`. Application services bridge the two via `ProjectInterchangePort`.

## Import modes (#59)

`project.id` in native YAML is the **portable project identity** — it should stay stable across Drive open/save and multi-device sync ([#361](https://github.com/pskillen/codeplug-studio/issues/361)).

| Mode               | Behaviour                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seedPreservingId` | YAML `project.id` unused locally → `seedProject` with that id (Home / Drive first open) ([#361](https://github.com/pskillen/codeplug-studio/issues/361)) |
| `createNew`        | Fresh `projectId` on meta and every row; `seedProject` — **explicit** “Import as new project” only                                                       |
| `replaceExisting`  | YAML `project.id` must match active project; `replaceProject` (full wipe)                                                                                |
| `adoptRemote`      | Replace active project content while keeping local `project.id` ([#334](https://github.com/pskillen/codeplug-studio/issues/334))                         |

**Intentional id-change paths:** `createNew` (operator chooses duplicate); `adoptRemote` (local id wins — next Save may rewrite Drive `project.id` to local).

| Entry                                         | Mode               | UUID outcome      |
| --------------------------------------------- | ------------------ | ----------------- |
| Home → Open from Drive (unknown UUID)         | `seedPreservingId` | Preserved         |
| Home → local file (unknown UUID)              | `seedPreservingId` | Preserved         |
| Home → Open from Drive (UUID exists)          | `replaceExisting`  | Preserved         |
| Replace active (match)                        | `replaceExisting`  | Preserved         |
| Replace active / Refresh (mismatch) → Replace | `adoptRemote`      | Local kept        |
| Refresh / modal → Import as new               | `createNew`        | New (intentional) |
| Save to Drive                                 | export only        | Preserved         |

No merge heuristics or CPS `importMerge` — native YAML is model-first replace only.

Rejected imports throw with a clear message:

- Malformed YAML syntax
- Unsupported `schemaVersion` or `studioSchemaVersion`
- Duplicate entity `id` within a collection
- Inconsistent `projectId` across rows
- Broken UUID FK (zone member, contact ref, build selection, trait layout channel id, …)
- `replaceExisting` when YAML project id ≠ active project id (UI may offer `adoptRemote` instead — Import / export **Replace active** panel and Drive refresh)

Nullable model fields may be omitted from YAML or set to `null` — import treats both as `null` (see [tier 3 validation rules](../../../reference/native-yaml/README.md#validation-rules-58)).

## Export path

```text
loadProjectSeed → ProjectAggregate
  → optional recordExportDestination on meta (localFile / googleDrive)
  → serialise → YAML download
  → putProjectMeta when recording destination
```

`ProjectMeta.interchange.localFile` and `interchange.googleDrive` remember the last portable destination. `exportedAt` is updated on **import and export** — it is the last successful sync timestamp used for dirty detection ([#285](https://github.com/pskillen/codeplug-studio/issues/285)).

## Implementation status

| Slice                             | Status                                                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts + envelope (#56)        | Shipped                                                                                                                                                                                                                                |
| Export serialiser (#57)           | Shipped                                                                                                                                                                                                                                |
| Import parser + validation (#58)  | Shipped — `studioSchemaVersion` 9; legacy SSB modes migrate on load ([#204](https://github.com/pskillen/codeplug-studio/issues/204)); composite channel override keys ([#336](https://github.com/pskillen/codeplug-studio/issues/336)) |
| Services (#59)                    | Shipped                                                                                                                                                                                                                                |
| Local file UI (#60)               | Shipped                                                                                                                                                                                                                                |
| App chrome Save + import sync     | Shipped ([#285](https://github.com/pskillen/codeplug-studio/issues/285))                                                                                                                                                               |
| Portable project id on first open | Shipped ([#361](https://github.com/pskillen/codeplug-studio/issues/361)) — `seedPreservingId` for unknown UUID on Home / Drive open                                                                                                    |

## Testing

Directional golden fixtures — not round-trip as the primary gate ([DESIGN.md — Testing](../../../DESIGN.md#testing)):

- `__fixtures__/export/` — constructed aggregate → expected YAML
- `__fixtures__/import/` — hand-authored YAML → expected aggregate
- `src/test/system/nativeYamlInterchange.test.ts` — export → replace → reload (`npm run test:system`)

## Related

- [import-export hub](../README.md)
- [data-model](../../data-model/README.md)
- Cloud / merge follow-ups: epic [#499](https://github.com/pskillen/codeplug-studio/issues/499) · schema migration [#532](https://github.com/pskillen/codeplug-studio/issues/532)
