# DM-1701 (RadioFoundry) — capabilities

## RF / modes

| Capability  | Support |
| ----------- | ------- |
| DMR digital | Yes     |
| Analogue FM | Yes     |

Studio writes only FM and conventional DMR to this radio.

### Frequency ranges (Studio eligibility)

| Band (MHz) | Modes   | TX  |
| ---------- | ------- | --- |
| 136–174    | FM, DMR | Yes |
| 400–480    | FM, DMR | Yes |

Source: [limits.md](limits.md) and `src/core/radio-targets/rfCapabilities.ts`.

## Related

- [limits.md](limits.md) · [RadioFoundry firmware limits](../../radiofoundry/limits.md)