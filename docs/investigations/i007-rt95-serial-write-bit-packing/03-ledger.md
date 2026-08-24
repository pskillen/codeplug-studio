# Evidence ledger

**Rows are immutable.** If a verdict turns out to be wrong, add a **new** row referencing the old id.

Clocks: dates in this file are local `Europe/London` on the day the row was added.

| Prefix | Kind |
| ------ | ---- |
| `S/` | source read (issue, Studio, CHIRP — facts only) |
| `R/` | computed / harness run |
| `C/` | capture (radio dump) — none yet |

---

## Source reads

| id | Artefact | Config | Result as reported | What it actually established |
| -- | -------- | ------ | ------------------ | ---------------------------- |
| `S/1234` | GitHub [#1234](https://github.com/pskillen/codeplug-studio/issues/1234) | open, no comments, 2026-08-24 | Packing vs CHIRP MSB-first; golden bytes listed; simplex offset must not be RX Hz | Ticket hypothesis and acceptance. Not itself a radio dump. |
| `S/codec` | `src/integrations/radio-io/radios/rt95/channelCodec.ts` | workspace 2026-08-24 | `setBits`/`getBits` as in W2; simplex `offsetHz = dto.rxHz` | What Studio writes and how it reads it back. |
| `S/codec-test` | `channelCodec.test.ts` | workspace 2026-08-24 | `tx_off` asserted at bit 7 of byte 10; encode/decode round-trip | Tests lock the LSB map. |
| `S/fixture` | `__fixtures__/syntheticImage.ts` | workspace 2026-08-24 | `ch[9]=0x20`, `ch[10]=0x20` for High+FM | Fixture is Studio-shaped. |
| `S/bcd` | `bcd.ts` | workspace 2026-08-24 | `floor(hz/10)` packed nibble-low-first | Scaling only. |
| `S/ctcss` | `ctcssToneTable.ts` | workspace 2026-08-24 | `0x0d` → 100.0 Hz | Index map, not enable bits. |
| `S/tier3` | `docs/reference/radios/retevis/rt95/channel-record.md` | workspace 2026-08-24 | “little-endian bitfield layout”; no per-bit table for 9–11 | Docs do not pin CHIRP bit numbers. |
| `S/projection` | `src/app/services/radioIoWriteProjection.ts` | workspace 2026-08-24 | `rxOnly` from forbid-transmit | DTO flag is set; wire bit is encode’s job. |
| `S/chirp-bitwise` | local `chirp/bitwise.py` `Processor.do_bitfield` / `bitDataElement` | chirp workspace 2026-08-24 | `_shift` starts at 8 for a `u8` group and decrements; first field occupies high bits | How CHIRP **software** packs bits. Not firmware. |
| `S/chirp-setmem` | local `chirp/drivers/anytone778uv.py` `set_memory` | facts only: offset `int(mem.offset/10)`; duplex enum; `tx_off` on duplex `off` | What CHIRP assigns into the bitwise object | Does not print raw bytes by itself. |
| `S/protocol` | `docs/reference/radios/retevis/rt95/protocol.md` | workspace | PROGRAM→QX 16-byte blocks | Out of scope for packing. |
| `S/bitfield` | `src/integrations/radio-io/radios/rt95/bitfield.ts` | workspace | occupancy/scan at `0x1940`/`0x1960`; bit 0 = memory 1 | Same bit addressing as CHIRP `get_bitfield`. |
| `S/chirp-bitfield` | `anytone778uv.py` `get_bitfield` / `set_bitfield` | chirp workspace 2026-08-24 | `bitidx = number % 8`, set `(1 << bitidx)` | LSB-in-byte occupancy/scan; not MSB-first. |
| `S/dtcs-table` | `channelCodec.ts` `DTCS_CODES` | workspace 2026-08-24 | 104 standard codes + 645, then `.sort()`; 023 → index 0 | Studio DTCS wire index. |
| `S/chirp-dtcs` | `chirp_common.ALL_DTCS_CODES` + `dtcs_code_val_to_bits` | chirp workspace 2026-08-24 | 512 codes 000–777; 023 → index 19; high bit is `index >> 8` | CHIRP DTCS wire index. |

## Runs

| id | Artefact | Config | Result as reported | What it actually established |
| -- | -------- | ------ | ------------------ | ---------------------------- |
| `R/chirp-pack` | inline Python using `chirp.bitwise.parse` on a **minimal** `u8` bitfield group with the same widths/order as the memory struct (not a copy of the driver file) | `PYTHONPATH=$CHIRP_ROOT`; CPython 3 | High+none+FM → `08 08`; High+plus → `09 08`; High+tx_off+FM → `08 09`; TSQL → byte11 `05`; DTCS both → `0a`; invert+highbit → bits 1 and 0 (`03`) | CHIRP bitwise output for those field values. |
| `R/studio-encode` | `harness/encode-studio-bytes.mts` via `npx vite-node --script` | repo 2026-08-24 | High+none+FM → `20 20`; plus → `60 20`; tx_off → `20 a0`; TSQL `03`; DTCS both `0c`; invert TX byte17 `40`; simplex offset BCD `00206514`; +600 kHz `00000600` | What **this** `encodeChannelRecord` emits today. |

## Captures / dumps

| id | Artefact | Source | Why it matters |
| -- | -------- | ------ | -------------- |
| _(none)_ | | | A CHIRP-written 32-byte channel vs a Studio-written one on the same radio is the firmware closer. |

---

## Reproducing the comparison

Studio:

```bash
npx vite-node --script docs/investigations/i007-rt95-serial-write-bit-packing/harness/encode-studio-bytes.mts
```

CHIRP bitwise: parse an 11-byte (or larger) buffer with `u8` fields in the same order and widths as bytes 9–17 of the channel record, set `txpower=2`, `duplex=0`, `channel_width=2`, read `get_raw()`. Do not commit GPL driver source into this repo.
