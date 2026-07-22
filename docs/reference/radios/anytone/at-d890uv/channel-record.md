# AT-D890UV — channel record

Combined **`0x80`-byte** channel element for Anytone AT-D890UV (`encode_D890UV` / `decode_D890UV`). Stored as two **`0x40`** halves at radio addresses derived from `D890_MAP`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps channel encode/decode + `Device::readChannelData` / `writeChannelData` — facts only; do not paste GPL sources.

## Geometry

| Fact              | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| Combined size     | `0x80` (128) bytes                                                    |
| Primary half      | `0x40` at `primaryAddr`                                               |
| Secondary half    | `0x40` at `primaryAddr + 0x40`                                        |
| Max slots         | 4000 (ChannelSet `0x200` bytes)                                       |
| Occupancy         | Bit in ChannelSet @ `0x3482a00` — not empty FF fill alone              |
| Name storage      | `0x20` bytes at offset `0x44` (D890 wide-char / UTF-16 style packing) |
| Name display cap  | 16 chars (CSV / [limits.md](limits.md))                               |

## Address formula

0-based index `idx`:

```text
blockIndex    = idx / 128
indexInBlock  = idx % 128
primaryAddr   = 0x1000000 + (blockIndex * 0x80000) + (indexInBlock * 0x80)
secondaryAddr = primaryAddr + 0x40
```

Assemble decode buffer as `primary ‖ secondary`. Split encode the same way before write. See [memory-layout.md](memory-layout.md).

## ChannelSet bitmap

| Item       | Value                                      |
| ---------- | ------------------------------------------ |
| Base       | `0x3482a00`                                |
| Size       | `0x200` bytes                              |
| Sense      | Bit **set** → channel present              |
| Indexing   | Slot `n` → byte `n // 8`, bit `n % 8`      |

Empty slots (RX frequency 0 / unset) should clear the bit and skip body writes.

## Field offsets (combined `0x80`)

Offsets are into the concatenated buffer. Exact bit packing follows anytone-cps little-endian bit helpers — implement from the struct map at adapter time.

| Offset / bits | Field                         | Encoding / notes                                      |
| ------------- | ----------------------------- | ----------------------------------------------------- |
| `0x00–0x03`   | RX frequency                  | Packed BCD-as-hex digits → integer Hz×10 style decode |
| `0x04–0x07`   | Offset                        | Same packing as RX                                    |
| `0x08` bits   | duplex:2, bandwidth:2, power:2, type:2 | High nibble duplex/bw; low nibble power/type |
| `0x09` bits   | talkaround, call confirm, PTT prohibit, reverse; CTCSS/DCS encode/decode selects | |
| `0x0a`        | CTCSS encode tone index       |                                                       |
| `0x0b`        | CTCSS decode tone index       |                                                       |
| `0x0c–0x0d`   | DCS encode                    | u16                                                   |
| `0x0e–0x0f`   | DCS decode                    | u16                                                   |
| `0x10–0x11`   | Custom CTCSS                  | u16                                                   |
| `0x12`        | Tone2 decode                  |                                                       |
| `0x13–0x14`   | Contact index                 | u16 **BE**                                            |
| `0x18`        | Radio ID index                |                                                       |
| `0x19` bits   | Squelch mode / PTT-ID         |                                                       |
| `0x1a` bits   | Optional signal / busy lock   |                                                       |
| `0x1b`        | Scan list index               |                                                       |
| `0x1c`        | Receive group list index      |                                                       |
| `0x1d`        | Tone2 ID index                |                                                       |
| `0x1e`        | Tone5 ID index                |                                                       |
| `0x1f`        | DTMF ID index                 |                                                       |
| `0x20`        | RX colour code index          |                                                       |
| `0x21` bits   | Work alone, APRS RX, slot suit, DMR mode, time slot, SMS confirm | |
| `0x22`        | AES encryption index          |                                                       |
| `0x34` bits   | DMR CRC ignore, auto scan, data ACK disable, exclude roaming, DMR mode, ranging | |
| `0x35–0x3d`   | APRS / encryption indices     | Report type, PTT modes, channels, ARC4 idx, …         |
| `0x3e–0x3f`   | Scrambler set / custom        | D890-specific vs D878 name placement                  |
| `0x40`        | R5Tone BOT                    | Secondary half starts here on wire                    |
| `0x41`        | R5Tone EOT                    |                                                       |
| `0x43`        | TX colour code index          |                                                       |
| `0x44–0x63`   | Name                          | `0x20` bytes; wide-char pack on D890 encode           |

Gaps / unknown bytes: preserve on RMW.

## Power (`tx_power` in byte `0x08`)

Wire enum (2 bits) maps to CPS labels; Studio `%` ladder for **file** adapters is in [power.md](power.md). Binary adapter should map the same four steps (Low / Mid / High / Turbo) at the edge — do not invent a fifth level.

## Empty channel

`rx_frequency == 0` → treat as vacant (anytone-cps decode returns early). Clear ChannelSet bit; prefer not writing body, or write zeros consistently with the adapter policy.

## Related

- [memory-layout.md](memory-layout.md) · [zone-record.md](zone-record.md) · [protocol.md](protocol.md)
- CSV naming / columns only: [export-formats/anytone](../../../export-formats/anytone/README.md)
