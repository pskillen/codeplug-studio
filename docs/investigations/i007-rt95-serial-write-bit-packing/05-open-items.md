# Open items

Only open work. Shipped work lives in version control.

---

## P0 — shipped in code (#1234 branch)

- MSB-first packing on bytes 9–11 and DTCS flags on 15/17 — **shipped** `channelCodec.ts`
- Simplex / RX-only offset BCD `0` — **shipped**
- `ALL_DTCS_CODES` wire indices — **shipped** `allDtcsCodes.ts`
- Golden-byte tests — **shipped** `channelCodec.test.ts`
- Tier-3 bit table — **shipped** [channel-record.md](../../reference/radios/retevis/rt95/channel-record.md)

## P1 — still open

### O5. Hardware Write — **OPEN**

One simplex, one +600 kHz, one TSQL, one DTCS; TX works; dump matches a CHIRP write of the same memories. Operator-owned before merge.

### D2. Pre-#1234 images

Read of channels previously written with the LSB map will look wrong until those slots are rewritten.
