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
| Extra | Skip write `0x2fa0010`; no echo-strip in anytone-cps           | Echo-strip                                | XOR crypt               |

Kit codec for Anytone DMR R/W is shipped in `src/integrations/radio-io/kit/codecs/anytoneDmrRw.ts` ([#646](https://github.com/pskillen/codeplug-studio/issues/646)) — do not reuse RT95 `programQx.ts` (#641) framing (u16 + echo-strip) for this radio.

## Identity

| Item          | Value                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Baud          | **921600** (anytone-cps `SerialDevice` default)                                                                                          |
| Enter         | ASCII `PROGRAM`                                                                                                                          |
| Enter reply   | ASCII `QX` + `0x06` (anytone-cps also tolerates a lone `0x00`)                                                                           |
| Version probe | `0x02` after enter                                                                                                                       |
| Exit          | ASCII `END`                                                                                                                              |
| Read block    | Negotiated on Connect up to **`0xf0`** (240); falls back to **`0x10`** ([#793](https://github.com/pskillen/codeplug-studio/issues/793))  |
| Write block   | **`0x10`** (16) — do not widen; oversized write frames desync the radio ([#793](https://github.com/pskillen/codeplug-studio/issues/793)) |
| Alignment     | Host read/write spans must be a multiple of **16**                                                                                       |
| Read opcode   | ASCII `'R'` (`0x52`)                                                                                                                     |
| Write opcode  | ASCII `'W'` (`0x57`)                                                                                                                     |
| Write ACK     | Trailing `0x06` on command; radio replies with `0x06`                                                                                    |
| Safe-skip     | Do **not** write address **`0x2fa0010`** (anytone-cps hard skip)                                                                         |

## Model allow-list (ident response)

After `PROGRAM` → `QX\x06`, host sends `0x02`. anytone-cps parses:

| Field   | Bytes (approx) | D890 expected |
| ------- | -------------- | ------------- |
| Model   | `resp[0..7]`   | **`ID890UV`** |
| Version | `resp[9..12]`  | **`V100`**    |

NUL bytes are stripped. Reject other Anytone DMR idents (`ID878UV2` / `V101`, …) unless a separate radio home is opened ([#648](https://github.com/pskillen/codeplug-studio/issues/648)).

qdmr’s Anytone interface expects an `'I'`-prefixed structured reply for some models — treat qdmr as handshake DNA cross-check only; prefer anytone-cps byte offsets for D890.

## Handshake

1. Open serial at **921600**.
2. Send ASCII `PROGRAM` → expect `QX` + `0x06`.
3. Send `0x02` → parse model / version; require `ID890UV` + `V100`.
4. **Negotiate read block size** — probe candidates up to `0xf0` at LocalInfo against a 16-byte baseline; cache the largest size that returns matching bytes ([#793](https://github.com/pskillen/codeplug-studio/issues/793)). Fall back to `0x10` on any failure.
5. Proceed to sparse region R/W ([memory-layout.md](memory-layout.md)).
6. Send ASCII `END` to exit **only after a successful upload** — failed or aborted uploads must **not** send `END` (see [Write staging and session exit](#write-staging-and-session-exit)).

Unlike RT95, anytone-cps does **not** implement echo-strip for this path — TX/RX are treated as a normal full-duplex USB serial bridge.

## Frames

### Read

| Field   | Encoding                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Request | `'R'` + address (u32 BE) + length (1 byte, `0x10`…`0xf0`) — 6 bytes                                                       |
| Reply   | Starts with `'W'`; payload at bytes `[6..6+length-1]`; checksum before trailer `0x06`; total frame **`length + 8`** bytes |

Checksum (anytone-cps): 8-bit sum of reply bytes `[1 .. size-3]` (i.e. excluding first opcode and last two checksum/trailer bytes); compared to the checksum byte immediately before `0x06`.

Studio chunks reads at the negotiated block size (16-byte aligned spans). If a large frame fails mid-transfer, the adapter retries that chunk at `0x10` before surfacing an error.

### Write

| Field   | Encoding                                                                                |
| ------- | --------------------------------------------------------------------------------------- |
| Request | `'W'` + address (u32 BE) + length (`0x10`) + 16 data bytes + checksum + trailing `0x06` |
| Reply   | Prefer 1 byte `0x06` ACK                                                                |

Checksum (anytone-cps): 8-bit sum over command bytes after the opcode (`cmd[1:]` before checksum/trailer).

**Safe-skip:** if `address == 0x2fa0010`, anytone-cps returns without writing. Studio adapters should honour the same skip (D878 LocalInfo neighbourhood; keep for family safety even when targeting D890).

**ChannelData geometry:** the allow-list covers only backed low halves of each `0x80000` block; mirrored upper-half addresses are refused at `assertAtD890WritableAddress` ([#791](https://github.com/pskillen/codeplug-studio/issues/791)). See [memory-layout.md — Address aliasing](memory-layout.md#address-aliasing).

## Write staging and session exit

`W` frames program flash according to the radio's sector state. There is **no** separate commit, erase, or bank-swap command on the wire — confirmed from a full official-CPS capture (19,960 frames, zero unknown). ASCII **`END`** exits PROGRAM and receives a bare `0x06`; it is **not** a commit opcode. See [flash-sectors.md](flash-sectors.md).

**In-session reads return flash**, not a host-visible write shadow — a read issued in the same PROGRAM session after write frames still returns pre-write bytes when diversion or firmware buffering applies. **Read-back verification during upload is invalid by construction** ([#769](https://github.com/pskillen/codeplug-studio/issues/769)).

**Cross-session write verify (shipped, optional):** implemented via generic `RadioDescriptor.writeVerify` hooks ([#838](https://github.com/pskillen/codeplug-studio/issues/838)); AT-D890 behaviour unchanged from the [#837](https://github.com/pskillen/codeplug-studio/issues/837) reference. After a successful Write and `END`, the radio restarts on its own. On the build **Direct radio** panel, Studio prompts you to wait until the radio shows its normal screen, then click **Verify write** (the button enables after a brief debounce). Verify reads all modelled memory regions documented in [memory-layout.md](memory-layout.md) (~512 kB — same scope as Debug → Raw memory-region export; digital contacts and analog address book excluded), **plus** any 16-byte blocks staged from touched erase units that lie outside those banks (RMW-preserved spill). Compare is against **every comparable 16-byte staging chunk actually transmitted** during upload (addresses skipped at transmit, e.g. `0x2fa0010`, are omitted from the staging snapshot). Erase-unit bookkeeping blocks at **+0x3fbf0** and **+0x3fff0** are **never transmitted** ([flash-sectors.md](flash-sectors.md)); verify also excludes them when they lie outside declared modelled region spans. Unread addresses are reported as **not read** — verify never fabricates `0xff` readback. The six never-write sentinel spans are also diffed against the pre-Write snapshot. Results appear in a dedicated report modal with grouped regions, mismatch addresses, **Copy debug info**, and **Download markdown** ([#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b; full-memory compare experiment). Extension pattern: [write-verify.md](../../../../features/radio-read-write/write-verify.md).

**Failed or aborted uploads** must call `abandonProgramMode()` before `disconnect()` so Studio does **not** send `END` after a partial write. Omitting `END` is the safe failure path.

**Hydration on Write:** the hydration bag is required (`hydrationRequiredForWrite`) for LocalInfo **identity check** (serial match) and Radio image preview — it is **not** the data source for preserved bytes. Upload fresh-reads each touched erase unit from the radio immediately before staging.

## Typical session flow

1. Open serial @ 921600 → `PROGRAM` → `QX\x06` → `0x02` ident → negotiate read block size at LocalInfo.
2. Read **sparse** regions needed for the adapter (not a contiguous dump) — start with LocalInfo, ChannelSet/ChannelData, Zone*, RadioId*, ScanList*, Talkgroup*/ReceiveGroup*, MasterIdData ([memory-layout.md](memory-layout.md)).
3. For upload: re-enter program mode → pre-Write sentinel plausibility → **sparse erase-unit RMW** (fresh-read touched units, identity check, overlay modelled chunks, stage non-`0xff` blocks) → skip `0x2fa0010` → `END` on successful disconnect only ([#768](https://github.com/pskillen/codeplug-studio/issues/768)). Optional: after the radio restarts, **Check preserved settings** in the build UI ([#769](https://github.com/pskillen/codeplug-studio/issues/769) 5b).
4. For **Restore** (not Write): `restoreFromBackup` overlays zip restorable regions onto a fresh live erase-unit read — never LocalInfo / alarm-from-archive / `0x2fa0010`. See [backup-restore.md](backup-restore.md). Hardware verify pending.

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [channel-record.md](channel-record.md)
- Planned kit: `kit/codecs/anytoneDmrRw.ts` ([#646](https://github.com/pskillen/codeplug-studio/issues/646) — shipped) · adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) (planned)
- Family sibling docs: D878UVII [#648](https://github.com/pskillen/codeplug-studio/issues/648)
