# RT95 VOX — PROGRAM→QX protocol

Handshake and framing for Retevis RT95 VOX (AnyTone 778UV family) over Web Serial. Distinct from CHIRP CSV file interchange and from UV-5R Mini **PROGRAM+R/W**.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` (`AnyTone778UVBase` / `RetevisRT95vox`) — facts only; do not paste GPL sources.

## Not UV-5R Mini PROGRAM+R/W

|           | RT95 PROGRAM→QX (this doc)                      | Mini PROGRAM+R/W ([#616](https://github.com/pskillen/codeplug-studio/issues/616)) |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Enter     | ASCII `PROGRAM` → `QX` + `0x06`                 | Ident string e.g. `PROGRAMCOLORPROU`                                              |
| Baud      | **9600**                                        | ~38400 / 115200                                                                   |
| Block     | **`0x10`** (16 bytes)                           | `0x40` (64 bytes)                                                                 |
| Address   | u16 BE                                          | u16 BE                                                                            |
| Write     | 8-bit checksum + trailing `0x06`; NACK `0x0a`   | XOR crypt path                                                                    |
| Transport | **Echo-strip** required (shared TX/RX)          | Not this kit                                                                      |
| Image     | Contiguous ≈ `0x0000`–`0x3290` (`0x32A0` bytes) | Multi-region packed `0x8240`                                                      |

Kit codec for this family is shipped as [#641](https://github.com/pskillen/codeplug-studio/issues/641) (`programQx.ts`); adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643).

## Identity

| Item          | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Baud          | **9600**                                                                                       |
| Enter         | ASCII `PROGRAM`                                                                                |
| Enter reply   | ASCII `QX` + `0x06`                                                                            |
| Version probe | `0x02` after enter                                                                             |
| Exit          | ASCII `END`                                                                                    |
| Block size    | `0x10` (16)                                                                                    |
| Read opcode   | `0x52` (`R`)                                                                                   |
| Write opcode  | `0x57` (`W`)                                                                                   |
| Write ACK     | Trailing `0x06` on command; radio replies with `0x06` (1 byte)                                 |
| Write NACK    | `0x0a` (Studio treats any non-`0x06` reply as a failure; the stock CPS recognises only `0x06`) |
| Image span    | `MEMORY_ADDRESS_RANGE = (0x0000, 0x3290)` → assembled `0x32A0`                                 |

## Model allow-list (version response)

After `PROGRAM` → `QX\x06`, host sends `0x02`. Radio replies with a version blob (CHIRP `VER_FORMAT`):

| Field     | Notes                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------ |
| Header    | `0x49`                                                                                           |
| Model     | 7-char ASCII (NUL-padded / trimmed)                                                              |
| Bandlimit | 1 byte — band table index (see [settings.md](settings.md))                                       |
| Version   | 4 characters (`V100`) in bytes 9-12; bytes 13-14 are reserved and not inspected by the stock CPS |
| Trailer   | ACK `0x06`                                                                                       |

Studio’s RT95 **VOX** target matches CHIRP `RetevisRT95vox`:

| Class            | Wire model   | Wire version | Name length | VOX |
| ---------------- | ------------ | ------------ | ----------- | --- |
| `RetevisRT95vox` | **`RT95-P`** | **`V100`**   | **6**       | Yes |
| `RetevisRT95`    | `RT95`       | `V100`       | 5           | No  |

Reject other 778-family allow-lists (AnyTone `778UV-P` / `AT778UV`, CRT, Midland, …) unless a separate radio home is opened ([#644](https://github.com/pskillen/codeplug-studio/issues/644)).

## Echo-strip transport

TX and RX share a single pin on this radio. Every host write is echoed back before the radio’s reply. Implementations **must**:

1. Write the command bytes.
2. Read until `len(response) - len(command) == expected_reply_len` (or timeout ≈ 500 ms).
3. If the buffer starts with the command, strip that prefix and keep only the radio reply.

Without echo-strip, ACK / R/W parsing will fail. This is a defining trait of the PROGRAM→QX family vs Mini.

## Handshake

1. Open serial at **9600**.
2. Send ASCII `PROGRAM` → expect `QX` + `0x06`.
3. Send `0x02` → expect version blob; parse allow-list + bandlimit.
4. Proceed to memory R/W.
5. Send ASCII `END` to exit (best-effort on error paths).

CHIRP `detect_from_serial` enters program mode once, then picks the matching registered class from the version reply.

## Frames

### Read

| Field   | Encoding                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| Request | `0x52` + address (u16 BE) + length (`0x10`) — 4 bytes (`>BHB`)                 |
| Reply   | 4-byte header + 16-byte payload + 8-bit checksum + trailer (22 bytes = `0x16`) |

Checksum (CHIRP): 8-bit sum over reply bytes `[1:-2]`; compared to byte `[-2]`.

Address steps: `0x0000` … `0x3290` inclusive, step `0x10`.

### Write

| Field   | Encoding                                                                                 |
| ------- | ---------------------------------------------------------------------------------------- |
| Request | `0x57` + address (u16 BE) + length (`0x10`) + 16 data bytes + checksum + trailing `0x06` |
| Reply   | 1 byte: `0x06` ACK, or `0x0a` NACK                                                       |

Checksum (CHIRP): 8-bit sum over command bytes after the opcode (`cmd[1:]` before checksum/trailer).

Upload path also issues a priming read at radio address **`0x3b10`** (outside the clone image span) before writing the contiguous map — reply shape matches a normal read frame. The stock CPS reads `0x3B18`–`0x3B1B` from that reply and compares it with its own "Program PassWord" string, prompting if non-empty (C; meaning I). Studio ignores the reply; surfacing a non-empty program password is backlog.

## Typical session flow

1. Open serial @ 9600 → echo-aware transport.
2. `PROGRAM` → `QX\x06` → `0x02` version / allow-list.
3. Read all blocks `0x0000`…`0x3290` step `0x10` → assemble contiguous `0x32A0` image ([memory-layout.md](memory-layout.md)).
4. For **Write** upload: in-session full-clone pre-write read of blocks `0x0000`…`0x3290` (progress **Pre-write read**), overlay modelled channels onto that live image, then upload handshake → priming read `0x3b10` → write each `0x10` block → `END`. No persisted stash. Hardware verify pending.
5. For **Restore** (not Write): `restoreFromBackup` uploads selected zip clone bins with that same `upload()` handshake — never assemble / stash merge, and never a live pre-write read inside `upload()`. See [backup-restore.md](backup-restore.md). Hardware verify pending.
6. Prefer RMW for settings / bandlimit — see [settings.md](settings.md). Channel records are the exception: they are written fresh ([channel-record.md — Write principle](channel-record.md#write-principle)).

**After `END` the radio ignores `PROGRAM` for about 3–5 s** (measured on an RT95-P: the head reloads from the main board). Studio sends `END` after Write and when a session that was in PC mode closes. A session that needs PC mode again within that window retries `PROGRAM` every 1.5 s for up to 12 s (`enterProgramQxModeWithRetry`), then fails with "The radio did not answer after the last write". Retry applies to **Verify write** and to a `connect` within 15 s of Studio's own `END`; a connect with no recent `END` sends `PROGRAM` once, so a wrong port still fails in half a second.

## Stock CPS comparison

What the stock CPS 2.01/2.02 does differently on the same link (firmware findings F110-F112, F114, F119, F126; C = read in the CPS code, I = inferred). Nothing was observed on a radio.

| Topic              | Stock CPS                                                                                                            | Studio                                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frames             | `PROGRAM`, `02`, `R 3B10`, `R`, `W`, `END` only (C). It never sends calibration or factory frames                    | Same set                                                                                                                                                                                                    |
| Write set          | Every block `0x0000`–`0x3290` except `0x30F0`–`0x31FF` and the slot of each absent channel; no read-modify-write (C) | Every block `0x0000`–`0x3290` (a harmless superset), after a full pre-write read, so unmodelled settings and gap bytes are kept; channel records are written fresh (see channel-record.md, Write principle) |
| Retries            | 3 attempts per frame, about 300 ms apart (I); a Retry/Cancel box only in the first steps (C)                         | 500 ms per frame, no resend; a timeout or non-ACK aborts the Write. Per-frame retry is backlog                                                                                                              |
| `END`              | Sent only after an orderly finish; an error leaves the radio in PC mode (C)                                          | Sent in a `finally`, also after an error                                                                                                                                                                    |
| Ident check        | Model `RT95-P` and version `V100`, else it ends with no `END` (C)                                                    | Same strings                                                                                                                                                                                                |
| Band check         | Write refuses when the radio's band differs from the file's (C)                                                      | Write warns only (the main board protects `0x326D`, F120). **Restore refuses** a backup of another band                                                                                                     |
| Address range      | Cannot form an address at or above `0x4000` (F115)                                                                   | MM9PDY adds `0x4000`–`0x5FF0` ([mm9pdy-data.md](mm9pdy-data.md)); never `0x3B00`–`0x3FFF`                                                                                                                   |
| Empty channel list | Refuses to Write with no normal channel or an empty VFO (C)                                                          | Writes zero channels if the build has none                                                                                                                                                                  |

## MM9PDY Write (zones and descriptions)

The MM9PDY target adds three things to the session above; the stock target does none of them.

1. **Chip probe.** At the end of the pre-write read, Studio reads `0x3B00` and `0x7B00` and refuses the Write unless the first starts `RT95-P` NUL, neither block is all zeros, and the two differ. The same probe runs again inside `upload()` right after the priming read, before the first `W`. Refusals send no `W`; `END` still goes out.
2. **Block order.** After the stock blocks `0x0000`-`0x3290`: description blocks (ascending), member slots, zone names, then the header at `0x4000` last. Every `W` is checked by the write interlock (16-byte aligned blocks only; `0x4010` and anything at or above `0x6000` refused; MMD1 blocks only with the MM9PDY context and a passing probe).
3. **Verify.** Verify reads every staged block at or above `0x4000` back with `R` and compares it; the result has "Zones" (`0x4000`-`0x46FF`) and "Channel descriptions" (`0x5000`-`0x5C7F`) rows.

An empty table is still written (a header with zero zones), so a Write retires an older table.

## Write verify

After upload, Studio stages every **16-byte** block written in `0x0000`…`0x3290`. **Verify write** first waits for the radio to answer `PROGRAM` again (see above; retry every 1.5 s, up to 12 s), then runs a full download, and compares staged payloads byte-for-byte. Region rows follow [writeRole.ts](../../../../../src/integrations/radio-io/radios/rt95/writeRole.ts) (`replaced` vs `kept`). Feature: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

## Link framing and TX budget

**Cable.** The host talks to the radio through a USB-serial bridge chip (the owner's is a Prolific PL2303GC `067b:23a3`; the picker also allows PL2303 `067b:2303`, CH340 `1a86:7523` and FT232R `0403:6001`), never native CDC. The bridge drives the mic jack's single-wire 9,600 8N1 line, which echoes every byte. The head MCU's USART1 ends the link; the radio has no USB of its own. The chip re-packetises into 64-byte bulk packets, so the host's write boundaries do not survive on the wire.

**How the head app frames (static disassembly, firmware findings F73, F83, F100; not run on a bus trace).**

- The USART1 ISR at `0x08014688` stores each byte into `0x20000460[idx]`. The **first byte sets the expected length**; at the last byte the ISR switches RX off and raises the frame-ready flag `*0x20000010`.
- **Idle-gap discard:** every byte received while no frame is pending reloads a timeout, `*0x20000012 = 0x32` (`0x080146A8`). The OS-timer callback `0x0800F57C` counts it down; at 0 it re-enables RX and drops the partial frame. About 250-500 ms, inferred from the timer period in F59/F100 (not measured for this counter).
- While a frame is pending, RX is off and further bytes are dropped. The protocol is strict request/reply and Studio waits for each reply, so that never happens.
- Consequence: a host write cut in two pieces is reassembled, because the head counts bytes from the first. A gap inside a frame only matters above about 250 ms. At 9,600 baud a 22-byte `W` takes about 23 ms, so a split cannot reach that. Pinned by the fake-pipe test `linkSplit.test.ts` (it models the length framing; it does not prove the radio).
- The **head bootloader** (the flasher's target) has never been seen. How it frames, and whether it checks each frame's sum, is unknown.

**TX bytes per port-open** (the Web Serial writable stream; measured with the real `Rt95Protocol` against the fake radio):

| Session                                                             | TX bytes | Writes | Largest frame |
| ------------------------------------------------------------------- | -------- | ------ | ------------- |
| Read (connect + download)                                           | 3,251    | 813    | 7 (`PROGRAM`) |
| Stock Write / Restore (connect + pre-write read + upload)           | 21,086   | 1,627  | 22 (`W`)      |
| MM9PDY Write, worst MMD1 (32 zones x 200 members, 200 descriptions) | 27,636   | 1,928  | 22            |
| Check (verify session after an MM9PDY Write)                        | 4,439    | 1,110  | 7             |
| Head firmware flash, stock V1.41 (104 frames)                       | 107,336  | 106    | 1,032         |
| Head flash, whole 120-frame window                                  | 123,848  | -      | 1,032         |
| Head flash, worst case (every frame sent 4 times)                   | 495,368  | -      | 1,032         |

- Write, then Check, are separate port-opens (the session is released between them), as is the flash pre-flight.
- The codeplug image is about 13 KB; the **TX** for a codeplug Write is 21-28 KB because every 16-byte block is echoed-and-acked frame by frame. Neither reaches 64 KiB, so no codeplug session was ever split by the host.
- The **flasher** is the only RT95 path that crossed 64 KiB (frame 64, `0x08011C00`, cut at byte 513) before the Web Serial buffer fix. Every owner flash in that state passed and booted, and the head boots and runs, which is the evidence for frame 64 itself (stock app code); F101 self-checked the fill bytes after frame 64, not frame 64. With the fix, even the 495 KB worst case stays under the 1 MiB ring and no stream rotation happens on this radio.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md) · [backup-restore.md](backup-restore.md)
- Shipped kit: [#641](https://github.com/pskillen/codeplug-studio/issues/641) (`programQx.ts`) · adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643) (`radios/rt95/`)
