# DM-32UV — capabilities

## RF / modes

| Capability           | Support                                                      |
| -------------------- | ------------------------------------------------------------ |
| DMR digital          | Yes                                                          |
| Analogue FM          | Yes                                                          |
| Dual-mode single row | Per adapter wire rules (DM32 CPS / NeonPlug Channel objects) |

## Organisation traits

- **Zone grouping** — named zones with channel members (up to 64)
- **Scan lists** — dedicated lists and/or **zone-derived** scan projection (at most 15 named members)
- **Contacts / talk groups / RX group lists** — first-class on the radio
- **Multi-talkgroup / m×n expansion** + scratch companions (NeonPlug default on) — see [export-projections.md](../../../../features/import-export/neonplug/export-projections.md)

Studio Build uses trait-shaped zone / scan / channel workflows for this radio’s profiles — not flat-memory-only.

## Related

- [limits.md](limits.md) · [power.md](power.md)
- DM32 scan lists: [scan-lists.md](../../../export-formats/dm32/scan-lists.md)
