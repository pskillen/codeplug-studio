# Unit tests

**Purpose:** Fast, colocated tests for pure functions and single-responsibility modules. See [mapping-tests.md](mapping-tests.md) for adapter integration and directional golden scenarios.

## Convention

- File name: `<module>.test.ts` or `<module>.test.tsx` beside the source file.
- Runner: Vitest (`npm test` runs all `src/**/*.test.ts(x)`).
- Environment: `jsdom` via [`vite.config.ts`](../../../vite.config.ts).

## Layer layout

| Layer | Path | Example tests (shipped) |
| --- | --- | --- |
| **core** | `src/core/` | `maidenhead.test.ts`, `bandPlan.test.ts`, `summary.test.ts`, `references.test.ts`, `validation.test.ts`, `traits.test.ts` |
| **integrations** | `src/integrations/` | `indexedDb.test.ts`, `inMemory.test.ts`, `ukRepeaterClient.test.ts`, `modeCodes.test.ts`, `mapToChannel.test.ts` |
| **app** | `src/app/` | `projectStore.test.ts`, `libraryService.test.ts` |

**Rule:** `core` tests must not import React, Mantine, or browser storage — keep domain and services pure.

## Coverage expectation

**Every exported function in `src/core/domain/` and `src/core/models/` should have unit test coverage** unless it is a thin re-export. Route and component tests are additive, not a substitute for core coverage.

Adapter **integration** (import golden, export golden) belongs in mapping tests beside format adapters, not duplicated across many unit files.

## Unit vs mapping integration

| Unit | Mapping integration |
| --- | --- |
| One CSV row → one channel object | Full bundle → library → golden snapshot |
| `detectKind` by filename/headers | `importIntoLibrary` multi-file batch |
| Single serialiser column formatting | Constructed library + build → wire golden |
| `summariseLibrary` counts | `assemble` + export serialise |

**Rule:** If the test needs more than one adapter call or crosses import+export boundary, prefer [mapping-tests.md](mapping-tests.md) scenarios.

## Deterministic ids

Production code uses `crypto.randomUUID()`. Tests that assert stable ids should stub the generator in the test harness (pattern TBD when import services ship).

## Mocking

- **IndexedDB:** use `inMemory` persistence port in tests (`src/integrations/persistence/inMemory.test.ts`).
- **fetch (repeater APIs):** `vi.stubGlobal` or `vi.spyOn` in integration tests.
- **Geolocation:** stub when UI tests need predictable positions.

## What does not belong here

- Multi-step import → library → build → export → persist ( [system.md](system.md) — planned )
- File picker or download behaviour ( [e2e.md](e2e.md) — planned )
- Full route navigation with real router URLs ( [component.md](component.md) — planned )

## Related

- [Testing hub](README.md)
- [Mapping tests](mapping-tests.md)
- [Fixtures](fixtures.md)
