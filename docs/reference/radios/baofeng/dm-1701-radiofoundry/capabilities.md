# DM-1701 (RadioFoundry) — capabilities

## RF / modes

| Capability  | Support                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| DMR digital | Yes                                                                                                              |
| Analogue FM | Yes                                                                                                              |
| M17         | Yes. The channel stores a CAN and a destination. Sending the CAN on air, and filtering on it, are still pending. |

Studio writes FM, conventional DMR and M17 to this radio.

### Frequency ranges (Studio eligibility)

| Band (MHz) | Modes        | TX  |
| ---------- | ------------ | --- |
| 136–174    | FM, DMR, M17 | Yes |
| 400–480    | FM, DMR, M17 | Yes |

Source: [limits.md](limits.md) and `src/core/radio-targets/rfCapabilities.ts`.

Satellite keps: over the debug link when the build has satellite tracking on; see [RadioFoundry satellite keps](../../radiofoundry/satellite-keps.md).

## Related

- [limits.md](limits.md) · [RadioFoundry firmware limits](../../radiofoundry/limits.md)
