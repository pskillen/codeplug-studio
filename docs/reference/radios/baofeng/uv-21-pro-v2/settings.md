# UV-21Pro V2 — settings and upload scope

High-level VFO / settings / ANI / PTT offsets and Studio full-image upload contract.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: CHIRP `UV17Pro` / `UV21ProV2` `_mem_params`; Studio `writeStrategy: 'full-image'`.

## Packed-image layout (high half of first region + tail)

CHIRP `_mem_params` on UV-17Pro family:

| Packed offset | Role                |
| ------------- | ------------------- |
| `0x8000`      | VFO A (32 bytes)    |
| `0x8020`      | VFO B (32 bytes)    |
| `0x8040`      | Settings (64 bytes) |
| `0x8080`      | ANI                 |
| `0x80A0`      | PTT ID              |
| `0x81E0`      | Upcode              |
| `0x8210`      | Downcode            |
| `0x8280`      | Name bank (CHIRP)   |

Modes / end-format seek around `0x8220`. Fourth region at packed `0x8340` (radio `0xD000`) — see [memory-layout.md](memory-layout.md).

## Settings block (64 bytes @ packed `0x8040`)

Same family layout as UV-5R Mini — squelch, save mode, VOX, backlight, dual watch, TOT, beep, voice, and related indices. Field-by-field enums live in CHIRP `baofeng_uv17Pro.py` — extract into this page when the adapter decodes them for Radio image UI.

## Studio upload behaviour

| Behaviour             | Studio Web Serial                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Full clone **read**   | All four `MEM_*` regions → packed `0x8380` (`radio-clone` hydration)                                                                        |
| Full clone **upload** | **Yes** — `writeStrategy: 'full-image'`                                                                                                     |
| Channel write         | Merges channels into hydrated image — **full channel span cleared** to empty then encoded from build; **all four** `MEM_*` regions uploaded |
| Settings write        | Retained from Read via full-image upload (no separate settings RMW)                                                                         |

**Channel encode contract:** Write clears the packed channel span (`0x7D00`) to empty (`0xFF`) and encodes only slots from the build projection (firmware string at `0x1EF0` preserved inside the span).

## Packed `0x8040` vs radio address

Packed image offset `0x8040` maps to radio address **`0x9000`** (second `MEM_*` region). Studio full-image upload uses the correct packed ↔ radio map — do not RMW settings at radio `0x8040`.

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- Sibling: [UV-5R Mini settings](../uv-5r-mini/settings.md)
