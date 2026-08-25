# Open items

Only open work. Shipped work lives in version control.

---

## P0 — blocking on-air Write

### O6. Frequency / offset BCD is LSD-first; radio wants CHIRP `bbcd` — **SHIPPED in tree**

`bcd.ts` now packs MSD-first. Hardware confirm still **O5**.

### O5. Hardware Write (second pass) — **OPEN**

After O6: GB3GL RX in amateur UHF (not 136/490), offset **+7.6 MHz**, PTT not null, CTCSS still correct.

## P1 — already shipped (keep)

- MSB-first packing, `ALL_DTCS_CODES`, simplex offset modelled as 0, space-padded names, golden bit tests — **shipped** (hardware: tones + duplex sign OK).
- `bbcd` MSD-first — **shipped** in `bcd.ts` (golden tests). Radio confirm is O5.
- Tier-3 bit table + BCD endian note — **shipped** [channel-record.md](../../reference/radios/retevis/rt95/channel-record.md).
