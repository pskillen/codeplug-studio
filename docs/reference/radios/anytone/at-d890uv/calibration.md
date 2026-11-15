# AT-D890UV calibration (tune unit)

## Purpose

Field layout of the AT-D890UV tune unit as the read-only calibration viewer decodes it. Every field comes from a **static trace of V1.05 firmware** (decompiled consumers, cited below). Nothing here is validated on hardware, and none of it is permission to write the unit: debug pages are read-only, and writing calibration is out of scope.

## Code anchors

| Module                                                      | Role                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/radios/anytone/at-d890uv/calibration.ts`          | `decodeAtD890Calibration(bytes)`, `atD890CalibrationTableValue(table, index)`, `atD890CalibrationCorrection(table, index, reference)` |
| `src/app/routes/debug/radios/AtD890Calibration.tsx`         | `selectAtD890TuneRegion(archive)` and the Calibration tab view                                                                        |
| `src/integrations/radio-io/radios/at-d890uv/vitalBackup.ts` | `AT_D890_VITAL_UNITS`: the four vital requests and their addresses                                                                    |

## Inputs: which bytes are decoded

The debug capture reads four 256 KiB vital units. Only the first is decoded:

| Archive id                                   | Requested address          | Use                                                                                                                                       |
| -------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `vital-tune-a`                               | `0x04F00000`               | **Decoded.** Offsets below are relative to the start of this unit                                                                         |
| `vital-tune-b`                               | `0x04F40000`               | Never decoded. V1.05 answers this request with LocalInfo bytes ("as returned"), so it is neither a second calibration copy nor a fallback |
| `vital-local-info`, `vital-local-info-upper` | `0x04F80000`, `0x04FC0000` | Not calibration                                                                                                                           |

The viewer accepts the tune unit only when the archive model is `AT-D890UV`, the entry id is `vital-tune-a`, its address is the requested `0x04F00000`, its role is `inspect-only`, and the manifest length equals the stored bytes and is at most `0x40000`. Any mismatch is refused with a reason; no other region is decoded by label or position. A shorter entry is a captured **prefix** and is accepted. Addresses are requested addresses: firmware can divert a vital read, so the bytes are what the radio returned for that request.

## Behaviour

### Byte order and missing bytes

- 16-bit fields are read as **little-endian by assumption**. The decompile does not establish storage byte order.
- A field is decoded only when every byte of it was captured. A half-captured u16 is shown as unavailable, with its one captured byte kept as raw.
- Table positions past the captured prefix stay missing. Charts end the line there; numeric tables say "Not captured". Differences from a reference entry are only shown when both entries were captured.
- Captured `0x00` and `0xFF` are real values, never treated as blank.

### Scalar fields

| Offset             | Width | Field                                   | Consumers (V1.05)                                                                        | Meaning                                                                                                                                                                                                             |
| ------------------ | ----- | --------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x000`           | u16   | Oscillator trim                         | `0x08047E10`, `0x08116674`, editor `0x08122974`, getter/setter `0x0812DF4C`/`0x0812F878` | Frequency corrected by signed direction around **2000** (neutral), magnitude \|trim − 2000\| × f / 46015500. Factory editor allows 0–4000: evidence of the editor, not a validated RF limit. Physical units unknown |
| `+0x002`–`+0x005`  | u8 ×4 | UHF power reference, selections 0–3     | `0x0803AAF8`, `0x0811A75C`                                                               | Combined with the UHF power tables. Labels and physical power unknown                                                                                                                                               |
| `+0x102`–`+0x105`  | u8 ×4 | VHF/220 power reference, selections 0–3 | same                                                                                     | Combined with the VHF/220 power tables                                                                                                                                                                              |
| `+0x010`, `+0x012` | u16   | UHF squelch reference, main / sub       | `0x080E373C`; factory cases 1D/1E, 36–39                                                 | Range and scale unknown                                                                                                                                                                                             |
| `+0x116`, `+0x118` | u16   | VHF squelch reference, main / sub       | same                                                                                     |                                                                                                                                                                                                                     |
| `+0x124`, `+0x126` | u16   | 220 squelch reference, main / sub       | same                                                                                     |                                                                                                                                                                                                                     |
| `+0x014`, `+0x016` | u16   | UHF meter reference, main / sub         | `0x080CF7D8`, `0x080CFFBC`; factory cases 1F/20, 3A–3D                                   | Physical input level unknown                                                                                                                                                                                        |
| `+0x11A`, `+0x11C` | u16   | VHF meter reference, main / sub         | same                                                                                     |                                                                                                                                                                                                                     |
| `+0x128`, `+0x12A` | u16   | 220 meter reference, main / sub         | same                                                                                     |                                                                                                                                                                                                                     |

