# UK frequency bands and services

Canonical reference for band labels, MHz/kHz ranges, UI pill colours, and lookup order. Implementation: `src/core/domain/bandCatalog.ts` (full catalog) and `src/core/domain/bandPlan.ts` (Hz lookup for summary and channel UI). In-app band plan: `/reference/bands`.

**Disclaimer:** For programming convenience only. Not authoritative for on-air operation. Licence class, power, geographic restrictions, and non-amateur TX prohibitions apply.

## Lookup behaviour

- Match channel **RX frequency** (or TX if RX blank) against each row's min/max MHz (**inclusive**).
- First matching row wins (table ordered by increasing frequency).
- No per-channel lists; 60 m uses the full allocation span `5.2585 – 5.4065 MHz` (gaps between UK licence channels may still classify as 60 m).
- Unknown frequency: no pill or muted "—" / "?" styling.

NoV extensions (4 m 70.5–71.5, 2 m 146–147): inherit parent amateur band colour; ranges documented in Notes column only.

## Colour design

**One colour per band.** Adjacent bands must be obviously different at a glance. Amateur bands use the existing palette. Non-amateur services use distinct hues — broadcast LW must **not** reuse amateur 136 kHz violet.

Non-amateur pills render with an outline style in the UI when band pills ship (see [styleguide display conventions](./styleguide/display.md)).

## Categories

| Category    | IDs                                                              | Typical use                                     |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `amateur`   | `136khz` … `mm`                                                  | UK Ofcom amateur licence allocations            |
| `broadcast` | `broadcast-lw`, `broadcast-mw`, `broadcast-sw-*`, `fm-broadcast` | LW / MW / SW / FM broadcast receive             |
| `airband`   | `airband`                                                        | Civil aviation VHF AM monitoring                |
| `marine`    | `marine`                                                         | ITU marine VHF coastal listen                   |
| `pmr`       | `pmr446`                                                         | Licence-free PMR446 (often RX-only on ham rigs) |

Export `ALL_BANDS`, `BAND_SECTIONS`, `bandForFrequencyHz`, and `bandLabelForFrequencyHz` from `src/core/domain/bandCatalog.ts` / `bandPlan.ts`. Lookup iterates `ALL_BANDS` in frequency order; the band-plan page lists grouped sections.

## Disambiguation

| ID               | UI label     | Not to be confused with                   |
| ---------------- | ------------ | ----------------------------------------- |
| `136khz`         | 136 kHz      | Broadcast LW (`broadcast-lw`)             |
| `broadcast-lw`   | LW broadcast | Amateur 136 kHz                           |
| `broadcast-mw`   | MW broadcast | 160 m amateur                             |
| `broadcast-sw-*` | SW broadcast | Amateur HF bands (gaps only)              |
| `fm-broadcast`   | FM broadcast | 4 m amateur                               |
| `airband`        | Airband      | 2 m / 4 m amateur                         |
| `marine`         | Marine       | 2 m amateur (non-overlapping)             |
| `pmr446`         | PMR446       | 70 cm amateur (adjacent, non-overlapping) |

## Amateur bands (UK Ofcom allocations)

