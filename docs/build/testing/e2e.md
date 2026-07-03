# End-to-end tests

**Status: planned** — Playwright not installed; no `npm run test:e2e` script.

**Purpose:** Prove real browser behaviour that unit and component tests cannot — file upload, IndexedDB persistence across reload, ZIP download, hash-router navigation at site root (`/`).

## Target command

```bash
npm run test:e2e   # planned
```

## Scope (phased)

| Phase | Scenario                                                      |
| ----- | ------------------------------------------------------------- |
| 1     | Dev server smoke — home loads, footer shows build info        |
| 2     | Create project → add channel → reload → channel still present |
| 3     | Import CPS fixture → library counts match → export download   |
| 4     | Map route — located channel marker visible                    |

## Configuration notes

- Base URL is site root (`/`); hash routes use `#/…`
- Use committed minimal fixtures from [fixtures.md](fixtures.md) — not `sample-exports/`
- Run against `npm run preview` build output in CI (not dev server)

## What not to test here

- Every parser column variant → [mapping-tests.md](mapping-tests.md)
- Domain math → [unit.md](unit.md)

## Related

- [Testing hub](README.md)
- [Fixtures](fixtures.md)
- [docs/build/README.md](../README.md) — Cloudflare Pages deploy
