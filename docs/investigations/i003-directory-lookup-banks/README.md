# i003 — Directory rows vs lookup banks (OpenGD77 1701 / DM-32 / AT-D890)

**Hub for this investigation.** Promoted from `tmp/features/baofeng-contacts-export/investigation.md` (scratch). Number **i003** is used; do not reuse.

**Status:** **Live.** OpenGD77 User Database **code shipped** ([#1211](https://github.com/pskillen/codeplug-studio/issues/1211)) — hardware verify pending. DM-32 remapping ([#1220](https://github.com/pskillen/codeplug-studio/issues/1220)) still open. No live dump in this pass. Do not promote unverified numbers into library CRUD.

**Prime suspect (remaining):** DM-32 maps directory to operator radio IDs `0x67` instead of address book `0x0F`. D890 is single-bank: directory already targets `DigitalContact*`. OpenGD77 contact-bank stuffing is **stopped in code**; LCD lookup vs qdmr `0x50000` / `0xd8000` is unproven.

**Next move:** Hardware-check 1701 User Database bases vs qdmr `Offset` (H1) and incoming-call display. Keep #1220 stop-gap (do not merge directory into `0x67`; keep DM-32 digitalId skip until that ticket).

|                        |                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opened**             | 2026-08-15                                                                                                                                                                                                                                |
| **Closed**             | — (live)                                                                                                                                                                                                                                  |
| **Tickets**            | [#1211](https://github.com/pskillen/codeplug-studio/issues/1211) OpenGD77 1701 · [#1220](https://github.com/pskillen/codeplug-studio/issues/1220) DM-32 · D890 bank targeting has no new ticket (looks correct)                           |
| **Intended behaviour** | Library contacts (+ TGs) in the **main contact bank**. Directory in a **lookup** store for incoming / group-call display only. **Dual bank:** keep the same DMR ID in both stores. **Single bank:** dedupe on `digitalId` (library wins). |

---

## Read in this order

| File                                         | What it is                                           | Mutability                          |
| -------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| this file                                    | status, strategy, rules                              | status line changes; rest is stable |
| [`01-findings.md`](01-findings.md)           | what is **currently believed**, each with a citation | append-only; dead rows move to 02   |
| [`02-dead-ends.md`](02-dead-ends.md)         | killed hypotheses                                    | append-only                         |
| [`03-ledger.md`](03-ledger.md)               | source-read / operator / future runs                 | **rows immutable**                  |
| [`04-bank-geometry.md`](04-bank-geometry.md) | bulky addresses and caps                             | update when hardware contradicts    |
| [`05-open-items.md`](05-open-items.md)       | open work only                                       | edited as things ship               |

Settled radio facts belong in `docs/reference/radios/` — cite, do not duplicate once promoted.

## Current strategy

Same product intent, three wires. OpenGD77 encode follows qdmr `Offset` + `encode()` (not the `0x30000` class comment) as a sidecar — **LCD proof is still hardware**. D890 `DigitalContact*` is the lookup-sized bank — do not invent a second User Database there.

## Rules of engagement

- **Preliminary until a dump or live Write.** Source-read rows say so. Inference says so.
- **A result that matches proves nothing.** Backup “1024 DMR contacts” matching `CONTACTS_MAX` does not prove the User Database is 1024.
- **qdmr is what qdmr writes, not what the 1701 does.** Trust `Offset` + `encode()` over class comments; still verify on radio.
- **Do not mix stock TYT DM-1701 maps with OpenGD77.** 10 000 contacts at `0x140000` is stock firmware.
- **One variable per expensive radio run.**
