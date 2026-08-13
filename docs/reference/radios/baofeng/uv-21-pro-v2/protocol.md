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
4. For **Write** upload: in-session pre-write read of all `MEM_*` blocks (progress **Pre-write read**), overlay modelled channels onto that live packed image, then upload handshake → write all **four** `MEM_*` regions ([settings.md](settings.md)). No persisted stash. Hardware verify pending.
5. For **Restore** (not Write): `restoreFromBackup` uploads selected zip MEM bins with that same upload handshake — never assemble / stash merge. See [backup-restore.md](backup-restore.md). Hardware verify pending.

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
