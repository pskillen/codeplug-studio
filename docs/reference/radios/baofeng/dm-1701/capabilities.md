# DM-1701 — capabilities

## Feature availability

| Feature                   | 1701 support          | App modelling    | Notes                                                            |
| ------------------------- | --------------------- | ---------------- | ---------------------------------------------------------------- |
| DMR digital               | Yes                   | Full             | `Channel Type` = `Digital`                                       |
| Analogue FM               | Yes                   | Full             | `Channel Type` = `Analogue`; no dual-mode row                    |
| Promiscuous RX (TG lists) | Yes                   | Full             | `TG List` on channel + `TG_Lists.csv`                            |
| APRS                      | Yes (firmware)        | **Partial**      | `Channels.APRS` name bidirectional; `APRS.csv` body not modelled |
| DTMF sequences            | Yes (firmware)        | **Not modelled** | `DTMF.csv` exported header-only                                  |
| Hotspot / talkaround      | Yes                   | vendorExtras     | `TS1_TA_Tx`, `TS2_TA_Tx ID` in vendorExtras                      |
| Airband / AM              | **No**                | N/A              | OpenGD77 on 1701 does not carry AM airband                       |
| YSF / D-STAR / M17        | No native CPS columns | Lossy export     | Collapse to `Digital` if set in internal model                   |

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes   | TX  |
| ---------- | ------- | --- |
| 136–174    | FM, DMR | Yes |
| 400–470    | FM, DMR | Yes |

Source: qDMR `opengd77_limits.cc` (OpenGD77 family). Used for **channel** list/export eligibility ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). Satellite keps write uses a **separate** 136–174 / **400–480** MHz gate — see below.

### Satellite keps write eligibility (Studio)

Not hardware-verified. Operator notes: radio slots are **Freq 1 (FM voice)**, **Freq 2 (APRS/packet)**, **Freq 3 (beacon / CW / SSTV / telemetry RX)**. Firmware does not track DMR satellite transponders. Standard RF 136–174 / 400–480 MHz; DM-1701 CPS Band Limits wideband unlock is **not modelled** — Studio still skips out-of-band transmitters. MD-9600 PLL is strict outside those bands.

| Slot | Occupants | Skip |
| ---- | --------- | ---- |
| Freq 1 | FM-family (empty mode → FM) | Extra FM; DMR / BPSK / GFSK |
| Freq 2 | APRS, PACKET, AX.25, AFSK | Extra APRS |
| Freq 3 | Beacon, CW, SSTV, telemetry | Extra beacon |

Uplink CTCSS on Freq 1 is packed from `uplinkToneHz`. Arming tones and APRS path are **not** modelled.

Code: `src/core/radios/opengd77/satelliteCapability.ts`. Wire: [satellite-orbitals.md](../../opengd77/satellite-orbitals.md).

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
