# DM-32UV — binary protocol

Handshake, V-frame probes, PROGRAM entry, and **4KB block R/W** for Baofeng DM-32UV / DP570UV over Web Serial. Distinct from DM32 CPS CSV / `.neonplug` file interchange and from the kit’s PROGRAM+R/W `BlockCodec` (UV-5R Mini).

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `connection.ts`, `constants.ts`, `protocol.ts` (facts only — do not paste wholesale).

## Identity

| Item           | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Baud           | **115200** (`CONNECTION.BAUD_RATE`)                                                                                |
| Model strings  | PSEARCH payload contains `DP570`, `DM32`, or `DM-32`                                                               |
| Handshake ACK  | `0x06`                                                                                                             |
| V-frame opcode | `0x56` (`V`) — Studio kit: `kit/codecs/vProbe.ts` ([#630](https://github.com/pskillen/codeplug-studio/issues/630)) |
| Read opcode    | `0x52` (`R`) — **24-bit LE address**, length u16 LE                                                                |
| Write opcode   | `0x57` (`W`) — **4KB blocks** with metadata at data `[0xFFF]`                                                      |
| Block quantum  | **4096** bytes                                                                                                     |

> **Not kit PROGRAM+R/W.** UV-5R Mini uses 16-bit BE addr + 64-byte XOR-crypted blocks after an ASCII ident. DM-32 uses ASCII `PSEARCH`/`PASSSTA`/`SYSINFO`, then V-frames, then PROGRAM mode, then R/W with **24-bit LE** addressing and **4KB** payloads. Do not reuse `BlockCodec` for DM-32 block I/O.

## Timeouts and delays (NeonPlug)

| Constant                   | ms    | Role                           |
| -------------------------- | ----- | ------------------------------ |
| `INIT_DELAY`               | 400   | After port open                |
| `CLEAR_BUFFER_DELAY`       | 200   | After flush / before PSEARCH   |
| `PSEARCH_READ_DELAY`       | 150   | After sending `PSEARCH`        |
| `REOPEN_DELAY`             | 400   | Close → reopen settling        |
| `BLOCK_READ_DELAY`         | 150   | Between full 4KB block reads   |
| `TIMEOUT.REQUEST_RESPONSE` | 5000  | Default request/response cycle |
| `TIMEOUT.HANDSHAKE`        | 5000  | Handshake commands             |
| `TIMEOUT.READ_MEMORY`      | 15000 | Large (4KB) read payload       |
| `TIMEOUT.WRITE_MEMORY`     | 5000  | Write ACK                      |
| `TIMEOUT.VFRAME_QUERY`     | 5000  | Per V-frame                    |
| `TIMEOUT.PORT_OPEN`        | 5000  | Port open                      |

## Handshake (ASCII)

1. Open serial at **115200**.
2. Wait `INIT_DELAY`, flush buffer (`CLEAR_BUFFER_DELAY`).
3. Send ASCII `PSEARCH` → expect **8 bytes**: first `0x06`, remainder ASCII model string (must include `DP570` / `DM32` / `DM-32`).
4. Send ASCII `PASSSTA` → expect **3 bytes** starting with `0x50`.
5. Send ASCII `SYSINFO` → expect **1 byte** `0x06`.

## V-frame probe

After handshake, NeonPlug queries V-frames with:

- Request: `0x56 0x00 0x00 0x00 <frameId>`
- Reply header: `0x56 <frameId> <length>` then `<length>` data bytes

Typical IDs used at connect (NeonPlug loops a fixed list including these):

| ID     | Role (NeonPlug `VFRAME`)             |
| ------ | ------------------------------------ |
| `0x01` | Firmware string                      |
| `0x03` | Build date                           |
| `0x04` | DSP version                          |
| `0x05` | Radio version                        |
| `0x0A` | **Memory layout** (config start/end) |
| `0x0B` | Codeplug version                     |
| `0x0E` | Memberships range (noted)            |
| `0x0F` | **Contacts** memory range / capacity |

**Config range (`0x0A`):** 8 bytes = `start_addr` (u32 LE) + `end_addr` (u32 LE). Feeds discovery — see [memory-layout.md](memory-layout.md).

Studio’s shipped V-probe codec frames the same `0x56` request/reply shape; DM-32 session sequencing and PROGRAM/R/W stay in the radio module.

## PROGRAM mode entry

After V-frames:

1. Send `FF FF FF FF 0C` + ASCII `PROGRAM` → ACK `0x06`.
2. Send `0x02` → expect **8 bytes** all `0xFF`.
3. Send `0x06` → ACK `0x06`.

Radio is then ready for memory R/W.

## Memory frames

### Read

| Field   | Encoding                                         |
| ------- | ------------------------------------------------ |
| Request | `0x52` + addr (3 bytes LE) + length (2 bytes LE) |
| Reply   | `0x57` + addr (3 LE) + length (2 LE) + data      |

NeonPlug discovery reads **1 byte** at `blockAddr + 0xFFF` for metadata; bulk paths request full **4096** bytes.

**Host note (Web Serial):** open the port with a large `bufferSize` (Studio uses 64 KiB). The Web Serial default is **255** bytes — too small for a 4KB reply on macOS CDC and can stall the host / reboot the radio ([#663](https://github.com/pskillen/codeplug-studio/issues/663)).

### Write (codeplug 4KB block)

| Field   | Encoding                                                                  |
| ------- | ------------------------------------------------------------------------- |
| Request | `0x57` + addr (3 LE) + `0x00` + `0x10` + **4096** data bytes (total 4102) |
| Reply   | ACK `0x06`                                                                |

Metadata lives **inside** the data block at offset `0xFFF` (not a trailing extra byte outside the 4KB). Address must be **4KB-aligned**.

Observed non-ACK codes (NeonPlug comments): `0xC0`, `0xC8`, `0x48` — treat as write rejection / busy / format errors; verify on hardware in adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638).

## Typical session flow

1. Open serial @ 115200 → ASCII handshake.
2. Query V-frames (at least `0x0A` for range; `0x0F` for contacts capacity/range).
3. Enter PROGRAM mode.
4. Discover blocks by reading metadata at each `addr + 0xFFF` in the config range.
5. Bulk-read required 4KB blocks ([memory-layout.md](memory-layout.md)).
6. Parse offline; write path reuses cached blocks for RMW.

## Boot-image side note

NeonPlug also has a **boot-image** path (`enterBootImageReadMode`, `writeMemoryBlock`) with different entry bytes (`0x47 …`) and writes of 2048/4096 without the codeplug metadata byte. **Out of scope** for codeplug adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638) — document only so agents do not confuse it with codeplug R/W.

## Related

- [memory-layout.md](memory-layout.md) · [fixtures.md](fixtures.md) · [channel-record.md](channel-record.md)
- V-probe kit: [protocol-kit-architecture.md](../../../../features/radio-read-write/protocol-kit-architecture.md)
- Adapter: [#638](https://github.com/pskillen/codeplug-studio/issues/638)
