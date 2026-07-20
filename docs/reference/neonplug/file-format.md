# NeonPlug file format

Container and envelope for `.neonplug` interchange files.

**Ground truth:** [NeonPlug `codeplugExport.ts`](https://github.com/infamy/NeonPlug/blob/main/src/services/codeplugExport.ts)

## Packaging

```text
codeplug-export-<timestamp>.neonplug   (ZIP)
└── codeplug.json                      (single required entry)
```

| Rule                         | Detail                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| MIME                         | `application/zip`                                                      |
| Compression                  | DEFLATE (NeonPlug uses level 6)                                        |
| Required entry name          | Exactly `codeplug.json`                                                |
| Missing `codeplug.json`      | Invalid — NeonPlug throws; Studio import should **error**              |
| Extra ZIP entries            | Not used by NeonPlug today; Studio should ignore unknown entries       |
| Pretty-print                 | NeonPlug writes compact JSON (`JSON.stringify(..., null, 0)`)          |

Suggested Studio download name: `{build-or-project}-export-{ISO-ish}.neonplug` (exact pattern deferred to export UI).

## Envelope fields

Top-level `codeplug.json` always includes entity arrays plus:

| Field         | Type   | Required | Notes                                      |
| ------------- | ------ | -------- | ------------------------------------------ |
| `version`     | string | yes      | Currently `"1.0.0"` (`CODEPLUG_VERSION`)   |
| `exportDate`  | string | yes      | ISO 8601                                   |

Studio export should set both. Import should accept unknown future `version` values with a warning until a breaking schema appears (document when NeonPlug bumps).

## Binary fields in JSON

Some entities store `Uint8Array` in NeonPlug’s in-memory model. On disk they are **JSON number arrays**:

| Entity          | Field          | On-disk form   |
| --------------- | -------------- | -------------- |
| `radioIds[]`    | `dmrIdBytes`   | `number[]`     |
| `quickContacts[]` | `rawData`    | `number[]`     |

Import must reconstruct typed arrays if needed; export must emit number arrays (not base64).

## Skip vs error (import guidance)

| Outcome        | When                                                              |
| -------------- | ----------------------------------------------------------------- |
| **Recognised** | ZIP contains `codeplug.json` that parses as an object             |
| **Error**      | Not a ZIP, missing `codeplug.json`, or JSON parse failure         |
| **Warning**    | Unknown top-level keys, unsupported `radioInfo.model`, empty body |
| **Lossy omit** | Settings / emergencies / encryption — map what Studio models      |

## Delivery note for Studio adapters

Today’s CPS adapters return **string** content (`single-file-cps` / `multi-file`). NeonPlug needs a **binary ZIP**. Options for later scaffold tickets:

1. Serialise JSON string, wrap to ZIP in `exportBuild` / a new delivery variant.
2. Add a binary CPS delivery type that returns `Blob` / `Uint8Array`.

Wire truth remains: one ZIP entry named `codeplug.json`.
