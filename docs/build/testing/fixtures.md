# Test fixtures

**Purpose:** Where CPS test data lives, how to load it, and how to normalise before comparing import/export output.

## Committed vs local

| Location | Committed | Use |
| --- | --- | --- |
| `src/core/import-export/formats/<format>/__fixtures__/` | **Planned** | Per-format golden import/export files |
| `sample-exports/` | Gitignored | Operator manual testing — personal codeplugs stay local |
| `e2e/fixtures/` | **Planned** | Minimal bundle for Playwright import → export |

**Privacy:** Committed fixtures stay **synthetic and minimal** or **public repeater data** only. Do not commit personal codeplugs without explicit review.

## Target layout (Phase 4+)

```
src/core/import-export/formats/opengd77/
  __fixtures__/
    import/
      minimal-channels/     # CPS CSV bundle → golden library JSON
    export/
      lean-dmr-zone/        # library + build JSON → golden CSV rows
```

```
src/core/import-export/formats/chirp/
  __fixtures__/
    import/
      uv5r-mini.csv
    export/
      flat-memories.json
```

Golden snapshots for library + build should be **vendor-neutral JSON** — not wire stash in entity metadata.

## Normalisation for comparisons

When comparing export wire output:

- Sort rows by stable key (channel name, zone name) unless order is semantically significant.
- Normalise line endings to LF.
- Strip generated timestamps from filenames in tests.
- Compare frequencies at consistent precision (Hz internally; MHz on wire).

## Loading helpers

Fixture loaders live beside adapters (planned):

- `loadFixtureBundle(path)` → `File[]` or parsed rows for import tests.
- `loadGoldenLibrary(path)` → typed `Library` + `FormatBuild` for export tests.

## Related

- [Mapping tests](mapping-tests.md)
- [Unit tests](unit.md)
- [OpenGD77 reference](../../reference/opengd77/README.md)
