# Codeplug Studio

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts. It does not write a radio's binary codeplug or replace vendor CPS.

Curate a **library** of channels, talk groups, and contacts once, then assemble **format-specific builds** for each radio workflow you use. Export CPS-ready files when you are ready; your vendor CPS still handles flashing.

## What it is not

- **No binary flash** — Studio designs layouts and exports interchange files; vendor CPS programs the radio.
- **No CPS replacement** — export is a **projection** from your library and builds. Perfect round-trip is not a goal. See [DESIGN.md](DESIGN.md) for how import and export differ.

## Try it

| Environment              | URL                                                          |
| ------------------------ | ------------------------------------------------------------ |
| **Production**           | [codeplug.mm9pdy.net](https://codeplug.mm9pdy.net)           |
| **Next** (tracks `main`) | [next.codeplug.mm9pdy.net](https://next.codeplug.mm9pdy.net) |

Staging and dev preview URLs are listed in [docs/build/README.md](docs/build/README.md).

## Capabilities

- **Library** — channel, talk group, contact, and zone CRUD; nested zones; bulk edit; browser-local IndexedDB persistence.
- **Format builds** — per-radio workflow: zone grouping, scan lists, wire-name overrides, export shaping, and wire preview before export.
- **Project interchange** — full-project native YAML import/export; optional Google Drive open/save.
- **CPS export** — multi-file or single-file CSV bundles for supported formats: OpenGD77, CHIRP, DM32, and Anytone (AT-D890UV). Export always combines library + build state.
- **CPS import** — native YAML today; vendor CPS import is on the roadmap per format. See [docs/features/import-export/](docs/features/import-export/).
- **Reference data** — repeater directories (UK Repeater, BrandMeister, IRTS Ireland, RepeaterBook), embedded channel map, amateur band and Maidenhead reference pages, project summary report.
- **Privacy** — project data, OAuth tokens, and preferences stay in your browser. There is no operator database on the server.

## How it works

- **Import-first** — thorough CPS → internal mapping at the wire boundary; well-tested per format.
- **Export as projection** — serialise library + build to CPS wire values; documented loss is acceptable.
- **Library, then builds** — one master inventory; each format build assembles what that radio needs.
- **Vendor-neutral core** — radio caps and column mapping live in import/export adapters only.

Full principles and architecture: [DESIGN.md](DESIGN.md).

## Documentation

| For                              | Start here                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Product constitution             | [DESIGN.md](DESIGN.md)                                                                         |
| Feature behaviour (contributors) | [docs/features/README.md](docs/features/README.md)                                             |
| Build, deploy, local OAuth       | [docs/build/README.md](docs/build/README.md)                                                   |
| Agent / contributor workflow     | [AGENTS.md](AGENTS.md)                                                                         |
| Migration background             | [docs/poc-migration/epic-1-context.md](docs/poc-migration/epic-1-context.md)                   |
| Operator workflow diagram        | [docs/features/workflows/operator-lifecycle.md](docs/features/workflows/operator-lifecycle.md) |

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173/`).

- `npm run lint` — ESLint
- `npm run test` — Vitest unit tests
- `npm run build` — typecheck + production bundle

Optional local env vars (Google Drive OAuth, analytics): copy [`.env.example`](.env.example) to `.env.local`. Details in [docs/build/README.md](docs/build/README.md).

## Repository

This repo supersedes the archived [codeplug-tool](https://github.com/pskillen/codeplug-tool) prototype. Same author; new library + builds architecture and product thesis.

## Disclaimer

Frequency and site data loaded from user CSVs or repeater APIs is for amateur programming convenience. It is not authoritative for emergency operations.

## License

No licence file is committed yet. **License: TBD** — see [#331](https://github.com/pskillen/codeplug-studio/issues/331) / owner follow-up before public redistribution.
