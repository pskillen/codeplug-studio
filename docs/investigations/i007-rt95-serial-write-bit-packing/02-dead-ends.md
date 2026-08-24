# Dead ends — do not re-chase

**Append-only.** One line per killed hypothesis, plus what killed it.

---

## Not the cause of this on-air report

| Hypothesis | Killed by | Why it's dead |
| ---------- | --------- | ------------- |
| PROGRAM→QX handshake, baud, echo-strip, or `END` is dropping or scrambling channel bytes | `S/1234`; `S/protocol` | Issue scopes those out; RX BCD on the radio is plausible only if the 32-byte records arrive. |
| Occupancy (`0x1940`) or scan (`0x1960`) bitfields make channels unusable | `S/1234`; `S/bitfield` | Separate from bytes 9–11; occupancy encode is not the reported TX-offset/tone failure. |
| BCD frequency scaling is off by 10× / 100× | `S/bcd`; `R/studio-encode`; operator “RX looks right” | Plus-split offset BCD is `00 00 06 00` for 600 kHz; RX 146.52 MHz BCD round-trips. |
| CTCSS index table (`0x0d` = 100.0 Hz) is the tone failure | `S/ctcss`; W5 | Encode-only enable bit coincidentally matches CHIRP; TSQL/DTCS enables do not. |
| Studio unit tests already prove packing vs the radio | `S/codec-test`; W6 | Tests never compare to CHIRP golden bytes. |
| Only encode is wrong and decode is already CHIRP-accurate | `S/codec` | Decode uses the same LSB `getBit`/`getBits` positions. Self-consistent pair. |

### Deliberately NOT in this file

- “CHIRP bit order might be LSB-first after all” — killed for **what CHIRP writes** by `R/chirp-pack`. Still not a firmware dump. Do not treat firmware as proven until a radio image is captured (`05-open-items.md`).
