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

CHIRP `_do_ident` uses the same ident + fingerprint, then magics with **last byte `0x00` for both** download and upload (no separate upload trailer).

## Frames

### Read

- Request: `0x52` + address (u16 BE) + length (`0x40`)
- Response: 4-byte header (starts `0x52`) + 64-byte payload → decrypt with `encrsym`

### Write

- Request: `0x57` + address (u16 BE) + `0x40` + **encrypted** 64-byte block
- Response: ACK `0x06`

## XOR crypt (summary)

- Table of 20 four-byte symbols; default index **1** → `0x43,0x4F,0x20,0x37` (`CO 7`)
- Per byte: XOR with symbol[`i % 4`] unless symbol byte is space (`0x20`), or data is `0` / `0xFF` / equal to symbol / equal to `symbol ^ 0xFF`
- Symmetric (same function encrypts and decrypts)

Do not paste CHIRP’s full table into Studio as GPL source — cite NeonPlug `baofengProtocol.ts` / CHIRP driver path when implementing.

## Typical session flow

1. Open serial at **115200**; on ident failure retry once at **38400**.
2. Settle, flush, ident → seek ACK → read magics (flush before each).
3. Read all `MEM_*` regions in `0x40` blocks → assemble packed `0x8240` image ([memory-layout.md](memory-layout.md)). Sync each read reply to opcode `0x52`.
4. For **Write** upload: **Write connect uses the read handshake** so ident runs before any `R` ([#1275](https://github.com/pskillen/codeplug-studio/issues/1275)). Then in-session pre-write read of all `MEM_*` blocks (progress **Pre-write read**), overlay modelled channels onto that live packed image, then **`W` with no second handshake**. A second ident or second `F` (`needed 16 bytes`) stays silent. Restore still idents + upload magics. See [settings.md](settings.md). No persisted stash. Hardware verify pending.
5. For **Restore** (not Write): connect skips ident; `restoreFromBackup` sends ident + upload magics, then selected zip MEM bins — never assemble / stash merge. See [backup-restore.md](backup-restore.md). Hardware verify pending.

## Write verify

Upload stages **plaintext** 64-byte blocks at each radio `MEM_*` address. **Verify write** reconnects without a reboot wait, downloads and decrypts the full packed image, and compares staged payloads via packed-offset mapping. Regions follow `uv17pro-family/writeRole.ts`. Feature: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

## BLE (follow-up)

NeonPlug supports BLE (`FFE0` / `FFE1`, name filter `walkie-talkie`) with the same framing; CHIRP uses a larger BLE upload block (`0x80`) when BLE is active. **Out of scope** for this docs ticket and for closing adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) — note only.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Planned kit: transport [#615](https://github.com/pskillen/codeplug-studio/issues/615), protocol kit [#616](https://github.com/pskillen/codeplug-studio/issues/616)
