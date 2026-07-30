# Codeplug Studio

**Codeplug Studio** is a browser-based designer for amateur radio codeplug layouts.

Curate your channels, talk groups, and contacts once, then build a version for each radio you program. When you're ready, write the radio directly from your browser over Web Serial, or export files your radio's own programming software (CPS) already understands. Nothing is uploaded, and nothing leaves your machine unless you choose to write a radio plugged into it or save to Google Drive.

## What Codeplug Studio is not

- It isn't a full replacement for your CPS. Export (file or direct write) is a best-effort translation, so a file you export and re-import may not come back identical, and some radio-specific settings stay CPS-only. See [DESIGN.md](DESIGN.md) for what that means in practice.
- It doesn't import your existing codeplug from a vendor CPS file (yet) — see [What you can do](#what-you-can-do) below for what import means today.

## Try it

| Environment              | URL                                                          |
| ------------------------ | ------------------------------------------------------------ |
| **Live**                 | [codeplug.mm9pdy.net](https://codeplug.mm9pdy.net)           |
| **Next** (tracks `main`) | [next.codeplug.mm9pdy.net](https://next.codeplug.mm9pdy.net) |

Staging and dev preview sites are listed in [docs/build/README.md](docs/build/README.md).

## What you can do

- **Keep one library.** Maintain a single master list of channels, talk groups, contacts, and zones. Edit them in tables and forms, or see them on a map.
- **Build for each radio.** Assemble a build per radio and CPS workflow — group channels into zones, set scan lists, and tune the names each radio shows. The same library channel can appear in several builds.
- **Write your radio, or export a file.** For every radio in the [support table](#radios-and-supported-features) below, write the build straight to the radio from your browser over Web Serial — no vendor CPS needed for that step. Prefer a file? Export CPS-ready CSVs (OpenGD77, CHIRP, DM32, Anytone) or a NeonPlug package instead.
- **Import a whole project.** Studio's own YAML file round-trips a project (library + builds) losslessly — this is also what Google Drive save/load uses. Importing directly from a vendor CPS file isn't supported yet.
- **Pull in repeater and contact data.** Generate a library in a few clicks from third-party sources instead of typing it: repeater directories (UK Repeater, BrandMeister, IRTS Ireland, RepeaterBook), DMR contacts (RadioID.net), and airport/airband frequencies (OpenAIP). This can't backfill an existing codeplug, but it's the fastest way to a populated one.
- **Look things up.** Built-in band and Maidenhead locator references, plus a project summary that flags gaps in your library.

## Radios and supported features

Every radio below can be written directly from your browser over Web Serial. How a build is organised — zones vs. a flat channel list, dedicated scan lists vs. a per-channel flag, DMR talk groups — follows how that radio actually works.

| Radio                   | Channels |     Zones     | Scan lists       |   DMR / talk groups   | Digital APRS | Web Serial write | CPS file export | NeonPlug export |
| ----------------------- | :------: | :-----------: | ---------------- | :-------------------: | :----------: | ---------------- | --------------- | :-------------: |
| Baofeng UV-5R Mini      |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅               | CHIRP CSV       |       ✅        |
| Baofeng UV-21Pro V2     |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅ *             | CHIRP CSV       |        —        |
| Retevis RT95 VOX        |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅               | CHIRP CSV       |        —        |
| Baofeng DM-32UV         |    ✅    |      ✅       | dedicated lists  |          ✅           |      ✅      | ✅               | DM32 CSV        |       ✅        |
| Baofeng DM-1701 / RT-84 |    ✅    |      ✅       | zone = scan list | ✅ (multi-TG/channel) |      —       | ✅               | OpenGD77 CSV    |        —        |
| TYT MD-9600 / RT-90     |    ✅    |      ✅       | zone = scan list | ✅ (multi-TG/channel) |      —       | ✅               | OpenGD77 CSV    |        —        |
| Anytone AT-D890UV       |    ✅    |      ✅       | dedicated lists  |          ✅           |      ✅      | ✅               | Anytone CSV     |        —        |

\* UV-21Pro V2 Web Serial write doesn't encode AM mode yet (FM/NFM only), and hardware round-trip verification is still pending.

Other integrations: Google Drive save/load is shipped; OneDrive and Dropbox are planned. Satellite keps and pass-prediction tracking are on the roadmap, not started.

Full context for a newcomer or an agent picking this up cold: [docs/product-brief.md](docs/product-brief.md).

## Privacy

Your projects stay in your browser. There's no account and no server database — nothing leaves your machine unless you choose to save to Google Drive. Map keys and any sign-in tokens are stored locally too.

## How it works

A few principles keep the tool predictable:

- **Export is a projection.** Files (and direct radio writes) come out of your library and builds; where a format can't hold something, we document the loss rather than hide it.
- **Library first, then builds.** You curate once; each build shapes that library for one radio.
- **Vendor-neutral core.** Radio limits and column names live only at the import/export edge, never in the library itself.

Full detail and architecture: [DESIGN.md](DESIGN.md).

## Documentation

| If you want to                 | Start here                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Get a self-contained overview  | [docs/product-brief.md](docs/product-brief.md)                                                                               |
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
