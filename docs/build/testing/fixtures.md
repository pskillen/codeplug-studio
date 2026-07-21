# Test fixtures

**Purpose:** Where CPS test data lives, how to load it, and how to normalise before comparing import/export output.

## Committed vs local

| Location                                                | Committed           | Use                                                                                          |
| ------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `src/core/import-export/formats/<format>/__fixtures__/` | Yes (where present) | Per-format golden import/export files                                                        |
| `test-data/<format>/`                                   | Yes                 | Larger redacted CPS bundles for docs + mapping spikes                                        |
| `test-data/export-smoke/`                               | Yes                 | Native YAML for CI export → wire-verify smoke ([wire-verification.md](wire-verification.md)) |
| `cps-verify/fixtures/<format>/<profile>/`               | Yes                 | Wire-shape verifier samples ([wire-verification.md](wire-verification.md))                   |
| `sample-codeplugs/`                                     | Yes                 | Unadulterated CPS exports for wire-doc ground truth (DM32 v1.60 · OpenGD77 R2025.03.23.1)    |
| `sample-exports/`                                       | Gitignored          | Operator manual testing — personal codeplugs stay local                                      |
| `e2e/fixtures/`                                         | **Planned**         | Minimal bundle for Playwright import → export                                                |

**Privacy:** Prefer **synthetic and minimal** fixtures for automated tests. Committed `sample-codeplugs/` bundles are reviewed CPS exports used as wire reference — not a dump of every personal export. Keep day-to-day personal codeplugs in gitignored `sample-exports/`.

**Line endings:** Mapping goldens under `test-data/` and `__fixtures__/` are often LF-normalised for diff stability. Verifier good samples must match documented Studio export endings (Anytone/DM32 **CRLF**; OpenGD77/CHIRP **LF**).

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
