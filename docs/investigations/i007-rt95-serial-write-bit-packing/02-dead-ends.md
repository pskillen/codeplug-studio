# Dead ends — do not re-chase

**Append-only.** One line per killed hypothesis, plus what killed it.

---

## Not the cause of this on-air report

| Hypothesis                                                                               | Killed by                                                             | Why it's dead                                                                                                                         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PROGRAM→QX handshake, baud, echo-strip, or `END` is dropping or scrambling channel bytes | `S/1234`; `S/protocol`                                                | Issue scopes those out; RX BCD on the radio is plausible only if the 32-byte records arrive.                                          |
| Occupancy (`0x1940`) or scan (`0x1960`) bitfields make channels unusable                 | `S/1234`; `S/bitfield`                                                | Separate from bytes 9–11; occupancy encode is not the reported TX-offset/tone failure.                                                |
| BCD frequency scaling is off by 10× / 100×                                               | `S/bcd`; `R/studio-encode`; operator “RX looks right” (**retracted**) | **Killed then un-killed.** The 10 Hz unit is correct. Byte **order** is not. Hardware 2026-08-25: +7.6 MHz → +0.076 MHz. See W20–W23. |
| CTCSS index table (`0x0d` = 100.0 Hz) is the tone failure                                | `S/ctcss`; W5                                                         | Encode-only enable bit coincidentally matches CHIRP; TSQL/DTCS enables do not.                                                        |
| Studio unit tests already prove packing vs the radio                                     | `S/codec-test`; W6                                                    | Tests never compare to CHIRP golden bytes.                                                                                            |
| Only encode is wrong and decode is already CHIRP-accurate                                | `S/codec`                                                             | Decode uses the same LSB `getBit`/`getBits` positions. Self-consistent pair.                                                          |

| “BCD is not implicated; RX looking right proves the 10 Hz LE pack” | `O/2026-08-25-rt95`; `R/chirp-bbcd` | Former finding W9. Studio↔Studio BCD round-trip cannot see endian vs the radio. CTCSS working after the bit-pack PR is what proved _those_ bits; RX/offset did not. |

### Deliberately NOT in this file

- “CHIRP bit order might be LSB-first after all” — killed for **what CHIRP writes** by `R/chirp-pack`; **hardware 2026-08-25** (correct CTCSS, `+` duplex) confirms the radio uses those bit positions.
