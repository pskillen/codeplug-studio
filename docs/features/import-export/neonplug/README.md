# NeonPlug interchange — import / export

Product behaviour for NeonPlug `.neonplug` files in Codeplug Studio. Wire tables live in the tier-3 [NeonPlug reference](../../../reference/neonplug/README.md).

**Tracking:** Epic [#536](https://github.com/pskillen/codeplug-studio/issues/536) · wire reference [#537](https://github.com/pskillen/codeplug-studio/issues/537)

**Source (planned):** `src/core/import-export/formats/neonplug/`

## Implementation status

| Area                                                         | Status  | Notes                                                                 |
| ------------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| Wire reference                                               | Shipped | [reference/neonplug/](../../../reference/neonplug/README.md) — [#537](https://github.com/pskillen/codeplug-studio/issues/537) |
| Format scaffold (`FormatId`, catalog, traits)                | Planned | [#538](https://github.com/pskillen/codeplug-studio/issues/538)        |
| Export channels + `.neonplug` ZIP                            | Planned | [#539](https://github.com/pskillen/codeplug-studio/issues/539)        |
| Export zones / scan / contacts / RX groups (DM32 profile)    | Planned | [#540](https://github.com/pskillen/codeplug-studio/issues/540)        |
| UV5R-Mini profile export                                     | Planned | [#541](https://github.com/pskillen/codeplug-studio/issues/541)        |
| Build UI + export download                                   | Planned | [#542](https://github.com/pskillen/codeplug-studio/issues/542)        |
| Import parse → library + build                               | Planned | [#543](https://github.com/pskillen/codeplug-studio/issues/543)        |
| Import dropzone                                              | Planned | [#544](https://github.com/pskillen/codeplug-studio/issues/544)        |
| 1-click handoff to neonplug.app                              | Stretch | [#545](https://github.com/pskillen/codeplug-studio/issues/545)        |

## Why a separate format

Studio already exports **DM-32** via CPS CSV and **UV-5R Mini** via CHIRP CSV. NeonPlug’s preferred pathway is a single `.neonplug` ZIP containing `codeplug.json`, then in-browser radio write over Web Serial / BLE. That interchange is a sibling CPS format — same library, new format builds — not a projection bolted onto the CSV adapters.

## Proposed profiles

| Profile id           | Label                | Traits (planned)                          |
| -------------------- | -------------------- | ----------------------------------------- |
| `neonplug-dm32uv`    | Baofeng DM-32UV      | Zone grouping + scan lists                |
| `neonplug-uv5rmini`  | Baofeng UV-5R Mini   | Flat memory + per-channel scan flag       |

## Operator workflow (planned)

1. Curate channels (and DMR entities) in the **library**.
2. Create a **NeonPlug build** for the target radio profile.
3. Export a `.neonplug` file from the build export page.
4. Open [neonplug.app](https://neonplug.app) → import the file → write to radio.

## Related

- [import-export hub](../README.md)
- [NeonPlug wire reference](../../../reference/neonplug/README.md)
- Sibling formats: [DM32](../dm32/README.md), [CHIRP](../chirp/README.md)
- External: [NeonPlug](https://github.com/infamy/NeonPlug) · [neonplug.app](https://neonplug.app)
