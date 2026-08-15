# i003 — Directory rows vs lookup banks (OpenGD77 1701 / DM-32 / AT-D890)

**Hub for this investigation.** Promoted from `tmp/features/baofeng-contacts-export/investigation.md` (scratch). Number **i003** is used; do not reuse.

**Status:** **Preliminary.** Code + qdmr/OpenGD77/Anytone docs. No live dump in this pass. Findings will move or die as hardware lands. Do not promote numbers into `src/core/radios/` until verified.

**Prime suspect:** Dual-bank radios map directory to the wrong FLASH/metadata bank (1701 contact bank; DM-32 `0x67`). D890 is single-bank: directory already targets `DigitalContact*` (the 500k lookup store). Dual-bank code still **drops** directory rows whose DMR ID is already in the library — wrong once banks are truly separate.

**Next move:** Hardware-check 1701 User Database bases vs qdmr `Offset`, and whether DM-32 incoming-call display reads V-frame `0x0F`. Stop-gap: do not merge directory into those wrong banks; stop dual-bank digitalId skip.

| | |
| --- | --- |
| **Opened** | 2026-08-15 |
| **Closed** | — (live) |
| **Tickets** | [#1211](https://github.com/pskillen/codeplug-studio/issues/1211) OpenGD77 1701 · [#1220](https://github.com/pskillen/codeplug-studio/issues/1220) DM-32 · D890 bank targeting has no new ticket (looks correct) |
| **Intended behaviour** | Library contacts (+ TGs) in the **main contact bank**. Directory in a **lookup** store for incoming / group-call display only. **Dual bank:** keep the same DMR ID in both stores. **Single bank:** dedupe on `digitalId` (library wins). |

---

## Read in this order

| File | What it is | Mutability |
| ---- | ---------- | ---------- |
| this file | status, strategy, rules | status line changes; rest is stable |
| [`01-findings.md`](01-findings.md) | what is **currently believed**, each with a citation | append-only; dead rows move to 02 |
| [`02-dead-ends.md`](02-dead-ends.md) | killed hypotheses | append-only |
| [`03-ledger.md`](03-ledger.md) | source-read / operator / future runs | **rows immutable** |
| [`04-bank-geometry.md`](04-bank-geometry.md) | bulky addresses and caps | update when hardware contradicts |
| [`05-open-items.md`](05-open-items.md) | open work only | edited as things ship |

Settled radio facts belong in `docs/reference/radios/` — cite, do not duplicate once promoted.

## Current strategy

Same product intent, three wires. Code mapping is cheap to prove; FLASH layout and “what the LCD actually looks up” are hardware. Do not ship User Database encode from qdmr comments alone (`0x30000` on the UV380 file is stale). D890 `DigitalContact*` is the lookup-sized bank — do not invent a second User Database there.

## Rules of engagement

- **Preliminary until a dump or live Write.** Source-read rows say so. Inference says so.
- **A result that matches proves nothing.** Backup “1024 DMR contacts” matching `CONTACTS_MAX` does not prove the User Database is 1024.
- **qdmr is what qdmr writes, not what the 1701 does.** Trust `Offset` + `encode()` over class comments; still verify on radio.
- **Do not mix stock TYT DM-1701 maps with OpenGD77.** 10 000 contacts at `0x140000` is stock firmware.
- **One variable per expensive radio run.**
