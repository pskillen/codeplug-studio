# AT-D890UV — Anytone DMR protocol

Handshake and framing for Anytone AT-D890UV over Web Serial. Distinct from Anytone CPS CSV file interchange, from RT95 PROGRAM→QX (u16 / 9600), and from UV-5R Mini PROGRAM+R/W.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps `SerialDevice`; qdmr `anytone_interface` for handshake cross-check — facts only; do not paste GPL sources.

## Not RT95 u16 or Mini PROGRAM+R/W

|           | D890 Anytone DMR (this doc)                         | RT95 (#642)                                         | Mini PROGRAM+R/W (#616)              |
| --------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Baud      | **921600**                                          | 9600                                                | ~38400 / 115200                      |
| Enter     | `PROGRAM` → `QX\x06`                                | same DNA                                            | Ident string (no QX)                 |
| R/W       | ASCII `'R'` / `'W'`                                 | binary `0x52` / `0x57` (same byte values)           | binary `0x52` / `0x57`               |
| Addr      | **u32 BE**                                          | u16 BE                                              | u16 BE                               |
| Block     | 16                                                  | 16                                                  | `0x40`                               |
| Image     | **Sparse multi‑MB regions**                         | Contiguous ≈ `0x32A0`                               | Contiguous `0x8240`                  |
| Extra     | Skip write `0x2fa0010`; no echo-strip in anytone-cps | Echo-strip                                          | XOR crypt                            |

Kit codec for Anytone DMR R/W is sibling [#646](https://github.com/pskillen/codeplug-studio/issues/646) — **out of scope** here; docs may cross-link. Do not reuse RT95 `programQx.ts` (#641) framing (u16 + echo-strip) for this radio.

## Identity

| Item          | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Baud          | **921600** (anytone-cps `SerialDevice` default)                |
| Enter         | ASCII `PROGRAM`                                                |
| Enter reply   | ASCII `QX` + `0x06` (anytone-cps also tolerates a lone `0x00`) |
| Version probe | `0x02` after enter                                             |
| Exit          | ASCII `END`                                                    |
| Block size    | `0x10` (16) — length must be a multiple of 16                  |
| Read opcode   | ASCII `'R'` (`0x52`)                                           |
| Write opcode  | ASCII `'W'` (`0x57`)                                           |
| Write ACK     | Trailing `0x06` on command; radio replies with `0x06`          |
| Safe-skip     | Do **not** write address **`0x2fa0010`** (anytone-cps hard skip) |

## Model allow-list (ident response)

After `PROGRAM` → `QX\x06`, host sends `0x02`. anytone-cps parses:

| Field   | Bytes (approx) | D890 expected   |
| ------- | -------------- | --------------- |
| Model   | `resp[0..7]`   | **`ID890UV`**   |
| Version | `resp[9..12]`  | **`V100`**      |

NUL bytes are stripped. Reject other Anytone DMR idents (`ID878UV2` / `V101`, …) unless a separate radio home is opened ([#648](https://github.com/pskillen/codeplug-studio/issues/648)).

qdmr’s Anytone interface expects an `'I'`-prefixed structured reply for some models — treat qdmr as handshake DNA cross-check only; prefer anytone-cps byte offsets for D890.

## Handshake

1. Open serial at **921600**.
2. Send ASCII `PROGRAM` → expect `QX` + `0x06`.
3. Send `0x02` → parse model / version; require `ID890UV` + `V100`.
4. Proceed to sparse region R/W ([memory-layout.md](memory-layout.md)).
5. Send ASCII `END` to exit (best-effort on error paths).

Unlike RT95, anytone-cps does **not** implement echo-strip for this path — TX/RX are treated as a normal full-duplex USB serial bridge.

## Frames

### Read

| Field   | Encoding                                                                 |
| ------- | ------------------------------------------------------------------------ |
| Request | `'R'` + address (u32 BE) + length (1 byte, typically `0x10`) — 6 bytes   |
| Reply   | Starts with `'W'`; payload at bytes `[6..21]` (16 data); checksum @ 22; trailer `0x06` @ 23 — **24 bytes** when length is 16 |

Checksum (anytone-cps): 8-bit sum of reply bytes `[1 .. size-3]` (i.e. excluding first opcode and last two checksum/trailer bytes); compared to byte at index 22.

Host may request multiple 16-byte chunks by advancing the address; total `length` must stay 16-aligned.

### Write

| Field   | Encoding                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------- |
| Request | `'W'` + address (u32 BE) + length (`0x10`) + 16 data bytes + checksum + trailing `0x06`           |
| Reply   | Prefer 1 byte `0x06` ACK                                                                          |

Checksum (anytone-cps): 8-bit sum over command bytes after the opcode (`cmd[1:]` before checksum/trailer).

**Safe-skip:** if `address == 0x2fa0010`, anytone-cps returns without writing. Studio adapters should honour the same skip (D878 LocalInfo neighbourhood; keep for family safety even when targeting D890).

## Typical session flow

1. Open serial @ 921600 → `PROGRAM` → `QX\x06` → `0x02` ident.
2. Read **sparse** regions needed for the adapter (not a contiguous dump) — start with LocalInfo, ChannelSet/ChannelData, Zone*, RadioId*, ScanList*, Talkgroup*/ReceiveGroup*, MasterIdData ([memory-layout.md](memory-layout.md)).
3. For upload: re-enter program mode → ident check → write occupied regions in 16-byte blocks → skip `0x2fa0010` → `END`.
4. Prefer RMW for settings-heavy regions once optional-settings mapping lands (deferred beyond v1 adapter).

## Related

- [memory-layout.md](memory-layout.md)
- Planned kit: [#646](https://github.com/pskillen/codeplug-studio/issues/646) · adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649)
- Family sibling docs: D878UVII [#648](https://github.com/pskillen/codeplug-studio/issues/648)
