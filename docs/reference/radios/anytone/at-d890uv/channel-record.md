# AT-D890UV — channel record

Combined **`0x80`-byte** channel element for Anytone AT-D890UV (`encode_D890UV` / `decode_D890UV`). Stored as two **`0x40`** halves at radio addresses derived from `D890_MAP`.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: anytone-cps channel encode/decode + `Device::readChannelData` / `writeChannelData` — facts only; do not paste GPL sources.

## Geometry

| Fact             | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Combined size    | `0x80` (128) bytes                                                    |
| Primary half     | `0x40` at `primaryAddr`                                               |
| Secondary half   | `0x40` at `primaryAddr + 0x40`                                        |
| Max slots        | 4000 (ChannelSet `0x200` bytes)                                       |
| Occupancy        | Bit in ChannelSet @ `0x3482a00` — not empty FF fill alone             |
| Name storage     | `0x20` bytes at offset `0x44` (D890 wide-char / UTF-16 style packing) |
| Name display cap | 16 chars (CSV / [limits.md](limits.md))                               |

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

| Item           | Value                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Base           | `0x3482a00`                                                                                                                      |
| Size           | `0x200` bytes                                                                                                                    |
| Sense          | Bit **set** → channel present                                                                                                    |
| Indexing       | Slot `n` → byte `n // 8`, bit `n % 8`                                                                                            |
| Modelled slots | `0 … 3999` (`MAX_CHANNELS`) — Studio Write clears and re-encodes these bits only                                                 |
| High bits      | Bits `4000+` in the `0x200`-byte bitmap are **preserved** on Write (VFO-ish / RE slots; bodies not modelled as library channels) |

Empty slots (RX frequency 0 / unset) should clear the bit and skip body writes.

## Field offsets (combined `0x80`)

Offsets are into the concatenated buffer. Exact bit packing follows anytone-cps little-endian bit helpers — implement from the struct map at adapter time.

