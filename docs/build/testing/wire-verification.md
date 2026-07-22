# CPS wire verification

External **wire-shape** checks for CPS CSV bundles (directory or ZIP). Complements directional mapping/golden tests: this suite proves mechanical CPS rules (line endings, quoting, headers, name FKs, cardinality, required files), not semantic projection equality.

**Tracking:** [#480](https://github.com/pskillen/codeplug-studio/issues/480) verifier · [#481](https://github.com/pskillen/codeplug-studio/issues/481) export smoke · [#491](https://github.com/pskillen/codeplug-studio/issues/491) granular Dorny report (parent [Epic #161](https://github.com/pskillen/codeplug-studio/issues/161)). Progress: [cps-verify-progress.md](cps-verify-progress.md).

## Terminology

| Term                  | Field       | Examples                                                                                                |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| **Format**            | `formatId`  | `anytone`, `dm32`, `opengd77`, `chirp`                                                                  |
| **Variant / profile** | `profileId` | `anytone-at-d890uv`, `dm32-baofeng-dm32uv`, `opengd77-1701`, `chirp-uv5r` / `chirp-uv21` / `chirp-rt95` |

Fixtures and plugins are **profile-scoped** so sibling radios (e.g. future AT-D878) do not collide.

## Docs ↔ suite sync contract

1. **Tier-3 is canon** — every rule `cps-verify` enforces must appear under `docs/reference/<format>/` (and `radios/` for caps).
2. Each format plugin module header **lists every tier-3 path** it enforces.
3. Changing wire rules, caps, quoting, or line endings → update **docs and** `cps-verify` rules/fixtures/tests in the **same PR**.
4. Fixture endings match documented Studio export: Anytone/DM32 **CRLF**; OpenGD77/CHIRP **LF**.

## Layout

```text
cps-verify/
  src/
    formats/<formatId>/     # plugin + default profile
    rules/                  # shared engines
  fixtures/<formatId>/<profileId>/{good,bad/...}
  tests/
  vitest.config.ts
```

## npm scripts

| Script | Command                                                                          | Role                              |
| ------ | -------------------------------------------------------------------------------- | --------------------------------- |
| CLI    | `npm run verify:codeplug -- --format anytone [--profile anytone-at-d890uv] path` | Operator / local check            |
| Vitest | `npm run test:cps-verify`                                                        | Fixture-driven suite; JUnit in CI |

`npm test` does **not** include `cps-verify/`.

## CI

[`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) runs `npm run test:cps-verify` and publishes **CPS wire verify** via Dorny (`test-results/cps-verify-junit.xml`).

That Vitest run includes:

1. Baked `fixtures/<format>/<profile>/{good,bad}` shape checks
2. **Export smoke** ([#481](https://github.com/pskillen/codeplug-studio/issues/481)) — see below

Good fixtures and export-smoke register **one Vitest case per named check** ([#491](https://github.com/pskillen/codeplug-studio/issues/491)) so Dorny lists e.g. `headers.Channel.CSV`, `fk.zone.members`, not a single profile-level pass.

## Check outcomes (granular reporting)

Plugins implement `verifyDetailed(files, profileId) → CheckOutcome[]`. Each outcome is a check that **actually ran** (file present / applicable):

| Field         | Role                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `check.id`    | Stable id for Vitest/JUnit titles (e.g. `physical.Channel.CSV.line-endings`) |
| `check.rule`  | Rule taxonomy (`line-endings`, `foreign-key`, …) — used by bad fixtures      |
| `check.label` | Short human label                                                            |
| `diagnostics` | Failures for that check (empty = pass)                                       |

`verify()` / CLI flatten outcomes for exit-code compatibility. CLI prints `PASS`/`FAIL` per check via `formatVerifyDetailedResult`.

**Adding a check:** when you add a wire rule, emit a new `checkOutcome({ id, rule, label }, diagnostics)` from the format plugin — the next `test:cps-verify` run surfaces it as its own Dorny row automatically.

## Export smoke (YAML → ZIP → verify)

Proves Studio’s real export packaging path produces **wire-valid** CPS for each verifier-supported profile. Shape-only — not content projection ([#482](https://github.com/pskillen/codeplug-studio/issues/482)).

```text
test-data/export-smoke/rich-project.yaml
  → parseProjectDocument
  → exportBuildZip (multi-file) or exportBuildSingleFile (CHIRP)
  → verifyDetailed (in-memory ZIP/CSV)
  → it.each(CheckOutcome)
```

| Piece               | Path                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Native YAML fixture | [`test-data/export-smoke/rich-project.yaml`](../../../test-data/export-smoke/rich-project.yaml)       |
| Harness             | [`cps-verify/tests/export-smoke.test.ts`](../../../cps-verify/tests/export-smoke.test.ts)             |
| Profiles            | `anytone-at-d890uv`, `dm32-baofeng-dm32uv`, `opengd77-1701`, `chirp-uv5r`, `chirp-uv21`, `chirp-rt95` |

Same core serialisation as UI **Download ZIP** (`exportBuildZip`); IndexedDB and browser download are not involved. Multi-file formats unzip in-memory so ZIP packaging is exercised.

## Formats / profiles

| Format     | Profile (default)                              | Status  | Notes                              |
| ---------- | ---------------------------------------------- | ------- | ---------------------------------- |
| `anytone`  | `anytone-at-d890uv`                            | Shipped | Universal quoting + CRLF           |
| `dm32`     | `dm32-baofeng-dm32uv`                          | Shipped | Selective quoting + CRLF           |
| `opengd77` | `opengd77-1701`                                | Shipped | Selective quoting + LF             |
| `chirp`    | `chirp-uv5r` (also `chirp-uv21`, `chirp-rt95`) | Shipped | Single CSV; selective quoting + LF |

## Adding a format / profile plugin

1. Gap-fill tier-3 **Wire verification** under `docs/reference/<format>/`.
2. Add `cps-verify/src/formats/<formatId>/` with SOURCES header.
3. Register in `cps-verify/src/formats/registry.ts`.
4. Add `fixtures/<formatId>/<profileId>/good` + crafted `bad/`.
5. Add Vitest under `cps-verify/tests/` using `itEachCheckOutcome` for good paths.

## Related

- [Testing hub](README.md)
- [Fixtures](fixtures.md)
- [Anytone file format](../../reference/anytone/file-format.md)
