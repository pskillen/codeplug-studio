# AT-D890UV — APRS binary regions

Digital APRS global settings, receive filters, and per-channel bindings on AT-D890UV. Cite anytone-cps `AprsSettings::decode_D890UV` / `encode_D890UV`, `AprsReceiveFilter`, and `Channel::decode_D890UV` — facts only; do not paste GPL sources.

**Hub:** [README.md](README.md) · **Memory map:** [memory-layout.md](memory-layout.md) · **Channel record:** [channel-record.md](channel-record.md) · **CSV wire:** [export-formats/anytone/aprs.md](../../../export-formats/anytone/aprs.md)

> **Not the same as `0x3501280`.** Optional GPS info string lives at `0x3501280`/`0x30` (sentinel, never written). Real APRS config is `0x3501000` + `0x3501300`.

## Region summary

| Region | Base | Length | Studio v1 |
| --- | --- | --- | --- |
| Global APRS config | `0x3501000` | `0x260` | Read + Write modelled fields |
| Receive filters (32×) | `0x3501300` | `0x100` | Read; Write RMW-preserve (unmodelled) |
| Optional GPS info | `0x3501280` | `0x30` | Read sentinel only — not APRS |
| Channel APRS bits | MR `0x80` record | see below | Read + Write modelled fields |

Gap `0x3501260`–`0x35012FF` is unused padding between global block end (`0x3501260`) and filters (`0x3501300`).

## Global block (`0x3501000`, `0x260`) — modelled in Studio v1

Studio patches only these offsets on Write; all other bytes in the block are RMW-preserved from hydration.

| Offset | Size | Field | Encoding |
| --- | ---: | --- | --- |
| `0x0a` | 1 | Manual TX interval | u8 seconds |
| `0x0b` | 1 | Auto TX interval | u8 wire code `k` (`(k+3)×15` seconds; `0` = off) |
| `0x0d` | 1 | Fixed location beacon | `0` = off; `1` = beacon slot 1 (library fixed point) |
| `0x0e`–`0x10` | 3 | Fix 1 latitude | degrees, minutes, hundredths-of-minute |
| `0x11` | 1 | Fix 1 N/S | `0` = N, `1` = S |
| `0x12`–`0x14` | 3 | Fix 1 longitude | degrees, minutes, hundredths |
| `0x15` | 1 | Fix 1 E/W | `0` = E, `1` = W |
| `0x40` + 2×(N−1) | 2 | Digital report channel N | u16 LE — CPS channel `No.` or `0x0fa2` Current |
| `0x50` + 4×(N−1) | 4 | Digital report TG N | BCD-as-hex u32 (DMR ID) |
| `0x70` + (N−1) | 1 | Digital report call type N | `0` private, `1` group |
| `0x79` + (N−1) | 1 | Digital report slot N | `0` current, `1` TS1, `2` TS2 |

N ∈ 1…8. Sentinels for report channel: `0x0fa0` VFO A, `0x0fa1` VFO B, `0x0fa2` Current, `0xffff` none.

### Unmodelled (RMW-preserve on Write)

Includes but not limited to: TX frequencies 1–8, tones, callsign/digipeater/symbol, packet-type filter bytes (`0xa8`/`0xa9`), fixed beacons 2–8 (`0xcd`…`0x104`), `sending_text` wide-char at `0x200`, roaming, altitude. Document loss in [cross-format-reconciliation](../../../../features/aprs/cross-format-reconciliation.md).

## Receive filters (`0x3501300`, `0x100`)

32 records × 8 bytes:

| Offset in record | Size | Field |
| --- | ---: | --- |
| `0` | 1 | Enabled |
| `1` | 6 | Callsign ASCII, NUL-padded |
| `7` | 1 | SSID |

Studio does not model receive filters in the library — bytes are preserved from hydration on Write.

## Per-channel bindings (MR `0x80` record)

| Offset | Field | Modelled | Notes |
| --- | --- | --- | --- |
| `0x21` bit 5 | APRS RX | Yes | `Channel.aprs.receiveEnabled` |
| `0x35` | APRS report type | Yes | `0` Off, `2` Digital (library has no analog) |
| `0x37` | Digital APRS PTT | Yes | `0` off, `1` on |
| `0x38` | Digital report slot | Yes | **0-based** index into global slots 1–8; library `reportSlotIndex` is 1-based |
| `0x36` | Analog APRS PTT | RMW | Unmodelled |
| `0x3b` bit 3 | Analog APRS mute | RMW | Unmodelled |
| `0x3c` | Analog report freq idx | RMW | Unmodelled |

## Cross-bank channel refs

Global slot `channelN` may reference MR, AM air, or FM CPS numbers on CSV export. Web Serial Write v1 resolves **MR bank numbers only**; AmAir/FM refs warn and encode Current Channel (`0x0fa2`). Full cross-bank Write: [#756](https://github.com/pskillen/codeplug-studio/issues/756).

## Module

`src/integrations/radio-io/radios/at-d890uv/aprsCodec.ts` — patch modelled global fields; `channelCodec.ts` — per-channel APRS bits.

## Related

- Tracking [#758](https://github.com/pskillen/codeplug-studio/issues/758) · parent [#645](https://github.com/pskillen/codeplug-studio/issues/645)
- WATCH-08 allow-list [#753](https://github.com/pskillen/codeplug-studio/issues/753)
