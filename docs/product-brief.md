# Codeplug Studio — product brief

**What it is:** a free, browser-based designer for amateur (ham) radio "codeplugs" — the channel/zone/contact configuration loaded onto a digital or analogue handheld radio. Runs entirely client-side (Vite + React + TypeScript SPA), no account, no server database. Live at [codeplug.mm9pdy.net](https://codeplug.mm9pdy.net).

Author: Patrick Skillen (MM9PDY). Licensed CC BY-NC-SA 4.0 (non-commercial, share-alike). Repo: [pskillen/codeplug-studio](https://github.com/pskillen/codeplug-studio).

## The problem it solves

Programming a ham radio normally means: manufacturer-specific Windows-only CPS software, one codeplug per radio with no shared source of truth, hand-typing repeater/talkgroup data, and (for digital/DMR radios especially) painful CSV column-wrangling that varies wildly by vendor.

Codeplug Studio gives operators **one library, many radios**: curate channels, talk groups, contacts, and zones once, then assemble a tailored "build" per radio. From a build, export a CPS-ready file, a NeonPlug package, or write the radio directly from the browser over Web Serial — no vendor CPS required for supported radios.

## Core model

- **Library** — the operator's single source of truth: channels, talk groups, contacts, zone definitions.
- **Build** — a per-radio assembly: which library entries are included, how they're organised (zones vs. flat list, scan lists, etc.), and per-radio name overrides.
- **Egress path** — how a build leaves the browser: a CPS file (CSV), a NeonPlug package, or a direct Web Serial write to the radio.

This separation means the same repeater channel can appear in a DM-32UV build and an AT-D890UV build without being re-entered, each shaped to how that radio actually organises memory.

## What it does today

- **Library editing** — full CRUD on channels, talk groups, contacts, and zones, in tables/forms and on an embedded map.
- **Pull in real-world data instead of typing it** — search and bulk-import from UK Repeater (ETCC), BrandMeister, IRTS Ireland, and RepeaterBook for repeater channels; RadioID.net for DMR contacts; OpenAIP for airport/airband frequencies. This is the fast path to a populated library — a few clicks generates a working set of channels rather than hand-entry.
- **Direct-to-radio write (Web Serial)** — in-browser programming for every radio target in the catalog (see table below), bypassing vendor CPS entirely for the write step. Includes a "what will be written vs. kept" retain inspector and a cross-session write-verify platform.
- **CPS file export** — CSV in each radio's native format (OpenGD77, CHIRP, DM32, Anytone), plus `.neonplug` packages for radios NeonPlug supports.
- **Native project format** — a YAML file that round-trips a whole project (library + all builds) losslessly; this is also what Google Drive save/load uses.
- **Digital APRS** — vendor-neutral APRS configuration and per-channel bindings, exported to the formats/radios that support it.
- **Airband** — import civil aviation frequencies from OpenAIP as receive-only AM channels (currently Anytone-specific export).
- **Google Drive** — save/load native-YAML projects to the operator's own Drive; no Studio-side storage.

### Correcting the aspiration in older docs

Earlier docs describe Studio as "import-first" — reading vendor CPS files accurately, as the hard problem worth investing in. That was inherited from the archived `codeplug-tool` prototype and hasn't been built here yet: **Studio does not import CSV/CPS files from any radio today.** What _is_ shipped, and arguably more useful day-to-day, is one-click import from third-party repeater/contact/airport directories — you can't backfill an existing codeplug from a CPS export, but you can generate a fresh library in a few clicks. CPS file import is a documented but unbuilt intentional goal (see `DESIGN.md`).

Similarly, older docs call Web Serial write a "planned" capability. It has since shipped for every radio in the catalog — direct serial write is now a core part of the product, to the point that for supported radios it's close to being a full replacement for the vendor CPS.

## Radio and feature support matrix

Every radio below can be written directly from the browser via Web Serial. Codeplug organisation (zones vs. flat list, scan lists, DMR/talk groups) is dictated by how that radio actually works, not by a lowest-common-denominator model.

| Radio                   | Type           | Channels |     Zones     | Scan lists       |   DMR / talk groups   | Digital APRS | Web Serial write | CPS CSV export | NeonPlug export |
| ----------------------- | -------------- | :------: | :-----------: | ---------------- | :-------------------: | :----------: | ---------------- | -------------- | :-------------: |
| Baofeng UV-5R Mini      | Analogue FM    |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅               | CHIRP CSV      |       ✅        |
| Baofeng UV-21Pro V2     | Analogue FM    |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅ *             | CHIRP CSV      |        —        |
| Retevis RT95 VOX        | Analogue FM    |    ✅    | — (flat list) | per-channel flag |           —           |      —       | ✅               | CHIRP CSV      |        —        |
| Baofeng DM-32UV         | DMR            |    ✅    |      ✅       | dedicated lists  |          ✅           |      ✅      | ✅               | DM32 CSV       |       ✅        |
| Baofeng DM-1701 / RT-84 | DMR (OpenGD77) |    ✅    |      ✅       | zone = scan list | ✅ (multi-TG/channel) | — (deferred) | ✅               | OpenGD77 CSV   |        —        |
| TYT MD-9600 / RT-90     | DMR (OpenGD77) |    ✅    |      ✅       | zone = scan list | ✅ (multi-TG/channel) | — (deferred) | ✅               | OpenGD77 CSV   |        —        |
| Anytone AT-D890UV       | DMR            |    ✅    |      ✅       | dedicated lists  |          ✅           |      ✅      | ✅               | Anytone CSV    |        —        |

\* UV-21Pro V2 Web Serial write ships with AM mode not yet encoded (FM/NFM only), and hardware read→write→read-back verification is still pending.

**Reading the table:**

- **Zones**: the three analogue radios have no zone concept — every channel lives in one flat, ordered memory list, with scan handled per-channel instead of via named lists or zone grouping.
- **Scan lists**: DM-32UV and AT-D890UV have dedicated named scan lists distinct from zones. The two OpenGD77 targets don't have a separate scan-list entity — zone membership _is_ the scan scope.
- **DMR / talk groups**: only the four digital radios; the analogue set is FM/AM-only, so talk groups don't apply.
- **Digital APRS**: modelled and exportable on DM-32UV and AT-D890UV (including AT-D890UV serial write of APRS settings). OpenGD77 analogue-style APRS is explicitly out of scope for now.

## Platform / integration features

| Feature                                                             | Status                       |
| ------------------------------------------------------------------- | ---------------------------- |
| Google Drive save/load (native YAML)                                | Shipped                      |
| OneDrive, Dropbox                                                   | Planned, not started         |
| UK Repeater (ETCC), BrandMeister, IRTS Ireland, RepeaterBook import | Shipped                      |
| RadioID.net DMR contact import                                      | Shipped                      |
| OpenAIP airport/airband import                                      | Shipped                      |
| CPS file import (any vendor)                                        | Not started — see note above |
| Satellite keps (TLE fetch, library, radio write)                    | Not started                  |
| Satellite pass-prediction tracking dashboard                        | Not started                  |

## Explicit non-goals

- Replacing vendor CPS as the _only_ programming path — file export and third-party tools (CHIRP, NeonPlug) stay first-class, since Web Serial write doesn't cover every radio or every field.
- A cloud backend — browser storage (IndexedDB) plus optional Drive OAuth only; nothing is uploaded unless the operator chooses Drive.
- Perfect round-trip fidelity or merge idempotency — export is a best-effort projection from the library; documented losses over faked fidelity.
- Supporting every CPS format or radio on day one — the radio-target catalog grows incrementally (see `src/core/radio-targets/catalog.ts`).

## Architecture in one paragraph

Single-page app: `src/core/` (zero React — models, domain logic, import/export adapters, format-specific wire code), `src/integrations/` (browser I/O: persistence, Google Drive, remote directory APIs, Web Serial radio-io), `src/app/` (React routes/components). No backend; deployed to Cloudflare Pages. Full detail in [`DESIGN.md`](../DESIGN.md).

## Where to go for more

| Need                                | Doc                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Full product/architecture reference | [`DESIGN.md`](../DESIGN.md)                                            |
| Feature-by-feature contributor docs | [`docs/features/README.md`](features/README.md)                        |
| Per-radio wire/protocol reference   | [`docs/reference/radios/`](reference/radios/README.md)                 |
| Per-format CPS wire reference       | [`docs/reference/export-formats/`](reference/export-formats/README.md) |
| Build/deploy/OAuth setup            | [`docs/build/README.md`](build/README.md)                              |
