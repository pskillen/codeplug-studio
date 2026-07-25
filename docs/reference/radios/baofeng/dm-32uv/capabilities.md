# DM-32UV — capabilities

## RF / modes

| Capability           | Support                                                      |
| -------------------- | ------------------------------------------------------------ |
| DMR digital          | Yes                                                          |
| Analogue FM          | Yes                                                          |
| Dual-mode single row | Per adapter wire rules (DM32 CPS / NeonPlug Channel objects) |

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes   | TX           |
| ---------- | ------- | ------------ |
| 136–174    | FM, DMR | Yes          |
| 400–480    | FM, DMR | Yes          |
| 87–136     | FM, AM  | Receive-only |

Source: qDMR `dm32uv_limits.cc` + Studio NeonPlug 87–136 MHz receive note.

## Organisation traits

- **Zone grouping** — named zones with channel members (up to 64)
- **Scan lists** — dedicated lists and/or **zone-derived** scan projection (at most 15 named members)
- **Contacts / talk groups / RX group lists** — first-class on the radio
- **Multi-talkgroup / m×n expansion** + scratch companions (NeonPlug default on) — see [export-projections.md](../../../../features/import-export/neonplug/export-projections.md)

Studio Build uses trait-shaped zone / scan / channel workflows for this radio’s profiles — not flat-memory-only.

## Related

- [limits.md](limits.md) · [power.md](power.md)
- DM32 scan lists: [scan-lists.md](../../../export-formats/dm32/scan-lists.md)
