# RT95 VOX — channel record

32-byte channel element in the PROGRAM→QX contiguous image (AnyTone 778UV family). CHIRP `RetevisRT95vox` / `AnyTone778UVBase`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` `MEM_FORMAT` memory struct (facts only — no GPL paste). Byte meanings the CHIRP struct leaves open are resolved from the stock CPS (F121, F123).

Trust levels below follow the stock-CPS comparison ([#1464](https://github.com/pskillen/codeplug-studio/issues/1464)): **C** read in the stock CPS code, **C+F** also read in the main-board firmware, **I** inferred, **U** unconfirmed. Nothing here was observed on a radio. Records cited by id (F110-F130) are in the firmware project's finding ledger.

## Geometry

| Fact                          | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Record size                   | `32` bytes                                                         |
| Count                         | `200` (memories 1–200)                                             |
| Span in image                 | `0x1900` from `0x0000`                                             |
| Occupancy                     | Bit in `occupied_bitfield` @ `0x1940` — not an empty FF fill alone |
| Name length (VOX)             | **6** ASCII (`NAME_LENGTH = 6`)                                    |
| Name length (non-VOX sibling) | 5 — first of the 6 name bytes is `0x00` padding                    |

## Field offsets

| Offset / bits | Field                                             | Encoding / notes                                                                   |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `0–3`         | RX frequency                                      | `bbcd[4]`; `int(Hz/10)`; **MSD pair in byte 0** (`14 65 20 00` = 146.52 MHz)       |
| `4–7`         | Offset                                            | Same `bbcd`; simplex / `tx_off` write `0`; +7.6 MHz is `00 76 00 00`               |
| `8`           | unused                                            | The stock CPS never reads or writes it (C). Studio writes `0x00`                   |
| `9` bits      | talkaround, scramble, **txpower:2**, **duplex:2** | See enums below                                                                    |
| `10` bits     | **channel_width:2**, reverse, **tx_off**          | Width + TX disable (`tx_off` → duplex off)                                         |
| `11` bits     | tone modes; **DTMF ID** (high nibble)             | Low nibble: four enable bits. High nibble: see byte 11                             |
| `12`          | CTCSS decode tone index                           | See tone map                                                                       |
| `13`          | CTCSS encode tone index                           | Same                                                                               |
| `14`          | DTCS decode code low                              | + high bit / invert in following byte                                              |
| `15` bits     | DTCS decode invert + high bit                     |                                                                                    |
| `16`          | DTCS encode code low                              |                                                                                    |
| `17` bits     | DTCS encode invert + high bit                     |                                                                                    |
| `18`          | busy_channel_lockout (CHIRP name)                 | Whole byte modelled by the CPS; its UI binding is unresolved (U)                   |
| `19`          | two 4-bit fields                                  | Modelled by the CPS, meaning unresolved (U)                                        |
| `20` bit      | **tone_squelch_en**                               | TSQL-style squelch                                                                 |
| `21`          | **optional signalling**                           | 0 Off, 1 DTMF, 3 5-Tone; 2 is stored but shown as Off (C)                          |
| `22`          | unknown                                           | Modelled by the CPS, meaning unresolved (U)                                        |
| `23`          | **5-Tone ID**                                     | Index into the 5-Tone list the main board reads (C+F)                              |
| `24–29`       | name                                              | 6 chars; VOX uses all 6                                                            |
| `30–31`       | custom CTCSS                                      | `ul16` little-endian, **0.1 Hz** binary integer, used when the index is `0x33` (C) |

Bit positions below use **bit 0 = LSB** of each byte. CHIRP `bitwise` packs fields **MSB-first** within each `u8` group (first field listed occupies the high bits). Unmodelled bits are not preserved on a Studio channel write: see [Write principle](#write-principle).

### Byte 9

| Bits | Field                                                 |
| ---- | ----------------------------------------------------- |
| 7    | flag the CPS models (C; UI name I). Studio writes `0` |
| 6–5  | not modelled by the CPS; written as `0` (U)           |
| 4    | flag the CPS models (C; UI name I). Studio writes `0` |
| 3–2  | **txpower**                                           |
| 1–0  | **duplex**                                            |

### Byte 10

| Bits | Field                                           |
| ---- | ----------------------------------------------- |
| 7–4  | not modelled by the CPS; written as `0` (U)     |
| 3–2  | **channel_width**                               |
| 1    | reverse: modelled by the CPS; Studio writes `0` |
| 0    | **tx_off** (TX disabled when set)               |

### Byte 11

| Bits | Field                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7–4  | **DTMF ID**: 0-based index, shown plus 1 as "DTMF n" when optional signalling (byte 21) is DTMF (C; the "PTT-ID M1-M16" reading is I). Studio writes `0` |
| 3    | **dtcs_decode_en**                                                                                                                                       |
| 2    | **ctcss_decode_en**                                                                                                                                      |
| 1    | **dtcs_encode_en**                                                                                                                                       |
| 0    | **ctcss_encode_en**                                                                                                                                      |

The stock CPS stores each tone mode as a 2-bit enum (0 Off, 1 CTCSS, 2 DCS; **3 shows as Off**) over the same bits; Studio's four enable bits agree for values 0-2 (C).

### Bytes 15 / 17 (DTCS decode / encode flags)

| Bits | Field                         |
| ---- | ----------------------------- |
| 7–2  | unmodelled; Studio writes `0` |
| 1    | **dtcs\_*_invert**            |
| 0    | **dtcs\_*_code_highbit**      |

The CPS reads bytes 14-15 (decode) and 16-17 (encode) as a 16-bit word: bits 8-0 are the code as a binary number whose octal digits are the DCS code (D023 is `0x13`), bit 9 is invert (C+F). That is the same layout as Studio's 512-code index and invert bit; the CPS accepts any 9-bit value.

### Byte 20

| Bits | Field                                             |
| ---- | ------------------------------------------------- |
| 7–1  | unmodelled by Studio; written as `0`              |
| 0    | **tone_squelch_en** (set for TSQL / DTCS squelch) |

On slots 1-200 bytes 4-7 are an offset. Only the third special slot (203, below) uses them as an absolute TX frequency, with duplex forced to 3 (split); whether duplex 3 on a normal slot means an absolute TX is **not established**. Studio never writes duplex 3.

Simplex (`duplex = 0`) and RX-only (`tx_off`) use offset BCD **0**, not the RX frequency.

VOX names are **space-padded** to 6 characters (`0x20`); non-VOX siblings prefix `0x00` then 5 chars.

## Power (`txpower`)

| Wire   | CHIRP label | Approx RF      |
| ------ | ----------- | -------------- |
| `0x00` | Low         | ~5 W (37 dBm)  |
| `0x01` | Medium      | ~10 W (40 dBm) |
| `0x02` | High        | ~25 W (44 dBm) |

Library % for file adapters: [power.md](power.md).

## Duplex

| Wire   | CHIRP duplex        |
| ------ | ------------------- |
| `0x00` | none (`''`)         |
| `0x01` | `+`                 |
| `0x02` | `-`                 |
| `0x03` | `split` (odd split) |

`tx_off = 1` → CHIRP exposes duplex `off` (TX disabled) regardless of duplex enum.

## Channel width

| Wire   | Meaning        |
| ------ | -------------- |
| `0x00` | 12.5 kHz (NFM) |
| `0x01` | 20 kHz         |
| `0x02` | 25 kHz (FM)    |

The 20 kHz setting is a real option in the stock CPS (C+F: the main board's default record uses the 25 kHz value). CHIRP `valid_modes` for this family: `FM`, `NFM`. **Studio gap:** the radio DTO has only FM and NFM, so a library channel of 20 kHz is written as 25 kHz and the Write review warns about it. Full 20 kHz support is backlog.

## Busy channel lockout (byte 18)

CHIRP's reading of the whole byte. Studio does not decode or encode it, and the stock CPS's own UI binding for it is unresolved (U), so treat the values as unconfirmed.

| Wire   | CHIRP meaning |
| ------ | ------------- |
| `0x00` | Off           |
| `0x01` | Repeater      |
| `0x02` | Busy          |

## Optional signalling, DTMF ID and 5-Tone ID

Not modelled by Studio (backlog); described so the write principle is clear.

| Field               | Where              | Meaning (stock CPS)                                                              |
| ------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Optional signalling | byte `21`          | 0 Off, 1 DTMF, 3 5-Tone; 2 is stored but shown as Off (C)                        |
| DTMF ID             | byte `11` bits 7-4 | 0-based index, shown plus 1 when byte 21 is 1 (C)                                |
| 5-Tone ID           | byte `23`          | Raw index; the main board reads the 32-byte entry at `0x1C60 + 32 × index` (C+F) |

## CTCSS tone indices (summary)

Wire byte → tone Hz via CHIRP `TONE_MAP_VAL_TO_TONE` (`0x00` = 62.5 Hz … `0x32` = 254.1 Hz). the stock CPS offers the same 51 tones (C). Index **`0x33`** = custom CTCSS: the tone is the little-endian word in bytes 30-31 in 0.1 Hz (so 88.6 Hz is 886). The CPS resets an index above `0x33` to 0. Studio gap: a custom tone is not decoded or encoded yet, a channel whose library tone is outside the 51-tone list is written without it, and the Write review warns. Do not paste the full table as GPL source — cite the driver path when implementing; Studio may keep a vendor-neutral Hz table at the adapter edge.

DTCS uses CHIRP `ALL_DTCS_CODES` index split across low byte + high bit, with separate invert bits for encode/decode.

## Write principle

**A Studio channel write writes what is in the Studio library, and nothing else.** Each channel is encoded as a fresh 32-byte record, so a channel that moves to another slot leaves no shadow of the slot's previous occupant. Every byte Studio does not model is written as its default (Off / `0`): byte 8, byte 9 bits 7-4, byte 10 bits 7-4 and bit 1, byte 11 high nibble (DTMF ID), bytes 18, 19, 21 (optional signalling), 22, 23 (5-Tone ID) and 30-31. **Channel signalling set up on the radio or in the stock CPS (DTMF ID, 5-Tone ID, optional signalling) is therefore reset by a Studio Write**, and the Write review says so. The stock CPS zeroes only the bytes it does not model (byte 8, byte 9 bits 6-5, byte 10 bits 7-4) and rewrites the rest from its own document; Studio's channel span is not a read-modify-write. Unused slots are written as `0xFF` with both bitmap bits clear.

Settings, DTMF memories and the unmodelled gaps between them are different: those are kept from the in-session read (see [settings.md](settings.md)).

Tests pin this: a slot that held signalling bytes comes out with them cleared.

## Special slots

Besides slots 1-200 the stock CPS writes three special 32-byte slots: **VFO A at `0x1900`, VFO B at `0x1920`, and a third slot at `0x3280` (slot 203, absolute TX, duplex forced to 3)**. They have no bitmap bits. Studio does not edit them: the channel span it rewrites stops at `0x1900`, and the full image write sends them back as read. The CPS refuses to Write with no normal channel ("Leave at least one normal channel!") or with an empty VFO; Studio does not.

## Web Serial Write (Studio)

| Behaviour           | Implementation                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scan inclusion      | Effective scan resolution (build default + per-channel override) → `scan_enabled_bitfield` @ `0x1960` via `scanAdd` on `RadioChannelDto` ([#734](https://github.com/pskillen/codeplug-studio/issues/734))                                                 |
| DTCS reverse        | Library `DnnnI` / CHIRP invert → byte `15`/`17` bit **1** on decode/encode ([#735](https://github.com/pskillen/codeplug-studio/issues/735); corrected [#1234](https://github.com/pskillen/codeplug-studio/issues/1234))                                   |
| DTCS code index     | `ALL_DTCS_CODES` wire index (512 codes 000–777); low byte + bit 0 highbit — not the 104-code subset index ([#1234](https://github.com/pskillen/codeplug-studio/issues/1234))                                                                              |
| Simplex offset      | Offset BCD `0` when duplex is none — not RX frequency ([#1234](https://github.com/pskillen/codeplug-studio/issues/1234))                                                                                                                                  |
| Custom CTCSS `0x33` | **Gap:** Studio does not decode or encode custom CTCSS on Web Serial yet (the encoding is now known, see above); a tone outside the 51-tone list is dropped and the Write review warns ([#1464](https://github.com/pskillen/codeplug-studio/issues/1464)) |
| Stock names         | Folded to printable ASCII (`0x20`-`0x7E`, case kept) at write time; the wire-name preview notes names the stock CPS would show as spaces ([#1464](https://github.com/pskillen/codeplug-studio/issues/1464))                                               |

Read from radio does not import scan flags into library `scanInclusion` — scan bitfield is write-projection only (same pattern as UV-17Pro flat-memory adapters).

## Related

- [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV naming cross-check only: [export-formats/chirp/channels.md](../../../export-formats/chirp/channels.md)
