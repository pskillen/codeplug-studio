# Native YAML interchange

Studio's **full-project** portable format: `ProjectMeta`, all library entities, and every `FormatBuild` in one YAML file.

**Tracking:** [#56](https://github.com/pskillen/codeplug-studio/issues/56) · [#57](https://github.com/pskillen/codeplug-studio/issues/57) · [#58](https://github.com/pskillen/codeplug-studio/issues/58)  
**Tier 3 schema:** [docs/reference/native-yaml/README.md](../../../reference/native-yaml/README.md)

**Source:** `src/core/import-export/formats/native-yaml/`

## Purpose

Native YAML lets operators and contributors:

- Back up an entire project outside IndexedDB
- Move projects between browsers (future: Google Drive — [#61](https://github.com/pskillen/codeplug-studio/issues/61))
- Round-trip Studio's own model **losslessly** — unlike CPS CSV export

IndexedDB remains the live edit store with per-entity revision concurrency. YAML is **interchange**, not the session working copy ([storage.md](../../../poc-migration/storage.md)).

## What is in the document

| Section        | Internal type   | Notes                                                      |
| -------------- | --------------- | ---------------------------------------------------------- |
| `project`      | `ProjectMeta`   | Operator metadata row                                      |
| `library`      | `Library`       | Channels, zones, contacts, talk groups, RX lists           |
| `formatBuilds` | `FormatBuild[]` | Per-target builds with selections, overrides, trait layout |

Envelope fields `schemaVersion` and `studioSchemaVersion` are documented in the tier 3 reference.

## Code anchors

| Module               | Role                                                          |
| -------------------- | ------------------------------------------------------------- |
| `projectDocument.ts` | `StudioProjectDocument`, `ProjectAggregate`, envelope helpers |
| `serialise.ts`       | `ProjectAggregate` → YAML string                              |
| `parse.ts`           | YAML string → structural parse                                |
| `validate.ts`        | Schema version, FK integrity → `ProjectAggregate`             |
| `adapter.ts`         | Registry-facing import/export adapter                         |

`ProjectAggregate` in core mirrors `ProjectSeed` in `integrations/persistence/types.ts`. Application services bridge the two in [#59](https://github.com/pskillen/codeplug-studio/issues/59).

## Import path

```text
YAML file
  → parse (yaml package)
  → validate (schema + FK checks)
  → ProjectAggregate
  → [future #59] replaceProject / seedProject
```

Rejected imports throw with a clear message:

- Malformed YAML syntax
- Unsupported `schemaVersion` or `studioSchemaVersion`
- Duplicate entity `id` within a collection
- Inconsistent `projectId` across rows
- Broken UUID FK (zone member, contact ref, build selection, trait layout channel id, …)

No merge heuristics or wire-name idempotency — unlike the archive `importMerge` stack.

## Export path

```text
ProjectAggregate (from persistence assemble)
  → StudioProjectDocument envelope
  → serialise (stable key order, explicit nulls)
  → YAML file
```

Export does **not** update `ProjectMeta.interchange` (export destination memory) — that ships in [#59](https://github.com/pskillen/codeplug-studio/issues/59).

## Implementation status

| Slice                            | Status  |
| -------------------------------- | ------- |
| Contracts + envelope (#56)       | Shipped |
| Export serialiser (#57)          | Shipped |
| Import parser + validation (#58) | Shipped |
| Services + UI (#59–#62)          | Planned |

## Testing

Directional golden fixtures — not round-trip as the primary gate ([DESIGN.md — Testing](../../../DESIGN.md#testing)):

- `__fixtures__/export/` — constructed aggregate → expected YAML
- `__fixtures__/import/` — hand-authored YAML → expected aggregate

## Related

- [import-export hub](../README.md)
- [data-model](../../data-model/README.md)
- [native-yaml-progress.md](../native-yaml-progress.md)
