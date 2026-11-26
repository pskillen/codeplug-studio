# MD-9600 (RadioFoundry) — capabilities

| Capability  | Support                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| DMR digital | Yes                                                                                                              |
| Analogue FM | Yes                                                                                                              |
| M17         | Yes. The channel stores a CAN and a destination. Sending the CAN on air, and filtering on it, are still pending. |

### Frequency ranges (Studio eligibility)

| Band (MHz) | Modes        | TX  |
| ---------- | ------------ | --- |
| 136–174    | FM, DMR, M17 | Yes |
| 400–480    | FM, DMR, M17 | Yes |

Satellite keps: over the debug link when the build has satellite tracking on; see [RadioFoundry satellite keps](../../radiofoundry/satellite-keps.md).

## Board revisions

One RadioFoundry image serves every MD-9600 revision. Upstream tested V1–V3 on the bench; V4 was never run on hardware. One V4A/V5 report noted DMR transmit dropping out. Transmit stays off on the radio until enabled under Settings → Advanced → Hardware; V1–V4 radios may ask for their revision first. Studio does not read or set the revision.

Studio's bench radio: not yet recorded.
