# UV-21Pro V2 — PROGRAM + R/W protocol

Handshake and framing for Baofeng UV-21Pro V2 (UV-17Pro family) over Web Serial. Distinct from CHIRP CSV file interchange and from classic UV-5R **S/X**.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `chirp/drivers/baofeng_uv17Pro.py` — class `UV21ProV2(UV17Pro)` (facts only; no GPL paste). Copyright Sander van der Wel — GPL v2+ in CHIRP tree.

## Identity

| Item              | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Ident (16 ASCII)  | `PROGRAMBFNORMALU` (`MSTRING_UV17L`)                        |
| ACK / fingerprint | `0x06`                                                      |
| Block size        | `0x40`                                                      |
| Read opcode       | `0x52` (`R`)                                                |
| Write opcode      | `0x57` (`W`)                                                |
| Crypt             | XOR with symbol table; default **`encrsym = 1`** (`"CO 7"`) |

## Baud

| Source                    | Baud       |
| ------------------------- | ---------- |
| CHIRP `UV17Pro.BAUD_RATE` | **115200** |

**Studio Web Serial path:** open at **115200** only. Unlike UV-5R Mini, there is no NeonPlug 38400 fallback lineage for this model.

## Transport settles and line control

| Step                      | Studio (planned)                                        | CHIRP                     |
| ------------------------- | ------------------------------------------------------- | ------------------------- |
| After port open           | **300 ms** settle → flush RX buffer → **200 ms** settle | `_clean_buffer` drain     |
| Before each magic / write | flush RX buffer                                         | —                         |
| ACK after ident / write   | seek `0x06` (discard leading junk)                      | exact after flush         |
| Read block reply          | drain to leading `0x52`, then 68 bytes                  | exact 68 bytes            |
| RTS / DTR                 | assert when Web Serial `setSignals` supported           | `WANTS_RTS` / `WANTS_DTR` |

## Handshake

1. Post-open settle and flush (see table above).
2. Send ident `PROGRAMBFNORMALU`.
3. Seek ACK `0x06` (may follow junk bytes).
4. Flush, send each magic (`F`, `M`, then `SEND!…` trailer); flush before each magic write.

### Magics (CHIRP `UV17Pro`)

| Step | Payload                                                         | Expect   |
| ---- | --------------------------------------------------------------- | -------- |
| 1    | `0x46` (`F`)                                                    | 16 bytes |
| 2    | `0x4d` (`M`)                                                    | 15 bytes |
| 3    | `SEND!` + trailer; **last byte `0x00`** for download and upload | 1 byte   |

UV-5R Mini uses the same magics with **last byte `0x01` on upload** (NeonPlug). If hardware upload fails with CHIRP trailer `0x00`, try Mini-style `0x01` as a follow-up — document result on hardware verify.

## Frames

### Read

- Request: `0x52` + address (u16 BE) + length (`0x40`)
- Response: 4-byte header (starts `0x52`) + 64-byte payload → decrypt with `encrsym`

### Write

- Request: `0x57` + address (u16 BE) + `0x40` + **encrypted** 64-byte block
- Response: ACK `0x06`

## XOR crypt (summary)

Same family as UV-5R Mini — see [UV-5R Mini protocol](../uv-5r-mini/protocol.md#xor-crypt-summary). Default index **1** → `CO 7`. Symmetric encrypt/decrypt.

Do not paste CHIRP’s full table into Studio as GPL source — cite CHIRP driver path when implementing.

## Typical session flow

1. Open serial at **115200**.
2. Settle, flush, ident → seek ACK → read magics (flush before each).
3. Read all `MEM_*` regions in `0x40` blocks → assemble packed `0x8380` image ([memory-layout.md](memory-layout.md)). Sync each read reply to opcode `0x52`.
4. For **Write** upload: **Write connect uses the read handshake** so ident runs before any `R` ([#1275](https://github.com/pskillen/codeplug-studio/issues/1275)). Then in-session pre-write read of all `MEM_*` blocks (progress **Pre-write read**), overlay modelled channels onto that live packed image, then **`W` with no second handshake** (second ident / second `F` stay silent). Write all **four** `MEM_*` regions ([settings.md](settings.md)). No persisted stash. Hardware verify pending.
5. For **Restore** (not Write): connect skips ident; `restoreFromBackup` sends ident + upload magics, then selected zip MEM bins — never assemble / stash merge. See [backup-restore.md](backup-restore.md). Hardware verify pending.

## Transport and TX budget

- **Cable:** Same K-plug cable family and protocol as the UV-5R Mini; the bridge chip is **unconfirmed** (CH340 assumed, not recorded anywhere). The radio sees a plain 115200 8N1 UART, so a USB packet boundary never reaches it. A Web Serial split can add at most one host-side gap (milliseconds) inside a frame. The radio's inter-byte receive timeout is **unknown** (no firmware image); a gap that long would show as `Expected ACK 0x06, timed out`.
- **Frames:** read request 4 B; write frame 68 B (4 + 0x40), the largest frame of any Read, Write, Check write or Restore (the 43 B handshake is the largest of a read-only session). 526 blocks per image.
- **TX bytes per port open** (counted by running the real protocol against a scripted radio):

| Session                                                      | TX bytes                 |
| ------------------------------------------------------------ | ------------------------ |
| Write (connect, pre-write read, upload; no second handshake) | 37,915 B (58% of the old 64 KiB buffer, about 4% of the 1 MiB host buffer) |
| Read, or Check write (handshake + download)                  | 2,147 B                  |
| Restore (handshake + all spans)                              | 35,811 B                 |

- **Fresh port per phase:** Write releases the session after upload; Check write opens its own port (new grant, new `port.open`), as does Restore and the baud-fallback reopen. Each open starts a fresh writable stream, so no phase comes near the 1 MiB write buffer ring. A Write stayed under the old 64 KiB buffer as well; about 28 Writes on one stream (not a Studio flow) would be needed to pass 1 MiB. The pipe also rotates the writable before any frame that would straddle the ring boundary, pinned by `uv17pro-family/webSerialSplit.test.ts`.
- **Read replies:** `readBlock` checks opcode, length and the echoed address (`R`+addr in the reply header); the write ACK is a bare `0x06` with no address and ACK seeking stays tolerant of leading junk.

## Write verify

Same as UV-5R Mini — shared `uv17pro-family` hooks stage radio-address plaintext blocks and compare after full download (four-region `0x8380` layout). Feature: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

## Differences vs UV-5R Mini

| Item   | UV-21Pro V2               | UV-5R Mini               |
| ------ | ------------------------- | ------------------------ |
| Ident  | `PROGRAMBFNORMALU`        | `PROGRAMCOLORPROU`       |
| Image  | `0x8380`, 4 regions       | `0x8240`, 3 regions      |
| Slots  | 1000                      | 999                      |
| Baud   | 115200 only               | 115200 + 38400 fallback  |
| Magics | CHIRP trailer `0x00` both | NeonPlug `0x00` / `0x01` |

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Sibling: [UV-5R Mini protocol](../uv-5r-mini/protocol.md)
- Kit: `src/integrations/radio-io/kit/codecs/programRw.ts`