| Offset / bits | Field                                                                                                                                                      | Encoding / notes                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00–0x03`   | RX frequency                                                                                                                                               | BCD-as-hex: hex digit string parsed as **decimal** in **10 Hz** units (`×10` → Hz). Encode: `padStart(8)` of `round(Hz/10)` → byte pairs. Studio library uses Hz.                               |
| `0x04–0x07`   | Offset                                                                                                                                                     | Same packing as RX                                                                                                                                                                              |
| `0x08` bits   | duplex:2, bandwidth:2, power:2, type:2                                                                                                                     | High nibble duplex/bw; low nibble power/type. **Bandwidth** (bits 4–5): `0` = 12.5 kHz (NFM), `1` = 25 kHz (FM).                                                                                |
| `0x09` bits   | talkaround, call confirm, PTT prohibit, reverse; CTCSS/DCS encode/decode selects                                                                           |                                                                                                                                                                                                 |
| `0x0a`        | CTCSS encode tone index                                                                                                                                    |                                                                                                                                                                                                 |
| `0x0b`        | CTCSS decode tone index                                                                                                                                    |                                                                                                                                                                                                 |
| `0x0c–0x0d`   | DCS encode                                                                                                                                                 | u16                                                                                                                                                                                             |
| `0x0e–0x0f`   | DCS decode                                                                                                                                                 | u16                                                                                                                                                                                             |
| `0x10–0x11`   | Custom CTCSS                                                                                                                                               | u16                                                                                                                                                                                             |
| `0x12`        | Tone2 decode                                                                                                                                               |                                                                                                                                                                                                 |
| `0x13–0x14`   | Contact index                                                                                                                                              | u16 **BE**, **0-based** talkgroup bank slot (anytone-cps `talkgroups.at(contact_idx)`). Studio DTO `txContactId` is **1-based** — codec maps `wire = txContactId − 1` on encode.                |
| `0x18`        | Radio ID index                                                                                                                                             |                                                                                                                                                                                                 |
| `0x19` bits   | Squelch mode / PTT-ID                                                                                                                                      |                                                                                                                                                                                                 |
| `0x1a` bits   | Optional signal / busy lock                                                                                                                                |                                                                                                                                                                                                 |
| `0x1b`        | Scan list index                                                                                                                                            | `0xff` = none; `0` = first scan list (0-based into `scanlists`). Studio `scanListId` is **1-based** — codec maps `wire = scanListId − 1`.                                                       |
| `0x1c`        | Receive group list index                                                                                                                                   | `0xff` = none; values `1…` select the **1-based** receive-group list index ([receive-group-record.md](receive-group-record.md)). Always re-derived on Write (`0xff` when DTO omits the index). |
| `0x1d`        | Tone2 ID index                                                                                                                                             |                                                                                                                                                                                                 |
| `0x1e`        | Tone5 ID index                                                                                                                                             |                                                                                                                                                                                                 |
| `0x1f`        | DTMF ID index                                                                                                                                              |                                                                                                                                                                                                 |
| `0x20`        | RX colour code index                                                                                                                                       |                                                                                                                                                                                                 |
| `0x21` bits   | See [byte `0x21`](#byte-0x21)                                                                                                                              | qDMR bit numbers; **not** anytone-cps (that source swapped timeslot vs SMS confirm)                                                                                                             |
| `0x22`        | AES encryption index                                                                                                                                       |                                                                                                                                                                                                 |
| `0x34` bits   | DMR CRC ignore, **auto scan** (bit 4 — "start scanning on channel select"; not scan-list membership), data ACK disable, exclude roaming, DMR mode, ranging |                                                                                                                                                                                                 |
| `0x35–0x3d`   | APRS / encryption indices                                                                                                                                  | Report type, PTT modes, channels, ARC4 idx, …                                                                                                                                                   |
| `0x3e–0x3f`   | Scrambler set / custom                                                                                                                                     | D890-specific vs D878 name placement                                                                                                                                                            |
| `0x40`        | R5Tone BOT                                                                                                                                                 | Secondary half starts here on wire                                                                                                                                                              |
| `0x41`        | R5Tone EOT                                                                                                                                                 |                                                                                                                                                                                                 |
| `0x43`        | TX colour code index                                                                                                                                       |                                                                                                                                                                                                 |
| `0x44–0x63`   | Name                                                                                                                                                       | `0x20` bytes; wide-char pack on D890 encode                                                                                                                                                     |

Gaps / unknown bytes: Studio Write **RMW**s each occupied modelled slot — reads the hydrated `0x80`, overlays modelled fields, and leaves unmodelled offsets (APRS, crypto, R5Tone, custom CTCSS, …) intact. Fresh slots encode as zeros except for fields the projection supplies.

## Studio overlay (v1)

| Offset                                                                               | Field                                                        | Write behaviour                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00–0x03`                                                                          | RX frequency                                                 | Re-derived from projection (BCD-as-hex)                                                                                                                                                                                                                  |
| `0x04–0x07`                                                                          | Offset / parked TX                                           | Re-derived when duplex ≠ none; **preserved** from hydrated record when simplex (`offset_direction = 0`)                                                                                                                                                  |
| `0x08`                                                                               | Mode / power / bandwidth / duplex                            | Re-derived                                                                                                                                                                                                                                               |
| `0x09`                                                                               | Tone selects + modeled flags                                 | CTCSS/DCS selects re-derived; **preserve** talkaround (7), call confirm (6), reverse (4) from prior on RMW; bit 5 from `rxOnly`                                                                                                                          |
| `0x0a` / `0x0b`                                                                      | CTCSS indices                                                | Written when tone kind is CTCSS (51 standard Anytone tones; custom index 51 → none)                                                                                                                                                                      |
| `0x0c–0x0f`                                                                          | DCS                                                          | Re-derived when DCS selected                                                                                                                                                                                                                             |
| `0x13–0x14`, `0x18`, `0x1b`, `0x1c`, `0x21`, `0x34` bit 4 (`auto_scan`), `0x44–0x63` | Contact, radio ID, scan, RX group, timeslot, auto scan, name | Re-derived. `0x1b`/`0x1c` always write `0xff` when the DTO omits scan/RX-group (do **not** preserve prior `0x1c` — m×n talk-group rows are None). **Timeslot** is `0x21` **bit 0** (`0` = TS1, `1` = TS2). **SMS confirm** (`0x21` bit 1) is not modelled — fresh encode sets it (CPS default On); RMW leaves the prior bit. **`auto_scan` on** zone scan carriers only — Web Serial `scanAdd` on `RadioChannelDto`; membership is the scan-list member array, not this bit. |
| `0x21` bit 5, `0x35`, `0x37`, `0x38`                                                 | APRS RX, report type, digital PTT, report slot               | Re-derived from `Channel.aprs` when digital ([#758](https://github.com/pskillen/codeplug-studio/issues/758))                                                                                                                                             |
| `0x20` / `0x43`                                                                      | RX / TX colour code                                          | Written from projection `colorCode` (same value both bytes)                                                                                                                                                                                              |
| Other APRS / crypto / R5Tone                                                         | Analog APRS, encryption, …                                   | **Preserved** from hydrated record on RMW                                                                                                                                                                                                                |

Gaps / unknown bytes: preserve on RMW (see table above).

## Byte `0x21`

Little-endian bit numbers. Evidence: qDMR `libdmrconf` `anytone_d868uv_codeplug.cc` (`timeSlot: {0x0021, 0}`, `smsConfirm: {0x0021, 1}`, `dmrMode` bits 2–3) plus forensic `HEALTHY_CHANNEL_RECORDS` (181 occupied slots: bit 1 always set, bit 0 set on 18). anytone-cps `Channel::encode_D890UV` tests **bit 1** for timeslot — that swap is **not** used here.

| Bit | Field | Studio overlay |
| --- | --- | --- |
| 0 | Time slot (`0` = TS1, `1` = TS2) | Written from DTO `timeslot` |
| 1 | SMS Confirmation | Unmodelled. Fresh encode sets On; RMW preserves prior |
| 2–3 | DMR MODE (`0` DMO/simplex, `1` repeater, `2`/`3` DCDM — unmodelled) | Written `0`/`1` from DTO `dmrOperatingMode`; never writes DCDM |
| 4 | Slot Suit | Unmodelled — preserve |
| 5 | APRS RX | Written from `Channel.aprs.receiveEnabled` when set |
| 6 | (unused / unknown) | Preserve |
| 7 | Work alone | Unmodelled — preserve |

## Power (`tx_power` in byte `0x08`)

Wire enum (2 bits) maps to CPS labels; Studio `%` ladder for **file** adapters is in [power.md](power.md). Binary adapter should map the same four steps (Low / Mid / High / Turbo) at the edge — do not invent a fifth level.

## Empty channel

`rx_frequency == 0` → treat as vacant (anytone-cps decode returns early). Clear ChannelSet bit; prefer not writing body, or write zeros consistently with the adapter policy.

## Related

- [memory-layout.md](memory-layout.md) · [zone-record.md](zone-record.md) · [protocol.md](protocol.md)
- CSV naming / columns only: [export-formats/anytone](../../../export-formats/anytone/README.md)
