# DM-1701 — capabilities

## Feature availability

| Feature | 1701 support | App modelling | Notes |
| --- | --- | --- | --- |
| DMR digital | Yes | Full | `Channel Type` = `Digital` |
| Analogue FM | Yes | Full | `Channel Type` = `Analogue`; no dual-mode row |
| Promiscuous RX (TG lists) | Yes | Full | `TG List` on channel + `TG_Lists.csv` |
| APRS | Yes (firmware) | **Partial** | `Channels.APRS` name bidirectional; `APRS.csv` body not modelled |
| DTMF sequences | Yes (firmware) | **Not modelled** | `DTMF.csv` exported header-only |
| Hotspot / talkaround | Yes | vendorExtras | `TS1_TA_Tx`, `TS2_TA_Tx ID` in vendorExtras |
| Airband / AM | **No** | N/A | OpenGD77 on 1701 does not carry AM airband |
| YSF / D-STAR / M17 | No native CPS columns | Lossy export | Collapse to `Digital` if set in internal model |

## Layout conventions (operator practice)

Not CSV column differences:

- **Lean model** — one channel row per repeater/site; promiscuous TG lists handle RX
- **Zone = scan** — no separate scan-list file; zone member order is scan order
- **No dual mode** — FM+DMR repeater needs separate `Analogue` and `Digital` rows
- **Naming** — callsign + qualifier (e.g. `GB7GL Glasgow`); case-sensitive FKs across files
- **Independent TX TG** — on the radio, RF channel and TX talk group are independently selectable (not stored in CSV)

## Related

- [limits.md](limits.md) · [power.md](power.md)
- OpenGD77 DTMF / APRS: [dtmf-aprs.md](../../../export-formats/opengd77/dtmf-aprs.md)
