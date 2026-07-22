# RT95 VOX — PROGRAM→QX protocol

Handshake and framing for Retevis RT95 VOX (AnyTone 778UV family) over Web Serial. Distinct from CHIRP CSV file interchange and from UV-5R Mini **PROGRAM+R/W**.

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `anytone778uv.py` (`AnyTone778UVBase` / `RetevisRT95vox`) — facts only; do not paste GPL sources.

## Not UV-5R Mini PROGRAM+R/W

|                    | RT95 PROGRAM→QX (this doc)              | Mini PROGRAM+R/W ([#616](https://github.com/pskillen/codeplug-studio/issues/616)) |
| ------------------ | --------------------------------------- | --------------------------------------------------------------------------------- |
| Enter              | ASCII `PROGRAM` → `QX` + `0x06`         | Ident string e.g. `PROGRAMCOLORPROU`                                              |
| Baud               | **9600**                                | ~38400 / 115200                                                                   |
| Block              | **`0x10`** (16 bytes)                   | `0x40` (64 bytes)                                                                 |
| Address            | u16 BE                                  | u16 BE                                                                            |
| Write              | 8-bit checksum + trailing `0x06`; NACK `0x0a` | XOR crypt path                                                              |
| Transport          | **Echo-strip** required (shared TX/RX)  | Not this kit                                                                      |
| Image              | Contiguous ≈ `0x0000`–`0x3290` (`0x32A0` bytes) | Multi-region packed `0x8240`                                                |

Kit codec for this family is sibling [#641](https://github.com/pskillen/codeplug-studio/issues/641) (`programQx.ts`) — **out of scope** here; docs may cross-link.

## Identity

| Item             | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| Baud             | **9600**                                                       |
| Enter            | ASCII `PROGRAM`                                                |
| Enter reply      | ASCII `QX` + `0x06`                                            |
| Version probe    | `0x02` after enter                                             |
| Exit             | ASCII `END`                                                    |
| Block size       | `0x10` (16)                                                    |
| Read opcode      | `0x52` (`R`)                                                   |
| Write opcode     | `0x57` (`W`)                                                   |
| Write ACK        | Trailing `0x06` on command; radio replies with `0x06` (1 byte) |
| Write NACK       | `0x0a`                                                         |
| Image span       | `MEMORY_ADDRESS_RANGE = (0x0000, 0x3290)` → assembled `0x32A0` |

## Model allow-list (version response)

After `PROGRAM` → `QX\x06`, host sends `0x02`. Radio replies with a version blob (CHIRP `VER_FORMAT`):

| Field      | Notes                                      |
| ---------- | ------------------------------------------ |
| Header     | `0x49`                                     |
| Model      | 7-char ASCII (NUL-padded / trimmed)        |
| Bandlimit  | 1 byte — band table index (see [settings.md](settings.md)) |
| Version    | 6-char ASCII                               |
| Trailer    | ACK `0x06`                                 |

Studio’s RT95 **VOX** target matches CHIRP `RetevisRT95vox`:

| Class              | Wire model | Wire version | Name length | VOX  |
| ------------------ | ---------- | ------------ | ----------- | ---- |
| `RetevisRT95vox`   | **`RT95-P`** | **`V100`** | **6**       | Yes  |
| `RetevisRT95`      | `RT95`     | `V100`       | 5           | No   |

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

| Field   | Encoding                                                                 |
| ------- | ------------------------------------------------------------------------ |
| Request | `0x52` + address (u16 BE) + length (`0x10`) — 4 bytes (`>BHB`)           |
| Reply   | 4-byte header + 16-byte payload + 8-bit checksum + trailer (22 bytes = `0x16`) |

Checksum (CHIRP): 8-bit sum over reply bytes `[1:-2]`; compared to byte `[-2]`.

Address steps: `0x0000` … `0x3290` inclusive, step `0x10`.

### Write

| Field   | Encoding                                                                              |
| ------- | ------------------------------------------------------------------------------------- |
| Request | `0x57` + address (u16 BE) + length (`0x10`) + 16 data bytes + checksum + trailing `0x06` |
| Reply   | 1 byte: `0x06` ACK, or `0x0a` NACK                                                    |

Checksum (CHIRP): 8-bit sum over command bytes after the opcode (`cmd[1:]` before checksum/trailer).

Upload path also issues a priming read at radio address **`0x3b10`** (outside the clone image span) before writing the contiguous map — reply shape matches a normal read frame; purpose undocumented beyond “initial response”.

## Typical session flow

1. Open serial @ 9600 → echo-aware transport.
2. `PROGRAM` → `QX\x06` → `0x02` version / allow-list.
3. Read all blocks `0x0000`…`0x3290` step `0x10` → assemble contiguous `0x32A0` image ([memory-layout.md](memory-layout.md)).
4. For upload: re-enter program mode → version check (warn if image vs radio bandlimit differ) → priming read `0x3b10` → write each `0x10` block → `END`.
5. Prefer RMW for settings / bandlimit — see [settings.md](settings.md).

## Related

- [fixtures.md](fixtures.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- Planned kit: [#641](https://github.com/pskillen/codeplug-studio/issues/641) · adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643)
