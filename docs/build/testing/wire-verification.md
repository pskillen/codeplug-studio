# CPS wire verification

External **wire-shape** checks for CPS CSV bundles (directory or ZIP). Complements directional mapping/golden tests: this suite proves mechanical CPS rules (quoting, CRLF, headers, name FKs, cardinality, required files), not semantic projection equality.

**Tracking:** [#480](https://github.com/pskillen/codeplug-studio/issues/480) (parent [Epic #161](https://github.com/pskillen/codeplug-studio/issues/161)). CI export-smoke that runs export → verify is [#481](https://github.com/pskillen/codeplug-studio/issues/481).

## Why

Golden and adapter tests can miss defects that CPS rejects on radio write (e.g. wrong line endings, dangling zone members, over-limit lists). The verifier reads CPS files the same way an operator would hand them to CPS.

## Layout

```text
cps-verify/
  src/           # shared load/report/rules + format plugins
  fixtures/      # CRLF good samples + crafted bad snippets
  tests/         # Vitest suite (separate from npm test)
  vitest.config.ts
```

Tier-3 docs remain the canon. The Anytone plugin header lists every `docs/reference/anytone/` source it enforces.

## npm scripts

| Script | Command                                                          | Role                                      |
| ------ | ---------------------------------------------------------------- | ----------------------------------------- |
| CLI    | `npm run verify:codeplug -- --format anytone path/to/dir-or-zip` | Operator / local check; exit 0 on success |
| Vitest | `npm run test:cps-verify`                                        | Fixture-driven suite; JUnit in CI         |

`npm test` does **not** include `cps-verify/` (excluded in root Vite config).

## CI

[`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) runs `npm run test:cps-verify` and publishes results with [dorny/test-reporter](https://github.com/dorny/test-reporter) as **CPS wire verify** (`test-results/cps-verify-junit.xml`).

## Formats

| Format id               | Status  | Notes                                                                                        |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `anytone`               | Shipped | AT-D890UV structural rules from [docs/reference/anytone/](../../reference/anytone/README.md) |
| OpenGD77 / DM32 / CHIRP | Not yet | Register a plugin under `cps-verify/src/formats/`                                            |

## Adding a format plugin

1. Gap-fill tier-3 docs under `docs/reference/<format>/` for every rule you will enforce.
2. Add `cps-verify/src/formats/<format>/` with a module comment listing those doc paths.
3. Register in `cps-verify/src/formats/registry.ts`.
4. Add `cps-verify/fixtures/<format>/good` (CRLF) and crafted `bad/` cases.
5. Add Vitest coverage under `cps-verify/tests/`.

## Related

- [Testing hub](README.md)
- [Fixtures](fixtures.md)
- [Anytone file format](../../reference/anytone/file-format.md)
