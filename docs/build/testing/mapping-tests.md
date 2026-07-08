# Mapping tests

**Purpose:** Define how we prove vendor ↔ internal model conversions are correct. This is the **primary** testing concern for import/export work. For layer boundaries and npm scripts, see the [testing hub](README.md).

**Studio thesis:** Test each direction independently — do not rely on full import→export→re-import equality as the main gate. See [DESIGN.md — Testing](../../DESIGN.md#testing).

## Internal model as hub

All vendor formats convert through the vendor-neutral **library** and **format build** layout (`src/core/models/`). Import adapters parse CPS files into library entities (and optionally build trait state). Export runs `assemble(build, library)` then serialises the projection to wire columns.

```mermaid
flowchart LR
  subgraph vendor [VendorFormats]
    FormatA["OpenGD77 CSV"]
    FormatB["CHIRP CSV"]
  end
  subgraph internal [InternalModel]
    Library["Library entities"]
    Build["FormatBuild + traits"]
  end
  FormatA -->|"import mapping test"| Library
  Library --> Assemble["assemble(build, library)"]
  Build --> Assemble
  Assemble -->|"export mapping test"| FormatA
  Library -->|"cross-format export"| FormatB
```

Wire-format column detail: `docs/reference/<format>/`. Strategy docs cite **outcomes** (golden snapshots, lossy fields), not every column.

## Required mapping tests

| Direction                    | Input                                 | Assert                                                                      |
| ---------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| **Wire → internal (import)** | CPS fixture files                     | Expected library entities + build trait layout (golden JSON/YAML snapshots) |
| **Internal → wire (export)** | Constructed library + build in memory | Expected CPS columns/rows (golden files or normalised snapshots)            |
| **Assemble**                 | Library + `FormatBuild`               | Export projection object before serialisation                               |

## Import fidelity

**Definition:** Each vendor row maps to the correct library fields (and build layout when the format carries organisation).

| Concern                   | Where to test                                                    |
| ------------------------- | ---------------------------------------------------------------- |
| Column → field mapping    | Unit tests beside `parse.ts`                                     |
| File classification       | Adapter `detectKind` tests                                       |
| Multi-file batch assembly | `importIntoLibrary` integration tests                            |
| UUID FK resolution        | Import resolves wire names to library `id` refs at boundary only |

**Rules:**

- Parse by **header name**, never column index.
- Channel names are **case-sensitive** wire identifiers at the format edge.
- Rows that fail validation should surface in import result errors; skipped files reported explicitly.

**Code anchors (planned):** `src/core/import-export/formats/<format>/`, `src/core/services/importIntoLibrary.ts`.

## Export fidelity

**Definition:** Each library entity and build layout field maps to the correct vendor columns and values — from **typed model fields**, not provenance replay.

| Concern                         | Where to test                                             |
| ------------------------------- | --------------------------------------------------------- |
| Field → column mapping          | Unit tests beside `serialise.ts`                          |
| Trait layout → zones/scan lists | Per-format export with constructed `FormatBuild`          |
| Name-based FK denormalisation   | Wire names resolved from UUID refs at serialise time only |

**Code anchors:** `src/core/import-export/formats/<format>/`, `src/core/services/exportBuild.ts`, `src/core/services/assemble.ts`.

## Scenario taxonomy

| Scenario                         | What it proves                              | Layer                                                 | Status                                                                                                                              |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Import mapping**               | Fixture → golden library (+ build)          | Adapter + service                                     | Planned (Phase 4+)                                                                                                                  |
| **Export mapping**               | Constructed library + build → golden wire   | Adapter + service                                     | Shipped (OpenGD77, DM32, CHIRP `serialise.test.ts` / `exportGolden.test.ts`)                                                        |
| **Assemble**                     | Trait profile shapes export projection      | Unit / service                                        | Shipped (`assemble.test.ts`)                                                                                                        |
| **Wire preview**                 | Overrides + expansion + shortening in UI    | `previewWireRows.test.ts`                             | Shipped ([#87](https://github.com/pskillen/codeplug-studio/issues/87)–[#90](https://github.com/pskillen/codeplug-studio/issues/90)) |
| **Export mapping (OpenGD77)**    | Constructed library + build → Channels.csv  | `serialise.test.ts`                                   | Shipped — includes multi-mode expansion                                                                                             |
| **Export mapping (DM32)**        | Minimal library + synthetic golden bundle   | `formats/dm32/serialise.test.ts`, `dm32CsvCompare.ts` | Shipped — RX-list fan-out, zone scan, v1.60 header parity; excludes `No.`, `Scan List`, `DMR ID`, unmodelled APRS defaults          |
| **Export mapping (CHIRP)**       | Fixture-derived library + flat memory build | `formats/chirp/exportGolden.test.ts`                  | Shipped — per-profile golden CSV compare; excludes `Location`, `Comment`; analogue FM/AM only                                       |
| **Export mapping (Anytone)**     | Minimal library + synthetic golden bundle   | `formats/anytone/exportGolden.test.ts`                | Shipped — `Channel.CSV`, `DMRZone.CSV`, `ScanList.CSV`; excludes unmodelled `Channel.CSV` defaults and `No.`                        |
| **Same-format round-trip smoke** | A → internal → A roughly stable             | Optional integration                                  | Secondary — not primary gate                                                                                                        |
| **Cross-format**                 | A → library → B export                      | Adapter matrix                                        | Planned                                                                                                                             |
| **Lossy fields**                 | Known non-surviving columns documented      | Reference + mapping tests                             | Per `docs/reference/<format>/`                                                                                                      |

### Round-trip (optional smoke only)

Full re-import equality is useful as a **smoke** test when import and export both exist, but failures must be diagnosed via directional golden tests. Do not stash raw wire cells in metadata to make round-trip pass.

Pattern (when adapters ship):

- Deterministic ids via test harness stub.
- Compare normalised wire output or semantic library equality — not opaque provenance bags.

## Adapter matrix (fill as formats ship)

| Format   | Import golden | Export golden                                         | Round-trip smoke |
| -------- | ------------- | ----------------------------------------------------- | ---------------- |
| OpenGD77 | Planned       | Shipped (`serialise.test.ts`)                         | Optional         |
| CHIRP    | Planned       | Shipped (`exportGolden.test.ts`, `serialise.test.ts`) | Optional         |
| DM32     | Planned       | Shipped (`serialise.test.ts`, `warnings.test.ts`)     | Optional         |
| Anytone  | Planned       | Shipped (`exportGolden.test.ts`, `serialise.test.ts`) | Optional         |

## Related

- [Testing hub](README.md)
- [Adding a new format](../features/import-export/adding-a-new-format.md) — canonical adapter checklist
- [Fixtures](fixtures.md)
- [Unit tests](unit.md)
- [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) — export-time expansion rules
