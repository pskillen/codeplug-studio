# i007 — RT95 serial Write: duplex / tx_off / tone bits packed wrong

**Hub for this investigation.** Opened from [#1234](https://github.com/pskillen/codeplug-studio/issues/1234) (parent [#640](https://github.com/pskillen/codeplug-studio/issues/640)).

**Status:** **Code shipped** on branch `1234/pskil/rt95-channel-pack` ([#1234](https://github.com/pskillen/codeplug-studio/issues/1234)). Packing, `ALL_DTCS_CODES`, simplex offset `0`, and space-padded names are fixed in `channelCodec.ts` with golden-byte tests. **Hardware verify pending** before merge.

**Next move:** Operator writes simplex, +600 kHz, TSQL, and DTCS on RT95 VOX; confirm TX and compare dump to CHIRP.

---

## Read in this order

| File                                   | What it is                             | Mutability                          |
| -------------------------------------- | -------------------------------------- | ----------------------------------- |
| this file                              | status, strategy, rules of engagement  | status line changes; rest is stable |
| [`01-findings.md`](01-findings.md)     | what is **true**, each with a citation | **append-only**                     |
| [`02-dead-ends.md`](02-dead-ends.md)   | killed hypotheses                      | **append-only**                     |
| [`03-ledger.md`](03-ledger.md)         | one row per run / source read          | **rows are immutable**              |
| [`05-open-items.md`](05-open-items.md) | open work only                         | edited as things ship               |
| [`harness/`](harness/)                 | Studio encode printer                  | scratch                             |

Settled radio facts belong in `docs/reference/radios/retevis/rt95/` — cite, do not duplicate once promoted.

## Current strategy

Treat local CHIRP `chirp/drivers/anytone778uv.py` + `chirp/bitwise.py` as a **reference for what CHIRP writes**, not as firmware. The operator report already matches “radio reads CHIRP’s bit positions.” Discriminate by emitting the CHIRP golden bytes from Studio and dumping the same memories after Write.

Do not paste GPL sources into this tree. Field names, bit widths, and measured byte values are facts.

## Rules of engagement

- **A Studio↔Studio round-trip proves nothing about the radio.** `channelCodec.test.ts` encode/decode of the same LSB map cannot catch this bug. That is the incident that hid it through [#735](https://github.com/pskillen/codeplug-studio/issues/735) / [#733](https://github.com/pskillen/codeplug-studio/issues/733) / [#761](https://github.com/pskillen/codeplug-studio/issues/761).
- **A result that matches CHIRP on RX frequency proves nothing about duplex/tones.** BCD for RX can be right while bytes 9–11 are wrong.
- **CHIRP is evidence of what CHIRP does.** Firmware proof is a radio dump after a CHIRP write, or on-air TX after a Studio write of golden bytes.
- **Flip encode and decode together.** Changing only encode will make Read of existing Studio-written images look wrong until those images are rewritten.
- **Cite facts, do not paste the driver.**