**Source:** [RSGB Band Plan (effective 1 Jan 2024)](https://rsgb.services/public/bandplans/docs/240205_rsgb_band_plan_2024.pdf) — Ofcom **licence allocation** ranges, not RSGB sub-band usage segments.

| ID       | Label   | Min (MHz) | Max (MHz) | Hex       | Mantine    | Notes                         |
| -------- | ------- | --------- | --------- | --------- | ---------- | ----------------------------- |
| `136khz` | 136 kHz | 0.1357    | 0.1378    | `#6741d9` | `violet.7` | Full only                     |
| `600m`   | 600 m   | 0.472     | 0.479     | `#1098ad` | `cyan.7`   | Full only                     |
| `160m`   | 160 m   | 1.810     | 2.000     | `#ae3ec9` | `grape.6`  |                               |
| `80m`    | 80 m    | 3.500     | 3.800     | `#4263eb` | `indigo.6` |                               |
| `60m`    | 60 m    | 5.2585    | 5.4065    | `#f59f00` | `yellow.7` | Simple range lookup           |
| `40m`    | 40 m    | 7.000     | 7.200     | `#2f9e44` | `green.7`  |                               |
| `30m`    | 30 m    | 10.100    | 10.150    | `#12b886` | `teal.6`   | Secondary allocation          |
| `20m`    | 20 m    | 14.000    | 14.350    | `#0ca678` | `teal.7`   |                               |
| `17m`    | 17 m    | 18.068    | 18.168    | `#099268` | `teal.8`   |                               |
| `15m`    | 15 m    | 21.000    | 21.450    | `#40c057` | `green.6`  |                               |
| `12m`    | 12 m    | 24.890    | 24.990    | `#82c91e` | `lime.6`   |                               |
| `10m`    | 10 m    | 28.000    | 29.700    | `#fab005` | `yellow.6` |                               |
| `6m`     | 6 m     | 50.000    | 52.000    | `#fd7e14` | `orange.6` |                               |
| `4m`     | 4 m     | 70.000    | 70.500    | `#fcc419` | `yellow.5` | NoV 70.5–71.5 inherits colour |
| `2m`     | 2 m     | 144.000   | 146.000   | `#e03131` | `red.7`    | NoV 146–147 inherits colour   |
| `70cm`   | 70 cm   | 430.000   | 440.000   | `#339af0` | `blue.5`   |                               |
| `23cm`   | 23 cm   | 1240      | 1325      | `#7950f2` | `violet.6` | Radar sharing                 |
| `13cm`   | 13 cm   | 2310      | 2450      | `#868e96` | `gray.6`   | Licence conditions apply      |
| `9cm`    | 9 cm    | 3400      | 3475      | `#495057` | `gray.7`   | Licence conditions apply      |
| `6cm`    | 6 cm    | 5650      | 5850      | `#343a40` | `gray.8`   |                               |
| `3cm`    | 3 cm    | 10000     | 10500     | `#212529` | `gray.9`   |                               |
| `12cm`   | 1.2 cm  | 24000     | 24250     | `#495057` | `gray.7`   |                               |
| `mm`     | mm+     | 47000     | 300000    | `#868e96` | `gray.6`   | Upper bound nominal           |

## Broadcast

Coarse UK-oriented receive ranges. SW uses **gap segments** between amateur HF allocations so amateur rows still win inside their licence spans.

| ID                | Label        | Min (MHz) | Max (MHz) | Hex       | Mantine    | Notes                                                                                       |
| ----------------- | ------------ | --------- | --------- | --------- | ---------- | ------------------------------------------------------------------------------------------- |
| `broadcast-lw`    | LW broadcast | 0.1485    | 0.285     | `#8B6914` | `orange.9` | [Ofcom LW](https://www.ofcom.org.uk/spectrum/radio-equipment/lw-mw-sw); not amateur 136 kHz |
| `broadcast-mw`    | MW broadcast | 0.5265    | 1.6065    | `#A67C00` | `orange.8` | UK MW broadcast band                                                                        |
| `broadcast-sw-1`  | SW broadcast | 2.001     | 3.499     | `#B8860B` | `yellow.8` | HF gap (160 m–80 m)                                                                         |
| `broadcast-sw-2`  | SW broadcast | 3.801     | 5.2584    | `#B8860B` | `yellow.8` | HF gap (80 m–60 m)                                                                          |
| `broadcast-sw-3`  | SW broadcast | 5.4066    | 6.999     | `#B8860B` | `yellow.8` | HF gap (60 m–40 m)                                                                          |
| `broadcast-sw-4`  | SW broadcast | 7.201     | 10.099    | `#B8860B` | `yellow.8` | HF gap (40 m–30 m)                                                                          |
| `broadcast-sw-5`  | SW broadcast | 10.151    | 13.999    | `#B8860B` | `yellow.8` | HF gap (30 m–20 m)                                                                          |
| `broadcast-sw-6`  | SW broadcast | 14.351    | 18.067    | `#B8860B` | `yellow.8` | HF gap (20 m–17 m)                                                                          |
| `broadcast-sw-7`  | SW broadcast | 18.169    | 20.999    | `#B8860B` | `yellow.8` | HF gap (17 m–15 m)                                                                          |
| `broadcast-sw-8`  | SW broadcast | 21.451    | 24.889    | `#B8860B` | `yellow.8` | HF gap (15 m–12 m)                                                                          |
| `broadcast-sw-9`  | SW broadcast | 24.991    | 27.999    | `#B8860B` | `yellow.8` | HF gap (12 m–10 m)                                                                          |
| `broadcast-sw-10` | SW broadcast | 29.701    | 49.999    | `#B8860B` | `yellow.8` | HF gap (10 m–6 m)                                                                           |
| `fm-broadcast`    | FM broadcast | 87.500    | 108.000   | `#D9480F` | `orange.7` | UK FM broadcast band                                                                        |

## PMR and services

| ID        | Label   | Min (MHz) | Max (MHz) | Hex       | Mantine  | Notes                                                                           |
| --------- | ------- | --------- | --------- | --------- | -------- | ------------------------------------------------------------------------------- |
| `airband` | Airband | 118.000   | 137.000   | `#15AABF` | `cyan.6` | Civil aviation VHF AM; [ICAO](https://www.icao.int/) allocation                 |
| `marine`  | Marine  | 156.000   | 162.050   | `#1864AB` | `blue.8` | ITU marine VHF; ch 16 = 156.800 MHz                                             |
| `pmr446`  | PMR446  | 446.000   | 446.200   | `#C2255C` | `pink.7` | [ETSI PMR446](https://www.etsi.org/); licence-free; RX-only typical on ham rigs |

## Related

- [TX offsets](./tx-offsets.md) — common repeater / duplex quick offsets by band
- [Display conventions](./styleguide/display.md) — band pill rendering
- [library feature](../features/library/README.md)
- [Data model](../features/data-model/README.md)
- [report](../features/report/README.md) — band breakdowns on `/summary`
