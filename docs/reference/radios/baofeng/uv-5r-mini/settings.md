# UV-5R Mini — settings and upload scope

High-level VFO / settings / ANI / PTT offsets and how NeonPlug vs CHIRP vs Studio upload differently.

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `settingsFormat.ts`, `protocol.ts`; CHIRP `UV5RMini` / `_mem_params`; Studio `writeStrategy: 'full-image'`.

## Packed-image layout (high half of first region + tail)

NeonPlug documents (CHIRP-aligned):

| Packed offset | Role                |
| ------------- | ------------------- |
| `0x8000`      | VFO A (32 bytes)    |
| `0x8020`      | VFO B (32 bytes)    |
| `0x8040`      | Settings (64 bytes) |
| `0x8080`      | ANI                 |
| `0x80A0`      | PTT ID              |
| `0x81E0`      | Upcode              |
| `0x8210`      | Downcode            |

CHIRP `_mem_params` places `ani=0x8080`, `pttid=0x80A0` on the same packed map. Modes / end-format seek around `0x8220`.

## Settings block (64 bytes @ packed `0x8040`)

NeonPlug parses squelch, save mode, VOX, backlight, dual watch, TOT, beep, voice, side tone, scan mode, PTT ID mode/delay, display types, BCL, autolock, alarm, roger, A/B, work modes, key lock, power-on display, and related indices from this block (`parseUv5rMiniSettings`). Field-by-field UI lists live in NeonPlug `settingsFormat.ts` / `settingsProfile.ts` — extract further enums into this page only when the adapter needs them.

## Upload behaviours (document all three)

| Behaviour             | NeonPlug                                                                  | CHIRP                                     | Studio Web Serial                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Full clone **read**   | All three `MEM_*` regions → packed `0x8240`                               | Same                                      | Same (`radio-clone` hydration)                                                                                                               |
| Full clone **upload** | Not the default path                                                      | Writes **all** `MEM_STARTS` / `MEM_SIZES` | **Yes** — `writeStrategy: 'full-image'`                                                                                                      |
| Channel write         | After upload handshake, writes radio addrs `0 … 0x7CE0` only (`999 × 32`) | Full multi-region                         | Merges channels into hydrated image — **full channel span cleared** to empty then encoded from build; **all three** `MEM_*` regions uploaded |
| Settings write        | Read-modify-write one 64-byte block                                       | Part of full upload                       | Retained from Read via full-image upload (no separate settings RMW)                                                                          |

**Studio intentional path:** Prefer NeonPlug’s **outcome** (VFO / settings / ANI survive a channel Write) via **full-image upload of the hydrated retain**, not NeonPlug’s channel-span-only traffic. That also avoids NeonPlug’s settings-address debt (below). Channel-span-only upload is **out of scope** for the shipped adapter.

**Channel encode contract:** Write clears the packed channel span to empty (`0xFF`) and encodes only slots from the build projection (firmware string at `0x1EF0` preserved inside the span). Orphan memories from a prior Read are not kept.

## Packed `0x8040` vs radio address caveat

| Context                       | Address used                                                    |
| ----------------------------- | --------------------------------------------------------------- |
| Packed image parse            | Image offset `0x8040` (= radio **`0x9000`** via region map)     |
| NeonPlug `writeRadioSettings` | `readBlock` / `writeBlock` with addr **`0x8040`** (radio space) |

Those are **not** the same physical region under the `MEM_*` map. NeonPlug’s settings RMW address is **verify-on-hardware** debt. Studio does not use that path — full-image upload uses the correct packed ↔ radio map.

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- NeonPlug file settings bag (different world): [export-formats/neonplug](../../../export-formats/neonplug/README.md)
