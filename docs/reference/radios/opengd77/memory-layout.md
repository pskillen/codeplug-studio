# OpenGD77 / OpenUV380 — memory layout

Image banks, registered spans, and named region base addresses for OpenGD77-family firmware. **Primary tables are OpenUV380** (DM-1701 / MD-9600 path). GD-77-class values are the remapping baseline.

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

## Image banks

| Name     | Value | Notes                                                        |
| -------- | ----- | ------------------------------------------------------------ |
| `EEPROM` | `0`   | GD-77-class low codeplug regions                             |
| `FLASH`  | `1`   | High regions on GD-77; **all** codeplug regions on OpenUV380 |

Cite: qdmr `opengd77base_codeplug.hh` (`ImageType`), `opengd77_interface.hh`.

## Transfer sizes

| Constant                            | Value  | Role                           |
| ----------------------------------- | ------ | ------------------------------ |
| Block size (`BSIZE` / `BLOCK_SIZE`) | `32`   | Read/write payload quantum     |
| Flash sector (`SECTOR_SIZE`)        | `4096` | Flash write erase/program unit |

Cite: qdmr `opengd77base.cc`, `opengd77_interface.cc`.

## Channel bank geometry (shared)

| Fact                | Value                                      |
| ------------------- | ------------------------------------------ |
| Channel record size | `0x38`                                     |
| Channels per bank   | `128`                                      |
| Channel banks       | `8` (1024 channels total)                  |
| Bank element size   | `0x1c10`                                   |
| Bank layout         | Bitmask @ `0x00`; channel records @ `0x10` |

Cite: qdmr `OpenGD77BaseCodeplug::ChannelElement` / `ChannelBankElement` in `opengd77base_codeplug.hh`.

## Named region bases — OpenUV380 (primary)

All regions use **FLASH** (`ImageIndex` → `FLASH`). Numeric offsets below are absolute within the FLASH bank.

| Region             | Address      | Notes                                         |
| ------------------ | ------------ | --------------------------------------------- |
| settings           | `0x00000080` | General settings                              |
| dtmfSettings       | `0x00001470` |                                               |
| aprsSettings       | `0x00001588` | FM APRS systems                               |
| dtmfContacts       | `0x00002f88` |                                               |
| channelBank0       | `0x00003780` | Channels 1–128                                |
| bootSettings       | `0x00007518` |                                               |
| vfoA               | `0x00007590` |                                               |
| vfoB               | `0x000075c8` |                                               |
| zoneBank           | `0x00008010` |                                               |
| additionalSettings | `0x00020000` | Boot image/melody/satellites/themes           |
| channelBank1       | `0x0009b1b0` | Channels 129–1024 (banks 1–7 stride `0x1c10`) |
| contacts           | `0x000a7620` | DMR contacts                                  |
| groupLists         | `0x000ad620` | RX group lists                                |

Cite: qdmr `openuv380_codeplug.hh` `Offset` / `ImageIndex`.

### Registered FLASH spans (OpenUV380 ctor)

| Start        | Length       | Covers                                                  |
| ------------ | ------------ | ------------------------------------------------------- |
| `0x00000080` | `0x00005fe0` | Low settings through channel bank 0 area                |
| `0x00007500` | `0x00003b00` | Boot / VFO / zones area                                 |
| `0x00020000` | `0x11a0`     | Additional settings (`AdditionalSettingsElement::size`) |
| `0x0009b000` | `0x00013e60` | Channels 129–1024, contacts, group lists                |

Cite: qdmr `openuv380_codeplug.cc` ctor.

## Named region bases — OpenGD77 (GD-77 class)

Same **numeric** low addresses for settings…zones, but those live in **EEPROM**. High regions differ.

