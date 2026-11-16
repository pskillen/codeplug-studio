# OpenGD77 debug memory viewer (DM-1701, MD-9600)

The Memory tab of both OpenGD77 debug pages shows a read-only inventory of channels, zones, contacts, RX groups and the User Database decoded with the existing OpenGD77 codecs from the open archive's captured FLASH spans. It needs no project, library or build, and it sends nothing to a radio. Fixtures are synthetic; none of this is hardware-verified.

## Gating rule

Only `flash-span-N` entries count: the id is a registered span, the address equals the span start, the length is within the span length, the path is `regions/<id>.bin` and the stored bytes match the declared length. Both `restorable` (a Backup ZIP) and `inspect-only` (a debug read) entries are accepted. A wrong id, address, length or stored size, a duplicate id or an overlap refuses the entry whole, with a listed reason. The User Database and calibration working copy are ignored here.

Coverage is byte-exact. The decode image starts at `0xFF` fill, which is never evidence: a gap or truncated tail is never filled with default bytes and never reads as an empty channel. A selected profile is not evidence of firmware.

## Channels

Eight banks of 128 slots. A bank is decoded only when its whole `0x1C10` bytes were captured (bank 0 at `0x3780`, banks 1 to 7 from `0x9B1B0`); otherwise its slots read "Not captured". Slots keep one-based numbers (bank 0 slot 1 to bank 7 slot 1024) and are never renumbered. A slot whose bank bitmap bit is set but whose record decodes empty is shown as an occupied empty record, distinct from a clear bit and from a missing bank. Capacity is 1024 binary slots. Layout: [channel-record.md](channel-record.md), [memory-layout.md](memory-layout.md).

There is no separate callsign field; identity is the single complete name. TX contact and RX group are shown as unresolved numbers on the channel row; the contact bank is listed in its own tab and the channel references are not resolved against it.

## Zones

The whole zone bank (`0x8010`, bitmap plus 68 records of `0xB0` bytes) must be captured. The bitmap is read per bit, so a zone with an empty name is listed as unnamed and keeps its slot number. Members keep radio order and duplicates, and each one-based channel number resolves against the channel inventory: resolved, absent (bitmap clear), empty record, not captured (its bank was not read) or out of range (above 1024). Zone and member decode do not depend on the channel banks being captured. Capacity is 68 zones. See [contacts-zones-lists.md](contacts-zones-lists.md).

## Contacts

The whole 1024-slot bank (`0xA7620`, 1024 records of `0x18` bytes) must be captured, otherwise the tab reads "Not captured" and lists no rows (never zero rows). Slots keep one-based numbers; empty slots are skipped and nothing is renumbered. Name, DMR ID and call type come from the product decoder. Call type 0 is Group, 1 Private, 2 All call; any other value is listed as Unknown with its raw value, never coerced. The time-slot override byte (record offset `0x17`) is not decoded by the product, so it is shown only as the raw byte. Layout: [contacts-zones-lists.md](contacts-zones-lists.md).

## RX groups

The whole group-list bank (`0xAD620`, `0x1840` bytes: a length table, then 76 records of `0x50` bytes) must be captured. The product decoder resolves each member through the contact bank and silently drops members it cannot resolve. The viewer keeps that count: `declared` is the length-table byte minus one (at most 32), `unresolved` is declared minus resolved. With the contact bank not captured every member reads unresolved ("contact bank not captured"); otherwise an unresolved member reads "contact slot is empty". Capacity is 76 lists.

## User Database

The capture keeps the User Database as the `user-database` region at `0x50000`, `inspect-only`: the 12-byte header, then segment 0 entries, then segment 1 entries, **packed** (no gap between segments). The Hex tab therefore shows packed offsets; the viewer shows the real flash address of each entry: segment 0 from `0x5000C` (entry 0 to 9707), then segment 1 from `0xD8000` (entry 9708 on). If the header mode byte is lower-case `n`, segment 1 starts at `0xAF400` (under the voice prompts) and addresses follow that. Wire facts: [user-database.md](user-database.md).

States: no region reads "Not captured"; a wrong address, role, path or stored length is "Refused" with the reason; a header the decoder rejects (bad magic, or an entry size other than `0x1b`) is "Invalid header" with the reason and raw header hex and lists no entries (the capture keeps a 12-byte invalid header); a count of 0 is valid and empty.

Entries shown are `min(header count, USER_DATABASE_MAX, whole entries in the stored bytes)`. When that is below the header count the viewer says so (an edited or short archive, or the product read cap of 520,646). Access is lazy: one 27-byte record is decoded on demand, the table pages at 100 rows, and search (ID prefix, or text) stops at 200 results. Text is the 6-bit packed alphabet, trimmed; a code outside the alphabet decodes as a space.

## Power ladders

The wire step is shown as the model's own ladder percent, labelled as the radio's step, not watts. Step 0 is "Default". The same wire step differs by model: step 8 is 80 on the DM-1701 and 63 on the MD-9600. See [DM-1701 power](../baofeng/dm-1701/power.md) and [MD-9600 power](../tyt/md-9600/power.md).

## Not decoded

Settings, APRS, DTMF, boot, VFO and additional-settings blocks, the satellite bank, scan lists (OpenGD77 uses the zone as scan list), DTMF contacts, and resolution of channel TX contact references against the contact bank.

See [radio debug](../../../features/radio-debug/README.md) and [debug capture](debug-capture.md).
