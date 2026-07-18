# CPS wire verification

External **wire-shape** checks for CPS CSV bundles (directory or ZIP). Complements directional mapping/golden tests: this suite proves mechanical CPS rules (line endings, quoting, headers, name FKs, cardinality, required files), not semantic projection equality.

**Tracking:** [#480](https://github.com/pskillen/codeplug-studio/issues/480) (parent [Epic #161](https://github.com/pskillen/codeplug-studio/issues/161)). Progress: [cps-verify-progress.md](cps-verify-progress.md). CI export-smoke is [#481](https://github.com/pskillen/codeplug-studio/issues/481).

## Terminology

| Term | Field | Examples |
| --- | --- | --- |
| **Format** | `formatId` | `anytone`, `dm32`, `opengd77`, `chirp` |
| **Variant / profile** | `profileId` | `anytone-at-d890uv`, `dm32-baofeng-dm32uv`, `opengd77-1701`, `chirp-uv5r` |

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

| Script | Command | Role |
| --- | --- | --- |
| CLI | `npm run verify:codeplug -- --format anytone [--profile anytone-at-d890uv] path` | Operator / local check |
| Vitest | `npm run test:cps-verify` | Fixture-driven suite; JUnit in CI |

`npm test` does **not** include `cps-verify/`.

## CI

[`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) runs `npm run test:cps-verify` and publishes **CPS wire verify** via Dorny (`test-results/cps-verify-junit.xml`).

## Formats / profiles

| Format | Profile (default) | Status | Notes |
| --- | --- | --- | --- |
| `anytone` | `anytone-at-d890uv` | Shipped | Universal quoting + CRLF |
| `dm32` | `dm32-baofeng-dm32uv` | Shipped | Selective quoting + CRLF |
| `opengd77` | `opengd77-1701` | Shipped | Selective quoting + LF |
| `chirp` | `chirp-uv5r` | Shipped | Single CSV; selective quoting + LF |

## Adding a format / profile plugin

1. Gap-fill tier-3 **Wire verification** under `docs/reference/<format>/`.
2. Add `cps-verify/src/formats/<formatId>/` with SOURCES header.
3. Register in `cps-verify/src/formats/registry.ts`.
4. Add `fixtures/<formatId>/<profileId>/good` + crafted `bad/`.
5. Add Vitest under `cps-verify/tests/`.

## Related

- [Testing hub](README.md)
- [Fixtures](fixtures.md)
- [Anytone file format](../../reference/anytone/file-format.md)
