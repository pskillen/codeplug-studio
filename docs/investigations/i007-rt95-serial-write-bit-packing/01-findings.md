# Findings — what is true

**Append-only.** Every row cites a `03-ledger.md` id or an evidence class. A finding that dies
moves to `02-dead-ends.md` and is deleted from here.

Nothing enters on inference alone. Where something is inference it says so in the row.

---

## The failure

| # | Finding | Evidence |
| - | ------- | -------- |
| W1 | Operator: Web Serial Write to Retevis RT95 VOX leaves channels unusable on air; RX frequency looks right; TX offset is off by several decimal places; cannot TX; CTCSS/DCS wrong or inactive. Handshake / occupancy / scan bitfields are not the suspected failure. | operator report; `S/1234` |
| W2 | Studio `encodeChannelRecord` / `decodeChannelRecord` pack byte 9 `txpower` at bits 4–5 and `duplex` at bits 6–7; byte 10 `channel_width` at bits 4–5 and `tx_off` at bit 7; byte 11 CTCSS/DCS enables at bits 0–3 in order enc-ctcss, dec-ctcss, enc-dtcs, dec-dtcs; DTCS invert/highbit on bytes 15/17 at bits 6–7. | `S/codec` |
| W3 | CHIRP `bitwise` packs bitfields **MSB-first**: the first field listed in a `u8 a:n, b:m, …` group occupies the high bits of that byte. For this memory struct that puts `duplex` in byte 9 bits 1–0, `txpower` in bits 3–2; `tx_off` in byte 10 bit 0, `channel_width` in bits 3–2; CTCSS encode enable in byte 11 bit 0, DTCS encode bit 1, CTCSS decode bit 2, DTCS decode bit 3; DTCS invert/highbit in bytes 15/17 bits 1–0. | `S/chirp-bitwise`; `R/chirp-pack` |
| W4 | Measured CHIRP `bitwise` bytes vs measured Studio encode for High power + FM (width value 2): | `R/chirp-pack`; `R/studio-encode` |

CHIRP vs Studio (bytes 9 / 10 / 11, then 15 / 17 where relevant):

| Case | CHIRP | Studio |
| ---- | ----- | ------ |
| High + none + FM | `08 08 00` | `20 20 00` |
| High + plus + FM | `09 08 00` | `60 20 00` |
| High + tx_off + FM | `08 09 00` | `20 a0 00` |
| CTCSS encode-only | byte 11 `01` | byte 11 `01` (same by coincidence) |
| CTCSS TSQL | byte 11 `05` | byte 11 `03` |
| DTCS encode+decode | byte 11 `0a` | byte 11 `0c` |
| DTCS invert on TX | byte 17 bit 1 (`02` when invert only) | byte 17 bit 6 (`40`) |

