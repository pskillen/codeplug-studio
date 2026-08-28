# Dead ends — do not re-chase

This file exists so the next session does not re-derive “we RMW because we don’t model the whole radio” as a reason to copy channel bodies.

---

## Conflated layers

| Hypothesis | Killed by | Why it's dead |
| ---------- | --------- | ------------- |
| Intra-record RMW of channel (zone, TG, …) bodies is required because Studio does not model the entire radio memory. | W1 + W2 | Unmodelled **regions** (settings, LocalInfo, APRS filter bank, FLASH outside the channel table) need region/erase-unit RMW. Modelled **records** are a different grain. Keeping hotspot SMS/crypto/RGL in a GB7GL slot is not “preserving radio settings”. |
| anytone-cps channel bit packing is authoritative for D890 `0x21`. | W5; `S/d890-ts-bit` | that source swapped timeslot vs SMS confirm. qDMR + forensic `HEALTHY_CHANNEL_RECORDS` (bit 1 always set, bit 0 varies) are the mapping Studio shipped in #1271. |
| Fixing omitted DTO fields one-by-one (always write `0x1c`, always write DMR MODE) removes the class of bug. | W4, W9 | Those patches stop *those* fields leaking. Every remaining unmodelled-in-record byte still copies the previous occupant. The next sticky field is the same engine. |
| CSV and serial can safely diverge on RGL for m×n TG rows. | W7; export-pathway-parity | CSV/NeonPlug already honoured `projection.rxGroupListId === null`. Serial `?? parent` was a mapper bug, not a radio constraint. |
| RT95 serial Write copies occupant channel bodies — same intra-record class as D890 (pre-inventory W13). | `S/e1-rt95-wipe-first` | The helper `encodeChannelRecord(dto, prior)` *would* copy a non-blank prior. Write always `fill(0xff)` the span first, so `prior` is blank and the encoder 0-fills. Occupant leak is not live on the serial path. |

### Deliberately NOT in this file

- **“All prior copies in radio-io are bugs.”** OpenGD77 `encodeOpenGd77WriteImageFromPrior` and D890 sparse erase-unit RMW are **region** RMW. Clearing those would wipe unmodelled settings. E1 classified each call site; only D890 channels were intra-record.
- **“DM-32 / Mini prove D890 can drop `prior` without a defaults table.”** They encode whole records **because** they have NeonPlug/CHIRP defaults for every offset. Dropping `prior` without defaults is a different bug. **O2 answered in #1273:** write-defaults table in [channel-record.md](../../reference/radios/anytone/at-d890uv/channel-record.md).
