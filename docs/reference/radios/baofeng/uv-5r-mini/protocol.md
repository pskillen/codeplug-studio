# UV-5R Mini — PROGRAM + R/W protocol

Handshake and framing for Baofeng UV-5R Mini (UV-17Pro family) over Web Serial. Distinct from CHIRP CSV / `.neonplug` file interchange and from classic UV-5R **S/X**.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `baofengProtocol.ts`, `serialConnection.ts`, `constants.ts`; CHIRP `baofeng_uv17Pro.py` (facts only).

## Identity

| Item              | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Ident (16 ASCII)  | `PROGRAMCOLORPROU` (`MSTRING_UV17PROGPS`)                   |
| ACK / fingerprint | `0x06`                                                      |
| Block size        | `0x40`                                                      |
| Read opcode       | `0x52` (`R`)                                                |
| Write opcode      | `0x57` (`W`)                                                |
| Crypt             | XOR with symbol table; default **`encrsym = 1`** (`"CO 7"`) |

## Baud (documented disagreement)

| Source                                             | Baud       |
| -------------------------------------------------- | ---------- |
| CHIRP `UV17Pro.BAUD_RATE` (Mini does not override) | **115200** |
| NeonPlug `UV5RMINI_BAUD_RATE`                      | **38400**  |

**Studio Web Serial path ([#673](https://github.com/pskillen/codeplug-studio/issues/673)):** open at **115200** (CHIRP). On ident/handshake timeout or wrong ident, reconnect once at **38400** (NeonPlug). Ident failure messages list baud(s) tried.

## Transport settles and line control

| Step                      | Studio                                                  | NeonPlug      | CHIRP                     |
| ------------------------- | ------------------------------------------------------- | ------------- | ------------------------- |
| After port open           | **300 ms** settle → flush RX buffer → **200 ms** settle | same          | `_clean_buffer` drain     |
| Before each magic / write | flush RX buffer                                         | `buf = []`    | —                         |
| ACK after ident / write   | seek `0x06` (discard leading junk)                      | `waitForByte` | exact after flush         |
| Read block reply          | drain to leading `0x52`, then 68 bytes                  | same          | exact 68 bytes            |
| RTS / DTR                 | assert when Web Serial `setSignals` supported           | —             | `WANTS_RTS` / `WANTS_DTR` |

## Handshake

1. Post-open settle and flush (see table above).
2. Send ident `PROGRAMCOLORPROU`.
3. Seek ACK `0x06` (may follow junk bytes).
4. Flush, send each magic (`F`, `M`, then `SEND!…` trailer); flush before each magic write.

### Magics (NeonPlug)

| Step | Payload                                                             | Expect   |
| ---- | ------------------------------------------------------------------- | -------- |
| 1    | `0x46` (`F`)                                                        | 16 bytes |
| 2    | `0x4d` (`M`)                                                        | 15 bytes |
| 3    | `SEND!` + trailer; **last byte `0x00` = read**, **`0x01` = upload** | 1 byte   |

### Model-reply check

The 15-byte reply to the `M` magic names the model. Studio requires it to start with ASCII `5RMINI`; on any other
reply (another model, or all zeros) the session stops with "This radio doesn't answer as a UV-5R Mini. Nothing was
written." The check runs on the `M` step of both magic sets, so Read, Write and Restore all stop at the handshake,
before the first `W` frame. Sibling layouts that share the code set no prefix and are unchanged.

CHIRP `_do_ident` uses the same ident + fingerprint, then magics with **last byte `0x00` for both** download and upload (no separate upload trailer).

## Frames

### Read

- Request: `0x52` + address (u16 BE) + length (`0x40`)
- Response: 4-byte header (starts `0x52`) + 64-byte payload → decrypt with `encrsym`

### Write

- Request: `0x57` + address (u16 BE) + `0x40` + **encrypted** 64-byte block
- Response: ACK `0x06`

### Write interlock

Write and Restore both send every `W` frame through one funnel (`Uv17ProProtocol.writeBlock`), which calls the Mini's
`assertUv5rMiniWriteAllowed` (`uv5r-mini/writeInterlock.ts`) before any byte of the block goes out. The whole plan is
also checked before the first frame (handshake included), so a refused address sends nothing. Pure, no flag disables
it; a refusal throws `Uv5rMiniWriteRefusedError`. Each rule has a test (`writeInterlock.test.ts`); the exact Write and
Restore plans are pinned in `writePlan.test.ts`.

- **Allowed:** 64-byte blocks, 64-aligned, inside `0x0000–0x803F`, `0x9000–0x903F` or `0xA000–0xA1BF` (521 blocks).
- **Always refused, whatever the profile:** `0xE000` and above (the top 4 KiB sector, `0xF000–0xFFFF`, is RF
  calibration and a `W` there erases the whole sector), `0xB000–0xBFFF` and `0xD000–0xDFFF` (firmware logs),
  `0x8040–0x8FFF` and `0x9040–0x9FFF` (gaps). `0xC000–0xCFFF` is refused on `stock`; the `mm9pdy` profile alone
  also allows 64-byte blocks, 64-aligned, in it (the zone table, [mm9pdy-data.md](mm9pdy-data.md)).
- A Restore whose region selection names anything but the three layout spans is refused before the first frame.
- The context carries `profile` (`stock`, or `mm9pdy` once that target sets it) and `operation` (`write`, `restore`).
  Other family layouts (UV-17Pro, UV-21Pro V2) have no interlock.

## XOR crypt (summary)

- Table of 20 four-byte symbols; default index **1** → `0x43,0x4F,0x20,0x37` (`CO 7`)
- Per byte: XOR with symbol[`i % 4`] unless symbol byte is space (`0x20`), or data is `0` / `0xFF` / equal to symbol / equal to `symbol ^ 0xFF`
- Symmetric (same function encrypts and decrypts)

Do not paste CHIRP’s full table into Studio as GPL source — cite NeonPlug `baofengProtocol.ts` / CHIRP driver path when implementing.

## Typical session flow

1. Open serial at **115200**; on ident failure retry once at **38400**.
2. Settle, flush, ident → seek ACK → read magics (flush before each).
3. Read all `MEM_*` regions in `0x40` blocks → assemble packed `0x8240` image ([memory-layout.md](memory-layout.md)). Sync each read reply to opcode `0x52`.
4. For **Write** upload: **Write connect uses the read handshake** so ident runs before any `R` ([#1275](https://github.com/pskillen/codeplug-studio/issues/1275)). Then in-session pre-write read of all `MEM_*` blocks (progress **Pre-write read**), overlay modelled channels onto that live packed image, then **`W` with no second handshake** while the session is live. A second ident or second `F` (`needed 16 bytes`) stays silent inside a session. If the session has gone idle (Review), Write re-handshakes first: see [Clone session idle drop](#clone-session-idle-drop). Restore still idents + upload magics. See [settings.md](settings.md). No persisted stash. Hardware verify pending.
5. For **Restore** (not Write): connect skips ident; `restoreFromBackup` sends ident + upload magics, then selected zip MEM bins — never assemble / stash merge. See [backup-restore.md](backup-restore.md). Hardware verify pending.

## Clone session idle drop

Decoded from the radio's firmware; not yet confirmed on a radio.

- The radio ends a clone session about **2 s** after the last byte it receives. Every byte received restarts that
  countdown. If the last frame was a `W` the radio restarts; otherwise it goes back to its idle screen.
- Outside a session it answers only the ident. Any other frame, a `W` included, is dropped with no reply, which shows
  as `Expected ACK 0x06, timed out` on the first block.
- Inside a session a second ident gets no reply (matching the hardware note above).

What Studio does:

- `UV5R_MINI_LAYOUT.sessionIdleMs` is **1500 ms**. The protocol records when the radio last completed an exchange
  (handshake, read reply or write ACK). Before the first `W` of a Write or Restore, if more than that has passed, it
  runs the ident and the upload magics again, with the [model-reply check](#model-reply-check).
- A re-handshake first waits until **2500 ms** (`sessionEndedAfterMs`) after the last exchange, so a radio still in
  its old session does not swallow the ident. After a Review of a few seconds there is nothing left to wait.
- The descriptor also sets `programHoldSafeMs` to **1500 ms**, so a Write whose Review stays open longer reconnects
  and re-reads before writing: the radio was back on its idle screen and may have been changed. The protocol check
  covers Restore and any gap outside Review.
- The UV-21Pro V2 layout shares the code but sets neither value; nothing is known about its idle behaviour.
- Tests: `uv5r-mini/sessionIdle.test.ts`, against `FakeMiniRadio` with its session model on a fake clock.

## Transport and TX budget

- **Cable:** CH340 (`1a86:7523`) on the K-plug cable; the radio has no USB data port (owner RE of the Mini, baofeng-uv5rmini-firmware ledger rows `O/2026-10-22-no-usbc` and `H/2026-10-22-port-check`). The radio sees a plain 115200 8N1 UART, so a USB packet boundary never reaches it. A Web Serial split can add at most one host-side gap (milliseconds) inside a frame. The radio's inter-byte receive timeout is **unknown** (no firmware image); a gap that long would show as `Expected ACK 0x06, timed out`.
- **Frames:** read request 4 B; write frame 68 B (4 + 0x40), the largest frame of any Read, Write, Check write or Restore (the 43 B handshake is the largest of a read-only session). 521 blocks per image.
- **TX bytes per port open** (counted by running the real protocol against a scripted radio):

| Session                                                      | TX bytes                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Write (connect, pre-write read, upload; no second handshake) | 37,555 B (57% of the old 64 KiB buffer, about 4% of the 1 MiB host buffer) |
| Read, or Check write (handshake + download)                  | 2,127 B                                                                    |
| Restore (handshake + all spans)                              | 35,471 B                                                                   |

- **Fresh port per phase:** Write releases the session after upload; Check write opens its own port (new grant, new `port.open`), as does Restore and the baud-fallback reopen. Each open starts a fresh writable stream, so no phase comes near the 1 MiB write buffer ring. A Write stayed under the old 64 KiB buffer as well; about 28 Writes on one stream (not a Studio flow) would be needed to pass 1 MiB. The pipe also rotates the writable before any frame that would straddle the ring boundary, pinned by `uv17pro-family/webSerialSplit.test.ts`.
- **Read replies:** `readBlock` checks opcode, length and the echoed address (`R`+addr in the reply header); the write ACK is a bare `0x06` with no address and ACK seeking stays tolerant of leading junk.

## Write verify

Upload stages **plaintext** 64-byte blocks at each radio `MEM_*` address. **Verify write** reconnects without a reboot wait, downloads and decrypts the full packed image, and compares staged payloads via packed-offset mapping. Regions follow `uv17pro-family/writeRole.ts`. Feature: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

## BLE (follow-up)

NeonPlug supports BLE (`FFE0` / `FFE1`, name filter `walkie-talkie`) with the same framing; CHIRP uses a larger BLE upload block (`0x80`) when BLE is active. **Out of scope** for this docs ticket and for closing adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) — note only.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)
