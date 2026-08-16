# Open items

Live work only. Shipped work lives in version control.

---

## Hardware (blocks the headline)

- [x] Dump metadata `0x11` vacant fill — slots 14–32 had `+0x0B=0xFF` after bank `0xFF` fill (`D/2026-08-16-after`).
- [x] Dump settings `0x331–0x334` — **`03 95 f7`** (BE 234999). Radio UI `16225539` is LE of those bytes.
- [x] Morning Walk carrier on-air is **`Mornng Wlk Scan` ch122**, not a zone member. Byte `0x19=0x41` (wrong).
- [ ] NeonPlug file egress / CPS CSV of the same build: confirm member `scanListId` stamping (#1225) vs serial.
- [ ] **Parked 2026-08-16:** vacant-slot clear did not fix UI. Resume: full channel-bank read-back; Walk UI vs `0x19` on wire.
- [x] One-variable Write: APRS ID little-endian; confirm radio UI shows `234999`.
- [ ] Operator: which screen shows the red circle (main LCD vs GPS page vs a leftover airband VFO)?

## Code (do not bundle)

- [x] Scan-list bank fill `0xFF` + vacant-slot clear (`+0x0B=0x00`) — zone vacant-slot parity (`scanListCodec.ts`).
- [x] Chase Walk-only `0x19=0x41` — encode path produces `0x48` in tests (S12); hardware re-Write pending.
- [x] APRS `0x332–0x334` write little-endian (or confirm firmware actually wants BE and the UI is the bug — dump says UI = LE).
- [x] NeonPlug export: stamp `scanListId` on carriers only (#1225).

## Docs

- [x] After vacant-slot clear ships: update [contacts-zones-lists.md](../../reference/radios/baofeng/dm-32uv/contacts-zones-lists.md) unused-slot fill.
- [ ] Close this investigation into the archive layout when #1223 is answered.
