# Open items

Live work only. Shipped work lives in version control.

---

## Hardware (blocks the headline)

- [x] Dump metadata `0x11` vacant fill — **`0x00`**, not `0xFF` (`D/2026-08-15-after`).
- [x] Dump settings `0x331–0x334` — **`03 95 f7`** (BE 234999). Radio UI `16225539` is LE of those bytes.
- [x] Morning Walk carrier on-air is **`Mornng Wlk Scan` ch122**, not a zone member. Byte `0x19=0x41` (wrong).
- [ ] NeonPlug file egress / CPS CSV of the same build: confirm member `scanListId` stamping (#1225) vs serial.
- [ ] One-variable Write: `0xFF`-fill scan bank; confirm unnamed lists gone.
- [ ] One-variable Write: APRS ID little-endian; confirm radio UI shows `234999`.
- [ ] Operator: which screen shows the red circle (main LCD vs GPS page vs a leftover airband VFO)?

## Code (do not bundle)

- [x] Scan-list bank fill `0x00` → `0xFF` to match NeonPlug (`scanListCodec.ts`).
- [x] Chase Walk-only `0x19=0x41` — encode path produces `0x48` in tests (S12); hardware re-Write pending.
- [x] APRS `0x332–0x334` write little-endian (or confirm firmware actually wants BE and the UI is the bug — dump says UI = LE).
- [ ] NeonPlug export: stamp `scanListId` on carriers only (#1225).

## Docs

- [ ] After `0xFF` fill ships: update [contacts-zones-lists.md](../../reference/radios/baofeng/dm-32uv/contacts-zones-lists.md) unused-slot fill.
- [ ] Close this investigation into the archive layout when #1223 is answered.