| Region             | Bank   | Address                 |
| ------------------ | ------ | ----------------------- |
| settings           | EEPROM | `0x000080`              |
| dtmfSettings       | EEPROM | `0x001470`              |
| aprsSettings       | EEPROM | `0x001588`              |
| dtmfContacts       | EEPROM | `0x002f88`              |
| channelBank0       | EEPROM | `0x003780`              |
| bootSettings       | EEPROM | `0x007518`              |
| vfoA / vfoB        | EEPROM | `0x007590` / `0x0075c8` |
| zoneBank           | EEPROM | `0x008010`              |
| additionalSettings | FLASH  | `0x000000`              |
| channelBank1       | FLASH  | `0x07b1b0`              |
| contacts           | FLASH  | `0x087620`              |
| groupLists         | FLASH  | `0x08d620`              |

Cite: qdmr `opengd77_codeplug.hh` `Offset` / `ImageIndex`.

### Registered spans (OpenGD77 ctor)

| Bank   | Start      | Length                         |
| ------ | ---------- | ------------------------------ |
| EEPROM | `0x000080` | `0x05fe0`                      |
| EEPROM | `0x07500`  | `0x03b00`                      |
| FLASH  | `0x000000` | `0x11a0` (additional settings) |
| FLASH  | `0x7b000`  | `0x13e60`                      |

Cite: qdmr `opengd77_codeplug.cc` ctor.

## OpenUV380 vs GD-77 remapping

| Aspect                       | OpenGD77 (GD-77)             | OpenUV380 (DM-1701 / MD-9600) |
| ---------------------------- | ---------------------------- | ----------------------------- |
| Low regions (settings…zones) | EEPROM, same numeric offsets | FLASH, same numeric offsets   |
| additionalSettings           | FLASH `0x000000`             | FLASH `0x00020000`            |
| channelBank1                 | FLASH `0x07b1b0`             | FLASH `0x0009b1b0`            |
| contacts                     | FLASH `0x087620`             | FLASH `0x000a7620`            |
| groupLists                   | FLASH `0x08d620`             | FLASH `0x000ad620`            |
| Write type byte              | `'W'`                        | `'X'`                         |

qdmr does **not** define separate DM-1701 vs MD-9600 record maps — only shared OpenUV380 remapping plus `radioType` ID.

## Scan lists (present; not first-adapter critical)

Doxygen / stock GD-77 maps place scan lists around EEPROM `0x01790` (size `0x1640`, 64 lists). qdmr’s OpenGD77 encode path and limits **ignore** scan lists. Document presence for completeness; do not require them for a first Studio OpenUV380 adapter.

## Doc vs code caveats

Prefer `Offset` / `Limit` / `size()` over older Doxygen narratives when they disagree:

| Topic                 | Prefer                                         | Stale / conflicting                                             |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Settings start        | `0x80`                                         | Some Doxygen tables say `0x000e0`                               |
| Zone count            | Limit **68**                                   | Some Doxygen text says 250                                      |
| Group-list bank size  | `0x1840`                                       | Some Doxygen sizes differ                                       |
| Channel field packing | `OpenGD77BaseCodeplug::ChannelElement::Offset` | `doc/code/opengd77_channel.txt` (stock GD77-style — do not mix) |

## Verification

Cross-checked against local qdmr checkout:

| Fact set         | File                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| OpenUV380 bases  | `lib/openuv380_codeplug.hh` L73–106; ctor `openuv380_codeplug.cc` L17–22 |
| GD-77 bases      | `lib/opengd77_codeplug.hh` L116–149; ctor `opengd77_codeplug.cc` L14–21  |
| Channel geometry | `lib/opengd77base_codeplug.hh` L67, L300, L318                           |
| Transfer sizes   | `lib/opengd77_interface.cc` L12–13                                       |

A live radio dump is optional for this doc ticket; see [fixtures.md](fixtures.md) for future capture.

## Related

- [channel-record.md](channel-record.md) · [contacts-zones-lists.md](contacts-zones-lists.md) · [settings-aprs.md](settings-aprs.md)
- [protocol.md](protocol.md)
- Radio homes: [dm-1701](../baofeng/dm-1701/README.md) · [md-9600](../tyt/md-9600/README.md)