Power selections are numeric (0–3). The firmware can adjust the selection for operating context and forces selection 0 for 200–300 MHz, so a raw selection is not necessarily the one used.

### Power tables

| Offsets                                    | Entries                                 | Band    | Index (f in MHz)                                                  | Reference index |
| ------------------------------------------ | --------------------------------------- | ------- | ----------------------------------------------------------------- | --------------- |
| `+0xC00`, `+0xD00`, `+0xE00`, `+0xF00`     | 121 unsigned bytes each, selections 0–3 | UHF     | floor(f − 400)                                                    | 40 (440 MHz)    |
| `+0x1000`, `+0x1100`, `+0x1200`, `+0x1300` | 45 unsigned bytes each, selections 0–3  | VHF/220 | floor(f − 136) below 174.00001 MHz, otherwise floor(f − 220) + 39 | 9 (145 MHz)     |

Traced arithmetic (`0x0803AAF8`, `0x0811A75C`): output = reference byte + table[index] − table[reference index]. The lookup is one discrete entry; there is no interpolation between neighbours. The cited functions mask the index to 8 bits and do not clamp it. Factory copy `0x08123864` establishes the table lengths.

### Squelch flatness tables

| Offset    | Entries | Path          | Index (f in MHz)                            | Reference index |
| --------- | ------- | ------------- | ------------------------------------------- | --------------- |
| `+0x1400` | 25      | Main, UHF     | floor((f − 400) / 5)                        | 8               |
| `+0x1500` | 25      | Main, VHF/220 | floor((f − 136) / 2); 220 MHz uses index 20 | 5               |
| `+0x1600` | 25      | Sub, UHF      | as main UHF                                 | 8               |
| `+0x1700` | 25      | Sub, VHF/220  | as main VHF                                 | 5               |

Consumer `0x080E373C`. Entries are unsigned, but differences from the reference entry can be negative; the decoder keeps them signed.

### Unknown bytes

Every other byte of the unit is kept as unknown raw data and shown in the raw hex. Noted but deliberately undecoded:

| Offset   | Note                                                               |
| -------- | ------------------------------------------------------------------ |
| `+0x028` | LocalInfo band-code copy, checked by `0x0801EACC`                  |
| `+0x200` | Air-band threshold baseline (`0x080D09AC`); scale unknown          |
| `+0x201` | Air-band signal reference (`0x080CF2E0` and others); scale unknown |
| `+0x207` | Factory case 5B capture; consumer unknown                          |

Loader chunks `+0x300`–`+0xB00`, `+0x1800` and `+0x1C00` hold further fields whose consumers and widths were not audited.

### What the viewer does not claim

- The running firmware and any mod are unknown; the V1.05 trace may not apply.
- Agreement between the capture's two reads shows a stable read, not valid calibration.
- No watts, dBm, ppm, frequency-validity bands or health verdicts. Charts use table indexes on the x axis; frequency mappings are explanatory text.

## Storage

Read from radio-backup archives (`regions/<id>.bin` inside the ZIP) or the in-tab live capture. Nothing is persisted by the viewer. Tests use synthetic bytes only.

## Manual verify

1. Open `/debug/radios/at-d890uv`, Calibration tab, with no archive: "Not captured".
2. Open a synthetic archive with a `vital-tune-a` entry at `0x04F00000`: provenance, "Not validated on hardware", scalar tables, four charts and numeric tables, unknown ranges and paged raw hex appear.
3. Open one whose tune entry is a short prefix: fields past the prefix read "Unavailable" or "Not captured"; chart lines stop.
4. Open one with only `vital-tune-b`: "Not captured", with the note that tune B is not used.
5. Repeat at 375 px width: tables scroll horizontally inside their cards; the page does not.

## Known gaps

- Byte order, power labels, physical units, bounds enforcement and 220 MHz reachability are unproven.
- Other firmware versions are not traced.
- LocalInfo decoding beyond identity, and the remaining loader chunks, are not decoded.

## Related

- [backup-restore.md](backup-restore.md): vital units and the tune-B diversion
- [band-code.md](band-code.md): LocalInfo band code
- [Radio debug feature hub](../../../../features/radio-debug/README.md)

The debug calibration viewer can overlay a second retained capture: the selected capture is solid and the overlay dashed, with matching colours and missing samples left as gaps. Each side must independently contain a valid tune-A region; tune-B is never substituted. Capture timestamps label the chart series. Retaining captures and chart data consumes tab memory.
