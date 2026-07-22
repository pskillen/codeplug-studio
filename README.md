# Codeplug Studio

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts.

Curate your channels, talk groups, and contacts once, then build a version for each radio you program. When you're ready, export the files your radio's own programming software (CPS) already understands. Nothing is uploaded and nothing is flashed here — you do the final step in your CPS, the same as always.

## What Codeplug Studio is not

- It isn't a replacement for your CPS. Export is a best-effort translation into each format, so a file you export and re-import may not come back identical. See [DESIGN.md](DESIGN.md) for what that means in practice.
- Direct radio write (Web Serial) is a **planned** capability — until it ships for a given radio, Studio designs the layout and you finish in CHIRP, NeonPlug, or vendor CPS.

## Try it

| Environment              | URL                                                          |
| ------------------------ | ------------------------------------------------------------ |
| **Live**                 | [codeplug.mm9pdy.net](https://codeplug.mm9pdy.net)           |
| **Next** (tracks `main`) | [next.codeplug.mm9pdy.net](https://next.codeplug.mm9pdy.net) |

Staging and dev preview sites are listed in [docs/build/README.md](docs/build/README.md).

## What you can do

- **Keep one library.** Maintain a single master list of channels, talk groups, contacts, and zones. Edit them in tables and forms, or see them on a map.
- **Build for each radio.** Assemble a build per radio and CPS workflow — group channels into zones, set scan lists, and tune the names each radio shows. The same library channel can appear in several builds.
- **Import and export.** Import a whole project from Studio's own YAML file, and export CPS-ready files for the formats you use: OpenGD77, CHIRP, DM32, and Anytone. Importing directly from vendor CPS files is on the way; for now, native YAML round-trips losslessly.
- **Pull in repeater data.** Add channels straight from repeater directories — UK Repeater, BrandMeister, IRTS Ireland, and RepeaterBook — and check existing channels against them.
- **Look things up.** Built-in band and Maidenhead locator references, plus a project summary that flags gaps in your library.

## Privacy

Your projects stay in your browser. There's no account and no server database — nothing leaves your machine unless you choose to save to Google Drive. Map keys and any sign-in tokens are stored locally too.

## How it works

A few principles keep the tool predictable:

- **Import-first.** Reading existing CPS files accurately is the hard part, so that's where the effort goes.
- **Export is a projection.** Files come out of your library and builds; where a format can't hold something, we document the loss rather than hide it.
- **Library first, then builds.** You curate once; each build shapes that library for one radio.
- **Vendor-neutral core.** Radio limits and column names live only at the import/export edge, never in the library itself.

Full detail and architecture: [DESIGN.md](DESIGN.md).

## Documentation

| If you want to                 | Start here                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Understand the product design  | [DESIGN.md](DESIGN.md)                                                                                                       |
| Read how a feature behaves     | [docs/features/README.md](docs/features/README.md)                                                                           |
| Build, deploy, or set up OAuth | [docs/build/README.md](docs/build/README.md)                                                                                 |
| Contribute as an agent         | [AGENTS.md](AGENTS.md)                                                                                                       |
| Write user-facing copy         | [docs/reference/writing-styleguide/help-writing-styleguide.md](docs/reference/writing-styleguide/help-writing-styleguide.md) |
| See the migration background   | [docs/poc-migration/epic-1-context.md](docs/poc-migration/epic-1-context.md)                                                 |

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`).

- `npm run lint` — ESLint
- `npm run test` — Vitest unit tests
- `npm run build` — typecheck and production build

For optional Google Drive and analytics keys, copy [`.env.example`](.env.example) to `.env.local`. See [docs/build/README.md](docs/build/README.md) for details.

## Background

This repository supersedes the archived [codeplug-tool](https://github.com/pskillen/codeplug-tool) prototype — same author, with a new library-and-builds design.

## Disclaimer

Frequency and site data loaded from your CSV files or repeater APIs is a convenience for amateur programming. It isn't authoritative for emergency operations.

## Licence

Copyright © Patrick Skillen.

Released under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/) (CC BY-NC-SA 4.0). You may use, modify, and share this work for **non-commercial** purposes if you give attribution and license any derivatives on the same terms. See [LICENSE](LICENSE).
