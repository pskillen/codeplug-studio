# UV-5R Mini — settings and upload scope

High-level VFO / settings / ANI / PTT offsets and how NeonPlug vs CHIRP upload differently. Needed for a safe first Web Serial adapter ([#617](https://github.com/pskillen/codeplug-studio/issues/617)).

**Hub:** [README.md](README.md) · **Regions:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `settingsFormat.ts`, `protocol.ts`; CHIRP `UV5RMini` / `_mem_params`.

## Packed-image layout (high half of first region + tail)

NeonPlug documents (CHIRP-aligned):

| Packed offset | Role |
| ------------- | ---- |
| `0x8000` | VFO A (32 bytes) |
| `0x8020` | VFO B (32 bytes) |
| `0x8040` | Settings (64 bytes) |
| `0x8080` | ANI |
| `0x80A0` | PTT ID |
| `0x81E0` | Upcode |
| `0x8210` | Downcode |

CHIRP `_mem_params` places `ani=0x8080`, `pttid=0x80A0` on the same packed map. Modes / end-format seek around `0x8220`.

## Settings block (64 bytes @ packed `0x8040`)

NeonPlug parses squelch, save mode, VOX, backlight, dual watch, TOT, beep, voice, side tone, scan mode, PTT ID mode/delay, display types, BCL, autolock, alarm, roger, A/B, work modes, key lock, power-on display, and related indices from this block (`parseUv5rMiniSettings`). Field-by-field UI lists live in NeonPlug `settingsFormat.ts` / `settingsProfile.ts` — extract further enums into this page only when the adapter needs them.

## Upload behaviours (document both)

| Behaviour | NeonPlug | CHIRP |
| --------- | -------- | ----- |
| Full clone **read** | All three `MEM_*` regions → packed `0x8240` | Same |
| Full clone **upload** | Not the default path | Writes **all** `MEM_STARTS` / `MEM_SIZES` |
| Channel write | After upload handshake, writes radio addrs `0 … 0x7CE0` only (`999 × 32`) | Full multi-region |
| Settings write | Read-modify-write one 64-byte block | Part of full upload |

**Studio implication:** Prefer NeonPlug-style **channel-span** (and optional settings RMW) with a **cached full image** so VFO/settings/ANI survive channel uploads — matches adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617) “safe upload ranges / cache image”.

## Packed `0x8040` vs radio address caveat

| Context | Address used |
| ------- | ------------ |
| Packed image parse | Image offset `0x8040` (= radio **`0x9000`** via region map) |
| NeonPlug `writeRadioSettings` | `readBlock` / `writeBlock` with addr **`0x8040`** (radio space) |

Those are **not** the same physical region under the `MEM_*` map. Documented as **verify-on-hardware** debt for #617 — do not assume NeonPlug’s settings-write address is correct without a radio check.

## Related

- [memory-layout.md](memory-layout.md) · [protocol.md](protocol.md) · [channel-record.md](channel-record.md)
- NeonPlug file settings bag (different world): [export-formats/neonplug](../../../export-formats/neonplug/README.md)
