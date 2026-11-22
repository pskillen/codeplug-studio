# DM-32UV (RadioFoundry) — capabilities

## RF / modes

| Capability  | Support |
| ----------- | ------- |
| DMR digital | Yes     |
| Analogue FM | Yes     |

Studio writes only FM and conventional DMR to this radio, so those are the only modes its builds accept. Other modes are not offered until Studio can write them.

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export. See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes   | TX  |
| ---------- | ------- | --- |
| 136–174    | FM, DMR | Yes |
| 400–480    | FM, DMR | Yes |

Source: the board bands in [limits.md](limits.md) (`DM32UV_RADIOFOUNDRY_BOARD.BANDS_HZ`); the row is in `src/core/radio-targets/rfCapabilities.ts` and a test pins it to them.

Unlike the stock DM-32UV, there is no receive-only 87–136 MHz row: nothing in RadioFoundry says it keeps the broadcast and air band receive, so Studio does not claim it.

## Related

- [limits.md](limits.md) · [RadioFoundry firmware limits](../../radiofoundry/limits.md)
