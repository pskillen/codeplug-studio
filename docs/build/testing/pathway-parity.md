# Pathway parity tests

How to assert that **CPS CSV**, **Web Serial Write**, and **NeonPlug** egress pathways for the **same radio target** project the same channel semantics.

**Contract:** [export-pathway-parity.md](../../features/import-export/export-pathway-parity.md) · **Harness:** `src/core/import-export/channelExpansion/__testUtils__/pathwayParity.ts` · **Tracking:** [#779](https://github.com/pskillen/codeplug-studio/issues/779) · parent [#776](https://github.com/pskillen/codeplug-studio/issues/776)

## What this layer proves

Pathway parity tests are **directional**: constructed `Channel` (+ optional `BuildExportSettings`) → compare comparable facts across egress legs. They are **not** import↔export round-trip gates — see [DESIGN.md — Testing](../../DESIGN.md#testing) and [mapping-tests.md](mapping-tests.md).

| Proves                                                          | Does not prove                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| CSV expand/serialise agrees with core serial wire-name pipeline | Full `buildRadioWriteProjection` DTO byte equality (app layer — future extension)               |
| Row count per canonical channel matches across pathways         | `cps-verify` wire-shape (CRLF, FK integrity) — see [wire-verification.md](wire-verification.md) |
| Scan inclusion matches when `compareScanInclusion: true`        | NeonPlug index FKs vs CSV name FKs (legitimate format difference)                               |

## Harness module

`src/core/import-export/channelExpansion/__testUtils__/pathwayParity.ts`

| Export                                                 | Role                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `PathwayProfilePair`                                   | `{ csv, serial, neonplug? }` profile ids for one radio     |
| `PathwayChannelSnapshot`                               | `{ wireNames, rowCount, scanInclusion? }` comparable facts |
| `fmChannelFixture`                                     | Minimal FM channel builder                                 |
| `minimalAssembledBuild`                                | Single-channel `AssembledBuild` for serialise tests        |
| `mergePathwayCsvOptions` / `mergePathwaySerialOptions` | `mergeExportOptions` wiring                                |
| `serialPathwaySnapshot`                                | Serial leg via `assembledChannelExportWireName` (core)     |
| `opengd77CsvPathwaySnapshot`                           | OpenGD77 CSV expand leg                                    |
| `collectOpenGd77PathwaySnapshots`                      | All three legs for one profile pair                        |
| `assertPathwayParity`                                  | Cross-leg equality (`compareScanInclusion` opt-in)         |
| `assertOpenGd77WireNameParity`                         | Thin wrapper for OpenGD77 name tests                       |
| `OPENGD77_PATHWAY_PAIRS`                               | Reference profile pairs (1701 + MD-9600)                   |

**Layer boundary:** the harness stays in `src/core/`. It uses core expansion and wire-name helpers — not `src/app/services/radioIoWriteProjection.ts`. Full DTO comparison for a radio adapter can add a thin app-side `__testUtils__` wrapper that calls `buildRadioWriteProjection` and compares against CSV snapshots.

## Reference test

[`wireNameParity.test.ts`](../../../src/core/import-export/formats/opengd77/wireNameParity.test.ts) — OpenGD77 CSV ↔ serial channel wire names ([#777](https://github.com/pskillen/codeplug-studio/issues/777), shipped). Run:

```bash
npm test -- src/core/import-export/formats/opengd77/wireNameParity.test.ts
```

## Adding a radio target

### 1. Define profile pairs

```typescript
const DM32_PATHWAY_PAIRS = [
  { csv: 'dm32-baofeng-dm32uv', serial: 'radio-io-dm32uv', neonplug: 'neonplug-dm32uv' },
] as const satisfies readonly PathwayProfilePair[];
```

### 2. Implement format-specific CSV extractor

Supply a `PathwayCsvExtractor` that returns `PathwayChannelSnapshot` from your format's expand + serialise path. OpenGD77 uses `opengd77CsvPathwaySnapshot`; DM32/Anytone/CHIRP/NeonPlug need their own extractors (tickets [#784](https://github.com/pskillen/codeplug-studio/issues/784)–[#786](https://github.com/pskillen/codeplug-studio/issues/786)).

For M×N radios, include **site wire names** in `wireNames` when the dimension applies (Anytone [#782](https://github.com/pskillen/codeplug-studio/issues/782)).

### 3. Write a thin test file

```typescript
import { describe, it } from 'vitest';
import {
  assertPathwayParity,
  fmChannelFixture,
  mergePathwayCsvOptions,
  mergePathwaySerialOptions,
  serialPathwaySnapshot,
  type PathwayProfilePair,
} from '@core/import-export/channelExpansion/__testUtils__/pathwayParity.ts';
import { myFormatCsvPathwaySnapshot } from './myFormatPathwayExtractors.ts';

const PAIRS: readonly PathwayProfilePair[] = [/* … */];

describe('MyRadio CSV ↔ serial pathway parity', () => {
  it('agrees on wire names for a representative channel', () => {
    const channel = fmChannelFixture({ name: 'Example' });
    for (const pair of PAIRS) {
      const csvOptions = mergePathwayCsvOptions(undefined, 'myformat', pair.csv);
      const serialOptions = mergePathwaySerialOptions(undefined, pair.serial);
      assertPathwayParity({
        csv: myFormatCsvPathwaySnapshot({ channel, csvOptions, csvProfileId: pair.csv /* … */ }),
        serial: serialPathwaySnapshot(channel, serialOptions, pair.serial),
      });
    }
  });
});
```

### 4. Enable scan comparison when fixing defaults

Known divergence: OpenGD77 serial defaults `skip` where CSV defaults `scan` ([#803](https://github.com/pskillen/codeplug-studio/issues/803)). Until fixed, leave `compareScanInclusion` off (default). After a fix lands, enable:

```typescript
assertPathwayParity(snapshots, { compareScanInclusion: true });
```

### 5. NeonPlug leg (3-way radios)

When the radio has a NeonPlug egress, add a `PathwayNeonplugExtractor` and include it in `assertPathwayParity`. NeonPlug channel numbers are format-specific FKs — compare **wire names and row counts**, not index columns.

## Checklist (new format or radio adapter)

- [ ] Profile pair(s) documented in the test file
- [ ] CSV extractor calls the same expand/serialise path as production export
- [ ] Serial leg uses `serialPathwaySnapshot` or documents why a custom extractor is needed
- [ ] NeonPlug leg added when the catalog target has a NeonPlug egress
- [ ] Row-count assertions for multi-mode / M×N channels
- [ ] Scan inclusion asserted only after pathway defaults agree
- [ ] Linked from [export-pathway-parity.md](../../features/import-export/export-pathway-parity.md) divergence inventory when closing a fix ticket

## Related

- [export-pathway-parity.md](../../features/import-export/export-pathway-parity.md) — must-match dimensions + open divergences
- [adding-a-new-format.md](../../features/import-export/adding-a-new-format.md) §6 Tests
- [adding-a-radio-adapter.md](../../features/radio-read-write/adding-a-radio-adapter.md) §6 Tests
- [mapping-tests.md](mapping-tests.md) — per-direction import/export mapping (orthogonal)
