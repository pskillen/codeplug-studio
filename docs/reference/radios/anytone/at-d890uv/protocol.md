# AT-D890UV — Anytone DMR protocol

Handshake and framing for Anytone AT-D890UV over Web Serial. Distinct from Anytone CPS CSV file interchange, from RT95 PROGRAM→QX (u16 / 9600), and from UV-5R Mini PROGRAM+R/W.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps `SerialDevice`; qdmr `anytone_interface` for handshake cross-check — facts only; do not paste GPL sources.

## Not RT95 u16 or Mini PROGRAM+R/W

|       | D890 Anytone DMR (this doc)                                    | RT95 (#642)                               | Mini PROGRAM+R/W (#616) |
| ----- | -------------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| Baud  | **921600**                                                     | 9600                                      | ~38400 / 115200         |
| Enter | `PROGRAM` → `QX\x06`                                           | same DNA                                  | Ident string (no QX)    |
| R/W   | ASCII `'R'` / `'W'`                                            | binary `0x52` / `0x57` (same byte values) | binary `0x52` / `0x57`  |
| Addr  | **u32 BE**                                                     | u16 BE                                    | u16 BE                  |
| Block | Read negotiates up to **`0xf0`** (240); write stays **`0x10`** | 16                                        | `0x40`                  |
| Image | **Sparse multi‑MB regions**                                    | Contiguous ≈ `0x32A0`                     | Contiguous `0x8240`     |
| Extra | Studio skips `0x2fa0010` (anytone-cps lore); no echo-strip     | Echo-strip                                | XOR crypt               |

Kit codec for Anytone DMR R/W is shipped in `src/integrations/radio-io/kit/codecs/anytoneDmrRw.ts` ([#646](https://github.com/pskillen/codeplug-studio/issues/646)) — do not reuse RT95 `programQx.ts` (#641) framing (u16 + echo-strip) for this radio.

## Identity

| Item          | Value                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baud          | **921600** (anytone-cps `SerialDevice` default)                                                                                                                                             |
| Enter         | ASCII `PROGRAM`                                                                                                                                                                             |
| Enter reply   | ASCII `QX` + `0x06`. A lone `0x00` fails this session (the shared kit still accepts it for a future family caller)                                                                          |
| Version probe | `0x02` after enter                                                                                                                                                                          |
| Exit          | ASCII `END`. It **reboots the radio** (USB re-enumerates after 20 s or more). Not sent when LocalInfo stun/kill flags are set, see [vital-data backup](backup-restore.md#vital-data-backup) |
| Read block    | Negotiated on Connect up to **`0xf0`** (240); falls back to **`0x10`** ([#793](https://github.com/pskillen/codeplug-studio/issues/793))                                                     |
| Write block   | **`0x10`** (16) — do not widen; oversized write frames desync the radio ([#793](https://github.com/pskillen/codeplug-studio/issues/793))                                                    |
| Alignment     | Host read/write spans must be a multiple of **16**                                                                                                                                          |
| Read opcode   | ASCII `'R'` (`0x52`)                                                                                                                                                                        |
| Write opcode  | ASCII `'W'` (`0x57`)                                                                                                                                                                        |
| Write ACK     | Trailing `0x06` on command; radio replies with `0x06`                                                                                                                                       |
| Safe-skip     | Studio skips **`0x2fa0010`** (anytone-cps lore; the official CPS encoder we read does not)                                                                                                  |

## Model allow-list (ident response)

After `PROGRAM` → `QX\x06`, the host sends `0x02` and reads **16 bytes** with `readExact(16)`. The read does not scan for `0x06`. An interior `0x06` is payload.

Captured `IDENT_REPLY` ([wire-capture-2026-08-11-write-keps.md](wire-capture-2026-08-11-write-keps.md)):

`49 44 38 39 30 55 56 00 03 56 31 30 30 00 00 06` = `ID890UV \x00 \x03 V100 \x00 \x00 \x06`

| Offset | Bytes | Meaning                                                                                                                                                                          |
| ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–6    | 7     | ASCII `ID890UV`                                                                                                                                                                  |
| 7      | 1     | `0x00`                                                                                                                                                                           |
| 8      | 1     | Band code. Captured value `0x03`. A value of `0x06` (UHF 446–447, per [#1301](https://github.com/pskillen/codeplug-studio/issues/1301)) is a real code, not the end of the reply |
| 9–12   | 4     | ASCII `V100`                                                                                                                                                                     |
| 13–14  | 2     | May be `0x06`. Captured `0x00 0x00`. Not a terminator                                                                                                                            |
| 15     | 1     | Trailing `0x06`                                                                                                                                                                  |

Probe requires model `ID890UV` and version `V100` before any read or write. Anything else throws `RadioWrongIdentError`. Byte 8 is kept on the ident result and is not used to accept or refuse the radio. Reject other Anytone DMR idents (`ID878UV2` / `V101`, …) unless a separate radio home is opened ([#648](https://github.com/pskillen/codeplug-studio/issues/648)).

Byte 8 is the band code. A hard refusal of unknown band codes waits until the CPS band table is written into this doc. The firmware sites that hold that table (`0x5c3e90`, `0x5fd870`, `0x5c4c20`, `0x7411a0`) are not transcribed in this repo. A wrong table would refuse healthy radios.

qdmr’s Anytone interface expects an `'I'`-prefixed structured reply for some models — treat qdmr as handshake DNA cross-check only; prefer the captured 16-byte layout above for D890.

## Handshake

1. Open serial at **921600**.
2. Send ASCII `PROGRAM` → expect `QX` + `0x06`. A lone `0x00` fails the D890 session and ident is not probed. The shared kit default still accepts a lone `0x00` for a future family caller.
3. Send `0x02` → read 16 bytes; require `ID890UV` + `V100` before Write.
4. **Negotiate read block size** — probe candidates up to `0xf0` at LocalInfo against a 16-byte baseline; cache the largest size that returns matching bytes ([#793](https://github.com/pskillen/codeplug-studio/issues/793)). Fall back to `0x10` on any failure. Negotiated reads up to `0xf0` are a Studio extension ([#793](https://github.com/pskillen/codeplug-studio/issues/793)). The official CPS keps session sent no `R` frames ([wire-capture-2026-08-11-write-keps.md](wire-capture-2026-08-11-write-keps.md)). The `0xf0` path stays as it is.
5. Proceed to sparse region R/W ([memory-layout.md](memory-layout.md)).
6. Send ASCII `END` to exit **only after a successful upload** — failed or aborted uploads must **not** send `END` (see [Write staging and session exit](#write-staging-and-session-exit)).

Unlike RT95, anytone-cps does **not** implement echo-strip for this path — TX/RX are treated as a normal full-duplex USB serial bridge.

## Frames

### Read

| Field   | Encoding                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request | `'R'` + address (u32 BE) + length (1 byte, `0x10`…`0xf0`) — 6 bytes                                                                                              |
| Reply   | Starts with `'W'`; echoed address is u32 BE at bytes 1–4; payload at bytes `[6..6+length-1]`; checksum before trailer `0x06`; total frame **`length + 8`** bytes |

Checksum (anytone-cps): 8-bit sum of reply bytes `[1 .. size-3]` (i.e. excluding first opcode and last two checksum/trailer bytes); compared to the checksum byte immediately before `0x06`.

The echoed address must match the request or the transfer fails. A wrong address is not retried. A timeout or a bad checksum resends that same frame twice (three transmissions), then surfaces the error. A timeout flushes the pipe first so a partial reply is not concatenated with the next frame. A checksum failure does not flush — that frame was already consumed.

Studio chunks reads at the negotiated block size (16-byte aligned spans). If a large frame still fails after that resend budget, the adapter retries that chunk at `0x10` before surfacing an error. That size fallback is separate from the two resends.

### Write

| Field   | Encoding                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Request | `'W'` + address (u32 BE) + length (`0x10`) + 16 data bytes + checksum + trailing `0x06`                                 |
| Reply   | Prefer 1 byte `0x06` ACK. A timeout resends that same frame twice, flushing first. Any other ack byte fails immediately |

Checksum (anytone-cps): 8-bit sum over command bytes after the opcode (`cmd[1:]` before checksum/trailer).

**Safe-skip:** the `0x2fa0010` skip is anytone-cps lore. The official CPS encoder we read does not skip that address. Studio still skips it as a family precaution (D878 LocalInfo neighbourhood). D890 `LocalInfo+0x10` (`0x4f80010`) is excluded because LocalInfo is not on the upload allow-list.

**ChannelData geometry:** the allow-list covers only the low half of each `0x80000` block. Studio refuses upper-half addresses at `assertAtD890WritableAddress` ([#791](https://github.com/pskillen/codeplug-studio/issues/791)). That refusal is the write fence. The upper half is an alternate unit; the PC-link address map is not settled. See [memory-layout.md — Alternate half](memory-layout.md#alternate-half-of-a-0x40000-unit).

## Write staging and session exit

`W` frames program flash according to the radio's sector state. There is **no** separate commit, erase, or bank-swap command on the wire — confirmed from a full official-CPS capture (19,960 frames, zero unknown). ASCII **`END`** exits PROGRAM and receives a bare `0x06`; it is **not** a commit opcode. See [flash-sectors.md](flash-sectors.md).

**In-session reads return flash**, not a host-visible write shadow — a read issued in the same PROGRAM session after write frames still returns pre-write bytes. **Read-back verification during upload is invalid by construction** ([#769](https://github.com/pskillen/codeplug-studio/issues/769)).

**Cross-session write verify (shipped, optional):** implemented via generic `RadioDescriptor.writeVerify` hooks ([#838](https://github.com/pskillen/codeplug-studio/issues/838)); AT-D890 behaviour unchanged from the [#837](https://github.com/pskillen/codeplug-studio/issues/837) reference. After a successful Write and `END`, the radio restarts on its own. On the build **Direct radio** panel, Studio prompts you to wait until the radio shows its normal screen, then click **Verify write** (the button enables after a brief debounce). Verify reads all modelled memory regions documented in [memory-layout.md](memory-layout.md) (~512 kB — same scope as Debug → Raw memory-region export; digital contacts and analog address book excluded), **plus** any 16-byte blocks staged from touched erase units that lie outside those banks (RMW-preserved spill). Compare is against **every comparable 16-byte staging chunk actually transmitted** during upload (addresses skipped at transmit, e.g. `0x2fa0010`, are omitted from the staging snapshot). Erase-unit bookkeeping blocks at **+0x3fbf0** and **+0x3fff0** are **never transmitted** ([flash-sectors.md](flash-sectors.md)); verify also excludes them when they lie outside declared modelled region spans. Unread addresses are reported as **not read** — verify never fabricates `0xff` readback. The six never-write sentinel spans are also diffed against the pre-Write snapshot. Results appear in a dedicated report modal with grouped regions, mismatch addresses, **Copy debug info**, and **Download markdown** ([#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b; full-memory compare experiment). Extension pattern: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

**Failed or aborted uploads** must call `abandonProgramMode()` before `disconnect()` so Studio does **not** send `END` after a partial write. Omitting `END` is the safe failure path.

**Hydration on Write:** Write overlays modelled bytes onto this PROGRAM session’s download cache. LocalInfo **identity check** (serial match) uses the live radio, not a persisted bag. Upload fresh-reads each touched erase unit from the radio immediately before staging.

## Typical session flow

1. Open serial @ 921600 → `PROGRAM` → `QX\x06` → `0x02` ident → negotiate read block size at LocalInfo.
2. Read **sparse** regions needed for the adapter (not a contiguous dump) — start with LocalInfo, ChannelSet/ChannelData, Zone*, RadioId*, ScanList*, Talkgroup*/ReceiveGroup*, MasterIdData ([memory-layout.md](memory-layout.md)).
3. For upload: re-enter program mode → pre-Write sentinel plausibility → **sparse erase-unit RMW** (fresh-read touched units, identity check, overlay modelled chunks, stage non-`0xff` blocks) → skip `0x2fa0010` → `END` on successful disconnect only ([#768](https://github.com/pskillen/codeplug-studio/issues/768)). Optional: after the radio restarts, **Check preserved settings** in the build UI ([#769](https://github.com/pskillen/codeplug-studio/issues/769) 5b).
4. For **Restore** (not Write): `restoreFromBackup` overlays zip restorable regions onto a fresh live erase-unit read — never LocalInfo / alarm-from-archive / `0x2fa0010`. See [backup-restore.md](backup-restore.md). Hardware verify pending.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md)
- Planned kit: `kit/codecs/anytoneDmrRw.ts` ([#646](https://github.com/pskillen/codeplug-studio/issues/646) — shipped) · adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) (planned)
- Family sibling docs: D878UVII [#648](https://github.com/pskillen/codeplug-studio/issues/648)
