# AT-D890UV calibration (tune unit)

## Purpose

Field layout of the AT-D890UV tune unit as the read-only calibration viewer decodes it. Every field comes from a **static trace of V1.05 firmware** (decompiled consumers, cited below; research in the radio repo's PR #245, ledger F349-F356). Nothing here is validated on hardware, and none of it is permission to write the unit: debug pages are read-only, and writing calibration is out of scope.

**Confidence.** Each field carries one of: _traced_ (code address and meaning), _partially traced_ (traced use with an inferred meaning, marked "inferred"), or _unknown_. Bytes that nothing reads are **unused (no reader)**, never unknown. **Factory label** is the vendor's factory-mode name for the item (table `0x0818E0E0`, factory item number in brackets); it is a secondary name next to Studio's descriptive one.

## Code anchors

| Module                                                      | Role                                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/radios/anytone/at-d890uv/calibration.ts`          | `decodeAtD890Calibration(bytes)`, `atD890CalibrationTableValue(table, index)`, `atD890CalibrationCorrection(table, index, reference)`, `atD890TrimPpm(value)` |
| `src/core/radios/anytone/at-d890uv/calibrationFields.ts`    | The other named loaded bytes (baseband words, tracking filters, test channels, second board) as data                                                          |
| `src/app/routes/debug/radios/AtD890Calibration.tsx`         | `selectAtD890TuneRegion(archive)` and the Calibration tab view                                                                                                |
| `src/integrations/radio-io/radios/at-d890uv/vitalBackup.ts` | `AT_D890_VITAL_UNITS`: the four vital requests and their addresses                                                                                            |

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

- **Byte order is traced per region.** Little-endian (u16 LE): `+0x000`, `+0x100`, `+0x200`, `+0x1810`-`+0x181B`, `+0x1C00`. **Big-endian** (u16 BE, read with `0x080468B0`, confirmed by the defaults): `+0x300`, `+0x400`, `+0x500`, `+0x600` and `+0x1800`-`+0x180F`. The decoder never reads the BE regions with the LE helper; multi-word blocks show raw bytes only.
- A field is decoded only when every byte of it was captured. A half-captured u16 is shown as unavailable, with its one captured byte kept as raw.
- Table positions past the captured prefix stay missing. Charts end the line there; numeric tables say "Not captured". Differences from a reference entry are only shown when both entries were captured.
- Captured `0x00` and `0xFF` are real values, never treated as blank.

### Scalar fields

| Offset             | Width | Field                                             | Factory label                                   | Unit and hardware sink                                                                       | Conf   |
| ------------------ | ----- | ------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| `+0x000`           | u16   | Oscillator trim                                   | FQCA (0x0C)                                     | 1 step = f / 46,015,500 ≈ **0.0217 ppm** (≈ 9.6 Hz at 440 MHz); neutral 2000                 | traced |
| `+0x002`-`+0x005`  | u8 ×4 | UHF power reference, Low / Mid / High / Turbo     | PASU, PALU, PAMU, PAHU (0x10, 0x0F, 0x0E, 0x0D) | APC **DAC1 code ÷ 16**: DAC = (ref + T[i] − T[40]) × 16, 12-bit                              | traced |
| `+0x102`-`+0x105`  | u8 ×4 | VHF/220 power reference, Low / Mid / High / Turbo | PASV, PALV, PAMV, PAHV (0x30, 0x2F, 0x2E, 0x2D) | as above, reference index 9; 220 MHz always uses Low                                         | traced |
| `+0x010`, `+0x012` | u16   | UHF squelch reference, main / sub                 | SQTHU (0x1D), SQTHUB (0x1E)                     | **Raw RSSI count** (RF reg `0x02` b9:0, 0-1023), 4-read average at the factory squelch level | traced |
| `+0x116`, `+0x118` | u16   | VHF squelch reference, main / sub                 | SQTHV1A (0x36), SQTHV1B (0x37)                  | raw RSSI count                                                                               | traced |
| `+0x124`, `+0x126` | u16   | 220 squelch reference, main / sub                 | SQTHV2A (0x38), SQTHV2B (0x39)                  | raw RSSI count                                                                               | traced |
| `+0x014`, `+0x016` | u16   | UHF meter reference, main / sub                   | RSSIUA (0x1F), RSSIUB (0x20)                    | raw RSSI count, one read at the factory reference level                                      | traced |
| `+0x11A`, `+0x11C` | u16   | VHF meter reference, main / sub                   | RSSIV1A (0x3A), RSSIV1B (0x3B)                  | raw RSSI count                                                                               | traced |
| `+0x128`, `+0x12A` | u16   | 220 meter reference, main / sub                   | RSSIV2A (0x3C), RSSIV2B (0x3D)                  | raw RSSI count                                                                               | traced |

Consumers: trim `0x08047E10` → `0x08116674` (editor `0x08122974` case 0x0C, default 2000 at `0x08060240`); power references `0x0811A75C` / `0x0803AAF8` → `0x0801694C` → HAL_DAC_SetValue (channel 1); squelch `0x080E373C` (captured by `0x0803C558`) into reg `0x49`; meter `0x080CF7D8`, `0x080CFFBC`, `0x080CF2E0`, `0x080CF3F4` (captured by `0x08049E3C`).

A trim value above 2000 raises the programmed frequency, below 2000 lowers it. The viewer shows the offset from neutral in ppm. **Power selections are named Low / Mid / High / Turbo** (channel `+0x08` b3:2 = 0-3). The factory letters are shifted by one step (`PASU` is Low ... `PAHU` is Turbo, and selection 3 is gated by LocalInfo `+0x0A`), so a selection is never labelled by its factory letter. Watts, dBm and Hz of deviation are **unknown**: no firmware holds them, only a bench measurement would.

Tier adjustments (`0x0811A75C`): 200-300 MHz forces Low; repeater mode (settings `+0x143`) drops Turbo to High; settings `+0x10C` (TX Pow AGC) drops one tier while `0x2001AFAE` / `0x2001AFAF` is set (what sets those is not traced). With a factory PA item selected the radio outputs the bare reference.

### Power tables

| Offsets                                    | Entries                                 | Band    | Index (f in MHz)                                                  | Reference index |
| ------------------------------------------ | --------------------------------------- | ------- | ----------------------------------------------------------------- | --------------- |
| `+0xC00`, `+0xD00`, `+0xE00`, `+0xF00`     | 121 unsigned bytes each, selections 0–3 | UHF     | floor(f − 400)                                                    | 40 (440 MHz)    |
| `+0x1000`, `+0x1100`, `+0x1200`, `+0x1300` | 45 unsigned bytes each, selections 0–3  | VHF/220 | floor(f − 136) below 174.00001 MHz, otherwise floor(f − 220) + 39 | 9 (145 MHz)     |

Traced arithmetic (`0x0803AAF8`, `0x0811A75C`): DAC1 code = (reference byte + table[index] − table[reference index]) × 16, 12-bit right aligned (`0x0801694C` → `0x0804E4EC`). The lookup is one discrete entry; there is no interpolation between neighbours. The cited functions mask the index to 8 bits and do not clamp it. Each entry is an APC DAC1 code ÷ 16; watts are unknown.

### Squelch flatness tables

| Offset    | Entries | Path          | Index (f in MHz)                            | Reference index |
| --------- | ------- | ------------- | ------------------------------------------- | --------------- |
| `+0x1400` | 25      | Main, UHF     | floor((f − 400) / 5)                        | 8               |
| `+0x1500` | 25      | Main, VHF/220 | floor((f − 136) / 2); 220 MHz uses index 20 | 5               |
| `+0x1600` | 25      | Sub, UHF      | as main UHF                                 | 8               |
| `+0x1700` | 25      | Sub, VHF/220  | as main VHF                                 | 5               |

Consumer `0x080E373C`: threshold += T[reference] − T[index]. Entries are raw RSSI counts (unsigned), but differences from the reference entry can be negative; the decoder keeps them signed.

### Other loaded fields (289 bytes) and unused bytes

The unit is 262,144 bytes. Studio decodes 798 of them as the scalars and tables above. The other **289 loaded bytes** are named in `calibrationFields.ts`: 212 have a consumer, 77 are loaded but never read (**unused, no reader**: 36 loaded with no reference, 41 that only the defaults writer touches). The remaining **261,057 bytes are never loaded**, and every tune rewrite erases them (loader `0x080E0440` and writer `0x0813A0F0` list the same chunks); they show as unused, not unknown. Live and stale markers sit at `+0x3FFFC` and `+0x3FDF8`.

| Region (byte order)              | Content (factory label, where there is one)                                                                                                                                                                                                                                                                                  | Conf                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `+0x006`-`+0x00F` (LE)           | UHF analogue mod MODU (0x11), DMR mod FSKMU (0x24), signalling tone TONEU (0x16), CTCSS dev CTCW (0x18), DCS dev DCSW (0x19): RF chip reg `0x31` (`\| 0x1000`) and `0x2E` (`\| 0xC000`)                                                                                                                                      | traced (TONEU inferred) |
| `+0x018`-`+0x01D` (LE)           | UHF tracking filter at 400, 460, 520 MHz: BPFLU/MU/HU (0x1A-0x1C), **DAC2 code ÷ 16** (`v << 4`), interpolated per 1 MHz                                                                                                                                                                                                     | traced                  |
| `+0x01E`, `+0x024`-`+0x027` (LE) | D-MIC (0x15, repeater mode only), Sct Mod (0x12), battery offset VBAT (0x57; 10 mV per step inferred, 100 neutral), analogue mic A-MIC (0x14, reg `0x10`)                                                                                                                                                                    | traced / inferred       |
| `+0x028`                         | LocalInfo band-code copy (`0x0801EACC`, F224)                                                                                                                                                                                                                                                                                | traced                  |
| `+0x106`-`+0x112` (LE)           | VHF / 220 analogue mod MODV1 (0x31), MODV2 (0x13), DMR mod FSKMV (0x3F), signalling tones TONEV1 (0x32), TONEV2 (0x17); two default-only words                                                                                                                                                                               | traced                  |
| `+0x11E`-`+0x122` (LE)           | VHF tracking filter at 136, 174, 225 MHz: BPFLV/MV/HV (0x33-0x35), RF chip-0 reg `0x5C` = `v << 4 \| 0x1000`; 220-225 MHz interpolates from the 174 MHz point in 6 steps                                                                                                                                                     | traced                  |
| `+0x200`-`+0x203` (bytes)        | Air-band squelch base AM RSI "S" (0x44, I²C reg `0xEC & 0x7F`), air-band reference AM RSI "R" (I²C reg `0xEA & 0x7F`), `+0x202` default only, **`+0x203` FM RSI (0x5B): the factory case 5B capture**                                                                                                                        | traced                  |
| `+0x204`-`+0x209` (LE, low byte) | **Air-band tracking filter at 108, 127, 145 MHz** (AM BPFL/M/H, 0x41-0x43): RF chip-1 reg `0x5C` = `v << 4 \| 0x1002`. `+0x206`-`+0x207` is the 127 MHz point, not a factory capture                                                                                                                                         | traced                  |
| `+0x300`-`+0x30B` (BE)           | Baseband class-2 id `0x15` block (PC items 0x71-0x74, 0x2A); MISC_GAIN bytes (cmd `0x6B`, inferred name)                                                                                                                                                                                                                     | traced / inferred       |
| `+0x316`                         | `0x66` selects analogue RF reg `0x30` = `0x5F74`, anything else `0x5F77`                                                                                                                                                                                                                                                     | traced                  |
| `+0x400`-`+0x425` (BE)           | UHF DC-offset block (cmd `0x39`, `+0x406` forced to `01 F4` at load), FSKLU/FSKHU words at 400 / 520 MHz (linear over 120 MHz), UHF MODGAIN (cmd `0x2C`), baseband ids 10-12, DEMOD_GAIN, mic gain (cmd `0x69`), DMR RX audio (cmd `0x68`, replaced by `09 C4` when settings `+0x57` = 1), D OBH / D OBL (factory mode only) | traced / inferred       |
| `+0x500`-`+0x524` (BE)           | VHF/220 DC-offset block (`+0x506` forced to `01 F4`), FSKLV/FSKHV words at 136 / 225 MHz (linear over 89 MHz), VHF MODGAIN; `+0x512`-`+0x526` defaults only                                                                                                                                                                  | traced                  |
| `+0x600`-`+0x707` (BE / bytes)   | Baseband cmd `0x7A` (8 bytes), cmd `0x06` (7 bytes; firmware sends `+0x703` twice and never `+0x704`), AUDIO_AGC (cmd `0x73`, inferred name)                                                                                                                                                                                 | traced / inferred       |
| `+0x800`-`+0xB0B` (bytes)        | Factory test-channel RX / TX frequencies, UHF and VHF, `[mid, low, high]` (items 0-11; set by PC command `0x17`); meaning inferred                                                                                                                                                                                           | partly                  |
| `+0x1800`-`+0x180F` (BE)         | NXDN DC-offset words, UHF (`nx6K5-LU/HU`, `nx12K-LU/HU`) and VHF (`nx6K5-LV/HV`, `nx12K-LV/HV`)                                                                                                                                                                                                                              | traced                  |
| `+0x1810`-`+0x181B` (LE)         | NXDN 6.25k / 12.5k modulation levels, reg `0x31` (`nx6K5-MV/MU`, `nx12K-MV/MU`); two default-only words                                                                                                                                                                                                                      | traced                  |
| `+0x1C00`-`+0x1C0D` (LE / bytes) | Message `0x12` to the second (NR / APRS) board: RX Gain (0x59, 0-100), RX Drive (0x5A, 0-600); `+0x1C0C` is overwritten from settings `+0x0C` (VOX) at run time                                                                                                                                                              | partly (inferred)       |

**Firmware bug (recorded, not acted on):** the NXDN VHF DC-offset slope builder (`0x0803C020`) reads the `+0x1808` and `+0x180C` words twice, so NXDN on VHF/220 uses the 136 MHz word at every frequency and the 225 MHz words are used only by their factory items (F352). Stock behaviour is "flat at 136 MHz", not broken.

Factory mode (`0x20004211` holds the item) steps values by 1, 10, 100 or 1000 with per-item bounds: power 0-255, MOD 0-4095, CTCW/DCSW 0-1023, A-MIC 0-63, D-MIC 0-45, VBAT 0-200, RX Gain 0-100, RX Drive 0-600. Those bounds are evidence of the editor, not validated limits.

### What the viewer does not claim

- The running firmware and any mod are unknown; the V1.05 trace may not apply.
- Agreement between the capture's two reads shows a stable read, not valid calibration.
- No watts, dBm or Hz of deviation (bench measurement only), frequency-validity bands or health verdicts. The only converted figure is the trim offset in ppm. Charts use table indexes on the x axis; frequency mappings are explanatory text.

## Storage

Read from radio-backup archives (`regions/<id>.bin` inside the ZIP) or the in-tab live capture. Nothing is persisted by the viewer. Tests use synthetic bytes only.

## Manual verify

1. Open `/debug/radios/at-d890uv`, Calibration tab, with no archive: "Not captured".
2. Open a synthetic archive with a `vital-tune-a` entry at `0x04F00000`: provenance, "Not validated on hardware", scalar tables, four charts and numeric tables, other loaded fields, the never-read (unused) ranges and paged raw hex appear.
3. Open one whose tune entry is a short prefix: fields past the prefix read "Unavailable" or "Not captured"; chart lines stop.
4. Open one with only `vital-tune-b`: "Not captured", with the note that tune B is not used.
5. Repeat at 375 px width: tables scroll horizontally inside their cards; the page does not.

## Known gaps

- Physical units (watts per DAC step, dB per RSSI count, Hz per reg `0x31` step), bounds enforcement and 220 MHz reachability are unproven.
- Open in the trace: the meaning of baseband commands `06`, `68`, `69` and `7A`, the five DC_OFFSET head words, which mode makes `0x0811840C` send "Sct Mod", what sets `0x2001AFAE` / `AF`, the VBAT unit (10 mV is inferred) and the tick length behind some timers.
- Layout on a real radio is unconfirmed: whether `+0x400`-`+0xCFF` (DC offsets, test channels, the UHF Low power table) is populated or blank is not known until a capture is checked.
- Other firmware versions are not traced.
- LocalInfo decoding beyond identity is not decoded.

## Related

- [backup-restore.md](backup-restore.md): vital units and the tune-B diversion
- [band-code.md](band-code.md): LocalInfo band code
- [Radio debug feature hub](../../../../features/radio-debug/README.md)

The debug calibration viewer can overlay a second retained capture: the selected capture is solid and the overlay dashed, with matching colours and missing samples left as gaps. Each side must independently contain a valid tune-A region; tune-B is never substituted. Capture timestamps label the chart series. Retaining captures and chart data consumes tab memory.

For two retained captures, calibration tables show the overlay value and overlay-minus-primary delta only when both values are captured. Missing values remain unavailable. Tune B is never substituted for tune A.
