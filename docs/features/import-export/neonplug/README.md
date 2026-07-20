# NeonPlug interchange — import / export

Product behaviour for NeonPlug `.neonplug` files in Codeplug Studio. Wire tables live in the tier-3 [NeonPlug reference](../../../reference/neonplug/README.md).

**Tracking:** Epic [#536](https://github.com/pskillen/codeplug-studio/issues/536) · scaffold [#538](https://github.com/pskillen/codeplug-studio/issues/538) · channels + ZIP [#539](https://github.com/pskillen/codeplug-studio/issues/539) · wire reference [#537](https://github.com/pskillen/codeplug-studio/issues/537)

**Source:** `src/core/import-export/formats/neonplug/` (profiles, channel export adapter, `.neonplug` ZIP packaging)

## Implementation status

| Area                                                      | Status  | Notes                                                                                                                         |
| --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Wire reference                                            | Shipped | [reference/neonplug/](../../../reference/neonplug/README.md) — [#537](https://github.com/pskillen/codeplug-studio/issues/537) |
| Format scaffold (`FormatId`, catalog, traits)             | Shipped | [#538](https://github.com/pskillen/codeplug-studio/issues/538) — `neonplug` in catalog; profiles + `TRAIT_PROFILES`           |
| Export channels + `.neonplug` ZIP                         | Shipped | [#539](https://github.com/pskillen/codeplug-studio/issues/539) — `assemble` → `codeplug.json` → fflate ZIP; empty org arrays  |
| Export zones / scan / contacts / RX groups (DM32 profile) | Planned | [#540](https://github.com/pskillen/codeplug-studio/issues/540)                                                                |
| UV5R-Mini profile export                                  | Planned | [#541](https://github.com/pskillen/codeplug-studio/issues/541) — channel path shipped in #539; polish / gaps remain           |
| Build UI + export download                                | Planned | [#542](https://github.com/pskillen/codeplug-studio/issues/542)                                                                |
| Import parse → library + build                            | Planned | [#543](https://github.com/pskillen/codeplug-studio/issues/543)                                                                |
| Import dropzone                                           | Planned | [#544](https://github.com/pskillen/codeplug-studio/issues/544)                                                                |
| 1-click handoff to neonplug.app                           | Stretch | [#545](https://github.com/pskillen/codeplug-studio/issues/545)                                                                |

## Why a separate format

Studio already exports **DM-32** via CPS CSV and **UV-5R Mini** via CHIRP CSV. NeonPlug’s preferred pathway is a single `.neonplug` ZIP containing `codeplug.json`, then in-browser radio write over Web Serial / BLE. That interchange is a sibling CPS format — same library, new format builds — not a projection bolted onto the CSV adapters.

## Profiles

| Profile id          | Label                         | Traits                                  | Caps note                                                                                           |
| ------------------- | ----------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `neonplug-dm32uv`   | Baofeng DM-32UV (NeonPlug)    | Zone grouping + zone-derived scan lists | Same numeric caps as DM32 CPS `dm32-baofeng-dm32uv`                                                 |
| `neonplug-uv5rmini` | Baofeng UV-5R Mini (NeonPlug) | Flat memory + per-channel scan flag     | NeonPlug binary **999** memories / **12**-char names — not CHIRP CSV **128** / **7** (sibling path) |

## Export delivery (shipped in #539)

1. Adapter serialises `codeplug.json` as a **string** (`multi-file` with one entry).
2. `exportBuildZip` wraps that string with **fflate** (`buildNeonplugZip`) → `.neonplug` binary.

Channels export for both profiles; zones / contacts / scan / RX groups stay empty until [#540](https://github.com/pskillen/codeplug-studio/issues/540). `contactId` is `0` until contacts ship. Download UI is [#542](https://github.com/pskillen/codeplug-studio/issues/542).

See [file-format.md](../../../reference/neonplug/file-format.md).

## Operator workflow (planned)

1. Curate channels (and DMR entities) in the **library**.
2. Create a **NeonPlug build** for the target radio profile (available now via `/builds/new`).
3. Export a `.neonplug` file from the build export page (after #542 wires download).
4. Open [neonplug.app](https://neonplug.app) → import the file → write to radio.

## Related

- [import-export hub](../README.md)
- [NeonPlug wire reference](../../../reference/neonplug/README.md)
- Sibling formats: [DM32](../dm32/README.md), [CHIRP](../chirp/README.md)
- External: [NeonPlug](https://github.com/infamy/NeonPlug) · [neonplug.app](https://neonplug.app)
