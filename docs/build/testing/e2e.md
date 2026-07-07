# End-to-end tests

**Status: partial** — Playwright installed; cookie consent smoke shipped ([#176](https://github.com/pskillen/codeplug-studio/issues/176)). Home load and persistence smokes remain ([#162](https://github.com/pskillen/codeplug-studio/issues/162)).

**Purpose:** Prove real browser behaviour that unit and component tests cannot — file upload, IndexedDB persistence across reload, ZIP download, path-based router navigation at site root (`/`).

## Target command

```bash
npm run build && npm run test:e2e
```

Playwright starts `vite preview` on port 4173 automatically (see `playwright.config.ts`).

## Shipped scenarios

| Spec                         | Scenario                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `e2e/cookie-consent.spec.ts` | Banner on first visit; accept/decline persistence; no GA network before opt-in |

## Scope (phased)

| Phase | Scenario                                                      | Status                                                                   |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1     | Dev server smoke — home loads, footer shows build info        | Planned ([#162](https://github.com/pskillen/codeplug-studio/issues/162)) |
| 2     | Create project → add channel → reload → channel still present | Planned ([#162](https://github.com/pskillen/codeplug-studio/issues/162)) |
| 3     | Import CPS fixture → library counts match → export download   | Planned                                                                  |
| 4     | Map route — located channel marker visible                    | Planned                                                                  |

## Configuration notes

- Base URL is site root (`/`); routes use path URLs (`/library/channels`, …)
- Use committed minimal fixtures from [fixtures.md](fixtures.md) — not `sample-exports/`
- Run against `npm run preview` build output in CI (not dev server)

## What not to test here

- Every parser column variant → [mapping-tests.md](mapping-tests.md)
- Domain math → [unit.md](unit.md)

## Related

- [Testing hub](README.md)
- [Fixtures](fixtures.md)
- [docs/build/README.md](../README.md) — Cloudflare Pages deploy
