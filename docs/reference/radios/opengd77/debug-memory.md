# OpenGD77 debug memory viewer (DM-1701, MD-9600)

The Memory tab of both OpenGD77 debug pages shows a read-only inventory of channels and zones decoded with the existing OpenGD77 codecs from the open archive's captured FLASH spans. It needs no project, library or build, and it sends nothing to a radio. Fixtures are synthetic; none of this is hardware-verified.

## Gating rule

Only `flash-span-N` entries count: the id is a registered span, the address equals the span start, the length is within the span length, the path is `regions/<id>.bin` and the stored bytes match the declared length. Both `restorable` (a Backup ZIP) and `inspect-only` (a debug read) entries are accepted. A wrong id, address, length or stored size, a duplicate id or an overlap refuses the entry whole, with a listed reason. The User Database and calibration working copy are ignored here.

Coverage is byte-exact. The decode image starts at `0xFF` fill, which is never evidence: a gap or truncated tail is never filled with default bytes and never reads as an empty channel. A selected profile is not evidence of firmware.

## Channels

Eight banks of 128 slots. A bank is decoded only when its whole `0x1C10` bytes were captured (bank 0 at `0x3780`, banks 1 to 7 from `0x9B1B0`); otherwise its slots read "Not captured". Slots keep one-based numbers (bank 0 slot 1 to bank 7 slot 1024) and are never renumbered. A slot whose bank bitmap bit is set but whose record decodes empty is shown as an occupied empty record, distinct from a clear bit and from a missing bank. Capacity is 1024 binary slots. Layout: [channel-record.md](channel-record.md), [memory-layout.md](memory-layout.md).

There is no separate callsign field; identity is the single complete name. TX contact and RX group are shown as unresolved numbers (contacts are not decoded here).

## Zones

The whole zone bank (`0x8010`, bitmap plus 68 records of `0xB0` bytes) must be captured. The bitmap is read per bit, so a zone with an empty name is listed as unnamed and keeps its slot number. Members keep radio order and duplicates, and each one-based channel number resolves against the channel inventory: resolved, absent (bitmap clear), empty record, not captured (its bank was not read) or out of range (above 1024). Zone and member decode do not depend on the channel banks being captured. Capacity is 68 zones. See [contacts-zones-lists.md](contacts-zones-lists.md).

## Power ladders

The wire step is shown as the model's own ladder percent, labelled as the radio's step, not watts. Step 0 is "Default". The same wire step differs by model: step 8 is 80 on the DM-1701 and 63 on the MD-9600. See [DM-1701 power](../baofeng/dm-1701/power.md) and [MD-9600 power](../tyt/md-9600/power.md).

## Not decoded

Contacts, RX groups and the User Database (a later piece), settings, APRS, DTMF, boot, VFO and additional-settings blocks, the satellite bank, scan lists (OpenGD77 uses the zone as scan list), and contact resolution of channel TX contact references.

See [radio debug](../../../features/radio-debug/README.md) and [debug capture](debug-capture.md).