| # | Finding | Evidence |
| - | ------- | -------- |
| W5 | CTCSS encode-only landing on `0x01` does **not** prove tone packing is correct. TSQL and DTCS enables differ. | `R/chirp-pack`; `R/studio-encode` |
| W6 | Existing `channelCodec.test.ts` asserts `(raw[10] >> 7) & 1 === 1` for `rxOnly`, and round-trips tones via encode then decode. That encodes the LSB map, not CHIRP’s. A packing fix will fail that bit-7 assertion and still pass a same-map round-trip if decode is updated with encode. | `S/codec-test` |
| W7 | Synthetic fixture `ch[9] = 0x02 << 4` / `ch[10] = 0x02 << 4` is the Studio LSB layout (High + FM), not the CHIRP bytes `08 08`. Decode tests that use it only prove self-consistency. | `S/fixture` |
| W8 | Simplex and `rxOnly` paths set `offsetHz = dto.rxHz` and BCD-encode that into bytes 4–7. For 146.52 MHz that is offset BCD `00 20 65 14` (RX frequency, not 0). Plus split `tx = rx + 600 kHz` correctly writes offset BCD `00 00 06 00`. CHIRP `set_memory` writes `_mem.offset = int(mem.offset / 10)`; simplex memories use offset 0 unless the user set one. | `S/codec`; `S/chirp-setmem`; `R/studio-encode` |
| W9 | BCD Hz scaling (`floor(Hz/10)` into 4-byte packed BCD, low nibble first) is shared by Studio `bcd.ts` and the operator-visible “RX frequency looks right.” Not implicated in this packing bug. | `S/bcd`; `S/1234` |
| W10 | Tier-3 [channel-record.md](../../reference/radios/retevis/rt95/channel-record.md) says packing “follows CHIRP’s little-endian bitfield layout” without listing bit numbers inside bytes 9–11. That phrase matches Studio’s LSB `setBits` and does **not** match CHIRP `bitwise` (MSB-first within the byte). | `S/tier3` |
| W11 | Write projection stamps `rxOnly` from forbid-transmit. The bit never reaches the radio’s `tx_off` field because encode puts it at bit 7 of byte 10. | `S/projection`; W2; W3 |
| W12 | **Inference, high confidence:** radio firmware consumes the CHIRP bit positions. Then Studio High+plus (`byte9=0x60`) looks like scramble set, duplex none, low power; `tx_off` never lands on bit 0 so TX-disable does not do what Studio intends; duplex none with offset BCD = RX Hz is a several-decade offset if firmware still displays or applies the offset field. | inference from W1, W3, W4, W8 |

## Other encode differences (same codec pass)

| # | Finding | Evidence |
| - | ------- | -------- |
| W13 | CHIRP `anytone778uv` stores DTCS as an index into `chirp_common.ALL_DTCS_CODES` (512 octal-looking codes 000–777). DCS 023 is index **19**. Studio indexes a **sorted 105-entry** list (`DTCS_CODES` + `645`). DCS 023 is index **0**. Every standard code’s wire index differs from CHIRP; 654–754 also differ from unsorted `DTCS_CODES` because `645` is inserted then sorted. | `S/dtcs-table`; `S/chirp-dtcs` |
| W14 | CHIRP VOX names are space-padded to 6 characters. Studio NUL-pads (`0x00`). Likely display-only if the radio treats NUL as terminator; still a wire difference. | `S/codec`; `S/chirp-setmem` |
| W15 | CTCSS Hz↔index table matches CHIRP `TONE_MAP` (`0x0d` = 100.0). Custom index `0x33` is unimplemented on both sides. | `S/ctcss`; `S/chirp-setmem` |
| W16 | Occupancy / scan bitfields at `0x1940` / `0x1960` use bit 0 of each byte as memory 1 — same as CHIRP `get_bitfield`. Not implicated. | `S/bitfield`; `S/chirp-bitfield` |
| W17 | Byte 20 `tone_squelch_en` is the **last** 1-bit field in that `u8`, so it occupies bit 0 under CHIRP MSB-first. Studio already sets bit 0 on RX CTCSS/DCS. That bit is **not** part of the bytes 9–11 packing bug. | `S/codec`; `S/chirp-bitwise` |
| W18 | Busy-channel lockout (byte 18 bits 1–0 under MSB-first), odd-split (`duplex=3`), talkaround/scramble/reverse, and custom CTCSS `ul16` are not modelled on Write. Fresh encode leaves them 0, matching CHIRP’s zeroed record when extras are unset. | `S/codec`; `S/1234` out of scope |

## Settled elsewhere — cite, do not restate

| Topic | Where it lives now |
| ----- | ------------------ |
| Record size, occupancy, name length | [channel-record.md](../../reference/radios/retevis/rt95/channel-record.md) |
| Image span / PROGRAM→QX | [memory-layout.md](../../reference/radios/retevis/rt95/memory-layout.md), [protocol.md](../../reference/radios/retevis/rt95/protocol.md) |
| Scan / occupancy bitfields | not this bug (`S/1234` out of scope) |
