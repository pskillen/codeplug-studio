# Open items

Only open work. Anything shipped is in version control and does not belong here.

Ids continue from this investigation (`O1`…). Do not renumber; commit messages and the plan cite them.

---

## P1 — correctness, needed before calling write "done"

### O1. Confirm packed angle on hardware after ship — **OPEN**

Firmware struct packing matches (`S/fw-struct`). Numeric packing is qDMR layout + **round** `abs(angle)*10000` (O2 locked). Discriminator is a 56-byte record from official CPS with known lat/lon (`E1`) or operator hardware check: Write a located channel, confirm distance-from-repeater on the radio.

## P2 — product / follow-on

### O5. `latLon*` conversion in `uiUtilities.c` still unread — **OPEN**

GitHub rate-limited the `.c` fetch (`E2`). Needed only if `E1` disagrees with qDMR layout. Do not block the write path on it.

---

## Locked decisions (2026-08-17)

| # | Decision | Resolution |
| - | -------- | ---------- |
| O2 | Truncate vs round when encoding `angle * 10000` | **Round** `abs(angle)*10000` after scaling (not qDMR truncate toward zero). |
| O3 | Should Web Serial **Read** hydrate `Channel.location` / `useLocation`? | **No** Read→library. `decodeChannelRecord` fills `RadioChannelDto` for read-info, backup inspect, and write-verify. |
| O4 | Track #1233 on the DM-1701 outstanding list | **Do not** add a row to `opengd77-dm1701-outstanding.md`. |
| D1 | DTO shape | `location?: { lat, lon } \| null` plus `useLocation?: boolean` — coords without flag are representable. |
| D2 | Maidenhead-only channels | Projection uses `channel.location` (same as CSV). No Maidenhead on the wire. |
| D3 | Scope | One `channelCodec.ts` for all OpenGD77 radio-io profiles (DM-1701, MD-9600, …). |
