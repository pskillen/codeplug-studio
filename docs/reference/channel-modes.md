# Channel modes

Canonical reference for channel mode labels, categories, UI pill colours, and form-field applicability. Implementation in `src/app/lib/channelModes.ts` must match this table.

## Categories

| Category | Meaning |
| --- | --- |
| `analog` | Analog voice modes — show RX/TX tone fields in the edit form |
| `digital` | Digital voice modes — hide tone fields; DMR-only fields apply only to `dmr` |
| `other` | Unknown or unclassified |

## Colour design

**One colour per mode.** Analog modes share a warm yellow family; digital modes use distinct hues so DMR, YSF, D-STAR, P25, NXDN, M17, and Tetra are distinguishable at a glance.

## Mode table

| ID | Label | Category | Hex | Mantine |
| --- | --- | --- | --- | --- |
| `fm` | FM | analog | `#f0c419` | `yellow.5` |
| `am` | AM | analog | `#fab005` | `yellow.6` |
| `ssb-usb` | SSB USB | analog | `#fd7e14` | `orange.6` |
| `ssb-lsb` | SSB LSB | analog | `#e8590c` | `orange.7` |
| `dmr` | DMR | digital | `#e03131` | `red.7` |
| `ysf` | YSF | digital | `#339af0` | `blue.5` |
| `dstar` | D-STAR | digital | `#7950f2` | `violet.6` |
| `p25` | P25 | digital | `#12b886` | `teal.6` |
| `nxdn` | NXDN | digital | `#868e96` | `gray.6` |
| `m17` | M17 | digital | `#20c997` | `teal.5` |
| `tetra` | Tetra | digital | `#6741d9` | `indigo.6` |
| `other` | Other | other | `#9c36b5` | `grape.6` |

OpenGD77 `Channel Type` wire mapping (`Analogue` / `Digital` / passthrough): [opengd77/channels.md](opengd77/channels.md).

## Form field applicability

| Field group | Applies when |
| --- | --- |
| RX/TX tone | `isAnalogMode(mode)` — `fm`, `am`, `ssb-usb`, `ssb-lsb` |
| Colour code, timeslot, DMR ID, contact, RX group list | `isDmrMode(mode)` — `dmr` only |
| (hidden) tones | `isDigitalMode(mode)` — all digital modes |

YSF, D-STAR, P25, NXDN, M17, and Tetra are digital but may lack format-specific CPS columns for some adapters. OpenGD77 mode wire rules: [opengd77/channels.md](opengd77/channels.md).

## Multi-mode composition

A logical library channel may opt into **multi-mode** (`multiMode: true`) and carry multiple `ChannelModeProfile` entries (e.g. FM + DMR sharing name and frequencies). Field applicability above applies **per profile**. Format-specific export rules (expand vs collapse) live in per-format reference docs — OpenGD77: [opengd77/multi-mode.md](opengd77/multi-mode.md).

## Related

- [Display conventions](./display-conventions.md)
- [Data model](../features/data-model/README.md)
- [library](../features/library/README.md)
