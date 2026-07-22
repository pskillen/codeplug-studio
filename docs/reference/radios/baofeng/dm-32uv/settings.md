# DM-32UV — settings and co-resident blocks

Radio settings live in the **metadata `0x04`** 4KB block. Emergency systems and encryption keys share other tagged blocks — document co-residency so a first Web Serial adapter does not clobber unrelated regions.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `structures.ts` (`parseRadioSettings` / `encodeRadioSettings`), emergency/encryption helpers; `constants.ts`.

## Settings block (metadata `0x04`)

Full 4KB; NeonPlug requires at least `0x508` bytes of meaningful layout for parse. Metadata byte at `0xFFF` must remain **`0x04`** on write.

### Highlights (not exhaustive)

| Offset / area         | Role                                              |
| --------------------- | ------------------------------------------------- |
| `0x00`                | Power-on interface                                |
| `0x01` / `0x0F`       | Power-on display lines (14 ASCII each)            |
| `0x1D` bit 0          | Allow reset                                       |
| `0x1E`                | Auto power off (0–5 enum)                         |
| `0x20`–`0x21`         | Alert tone flags                                  |
| `0x30`–`0x3B`         | Backlight, display flags, colours, menu exit      |
| `0x40`–`0x45`         | GPS enable / units / mode / UTC / report interval |
| `0x60`–`0x67`         | Digital decode / call hold / SMS / name display   |
| `0x80`–`0x81`         | VFO embedded flags / TX dwell                     |
| `0x85`–`0x86`, `0x93` | Key lock / auto lock delay / long-press           |
| `0x87`–`0x90`         | Side / programmable key short/long functions      |
| `0x120`…              | Analog one-key call entries                       |
| `0x200`…              | One-touch call (5 × 5 bytes)                      |
| `0x230`…              | Fun+ entries (10 × 7 bytes)                       |
| `0x301`–`0x334`       | **APRS / GPS position** (below)                   |
| `0x500`–`0x507`       | Menu enable/disable bitflags                      |

Field-by-field UI enums live in NeonPlug `settingsProfile.ts` / settings parse — extract further only when adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638) needs them.

### APRS / GPS position (`0x301`–`0x334`)

| Offset            | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `0x301`           | Scheduled send time                                   |
| `0x302` bit 0     | Fixed beacon                                          |
| `0x306` / `0x30F` | Latitude string + N/S                                 |
| `0x310` / `0x319` | Longitude string + E/W                                |
| `0x320`–`0x32F`   | APRS report channels 1–8 (u16 LE each; `0` = current) |
| `0x330`           | Repeater active delay                                 |
| `0x331` bit 0     | Call type                                             |
| `0x332`–`0x334`   | Upload DMR ID (24-bit BE)                             |

## VFO channels (metadata `0x41`)

NeonPlug treats VFO A/B as channels **4001** / **4002** parsed from block metadata **`0x41`**, with TX-contact slots in block `0x43` at `0x0FFA` / `0x0FFC`. Settings block parse leaves placeholder VFOs until `0x41` is applied.

## Emergency / encryption co-resident notes

| Topic             | Observed (NeonPlug)                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Analog emergency  | Entries in the `0x10`-tagged block region (~36 bytes each; max 16); encode clears `0x0AC`–`0x2FF` only                                                                   |
| Encryption keys   | Start at offset **`0x300`** in the same physical block family as analog emergency                                                                                        |
| Digital emergency | Entry size ~20–40 bytes; discovery may tag **`0x03`** while `METADATA.DIGITAL_EMERGENCY` constant is **`0x10`** — see [memory-layout.md](memory-layout.md) inconsistency |

**Adapter implication:** always **read-modify-write** the full 4KB and preserve unknown bytes / co-resident sections. Never blank an entire `0x10` (or `0x03`) block when writing only one subsection.

## Upload / RMW guidance

| Behaviour              | NeonPlug approach                                                      |
| ---------------------- | ---------------------------------------------------------------------- |
| Settings write         | Encode into cached `0x04` block; preserve unknown fields from original |
| Channel write          | Rewrite channel blocks + TX-contact + related lists as needed          |
| Safe first Studio path | Cache full discovered set from bulk-read; RMW only changed blocks      |

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- NeonPlug file settings bag (different world): [export-formats/neonplug](../../../export-formats/neonplug/README.md)
