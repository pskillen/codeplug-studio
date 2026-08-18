# i003 — Directory rows vs lookup banks (OpenGD77 1701 / DM-32 / AT-D890)

**Hub for this investigation.** Promoted from `tmp/features/baofeng-contacts-export/investigation.md` (scratch). Number **i003** is used; do not reuse.

**Status:** **Live.** OpenGD77 User Database **Write ACK’d on a 1701** ([#1211](https://github.com/pskillen/codeplug-studio/issues/1211)). Incoming-call LCD is **no longer blocked only by Talker Alias**: operator reports names still absent on a repeater **without** TA (MD-9600, 2026-08-18). That is **not** yet proof the lookup store is wrong — the same session’s Write used Digital contacts **None**, which also skips User Database (`i007` / [#1249](https://github.com/pskillen/codeplug-studio/issues/1249)). DM-32 LCD (H4) unproven. No FLASH dump of `0x50000`.

**Prime suspect (remaining):** incoming-call LCD (H8 / H9). Discriminate **UDB never programmed** (None / RadioID off) from **programmed but firmware does not display** (occupied `Id` header on FLASH, then silent-repeater LCD). D890 stays single-bank.

**Next move:** [E1](errands/01-md9600-udb-then-silent-lcd.md) — one variable on MD-9600: Write **RadioID** (or Both, until #1249) so User Database `'X'` actually runs; Backup inspect occupied User Database / `Id` at `0x50000`; **then** the same silent repeater. Do not treat today’s LCD miss as encode failure until that Write is confirmed.

|                        |                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opened**             | 2026-08-15                                                                                                                                                                                                                                                                                                                                                             |
| **Closed**             | — (live)                                                                                                                                                                                                                                                                                                                                                               |
| **Tickets**            | [#1211](https://github.com/pskillen/codeplug-studio/issues/1211) OpenGD77 1701 (closed, bank targeting) · [#1220](https://github.com/pskillen/codeplug-studio/issues/1220) DM-32 (closed) · [#1249](https://github.com/pskillen/codeplug-studio/issues/1249) split-bank Write always includes library contacts · D890 bank targeting has no new ticket (looks correct) |
| **Intended behaviour** | Library contacts (+ TGs) in the **main contact bank**. Directory in a **lookup** store for incoming / group-call display only. **Dual bank:** keep the same DMR ID in both stores. **Single bank:** dedupe on `digitalId` (library wins).                                                                                                                              |

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
| [`errands/`](errands/README.md)              | two-way briefs and reports                           | one file per errand                 |

Settled radio facts belong in `docs/reference/radios/` — cite, do not duplicate once promoted.

## Current strategy

Same product intent, three wires. OpenGD77 encode follows qdmr `Offset` + `encode()` as a sidecar; 1701 **Write ACK’d** those sectors (`R/2026-08-15-1701-udb-ack`). **LCD proof is still hardware.** A silent repeater now exists (`O/2026-08-18-lcd-silent`); the missing discriminator is whether User Database FLASH was programmed on that radio. Talker Alias remains a mask on other paths — it is not a hang-up for this MD-9600 observation.

## Rules of engagement

- **Preliminary until a dump or LCD lookup.** A Write ACK is not a dump and is not incoming-call proof.
- **Digital contacts = None also skips User Database.** LCD blank after that Write is not evidence the lookup encode is wrong (i007 C4). Confirm `'X'` / occupied `Id` header first.
- **Talker Alias can mask Db lookup** — but a silent repeater that still shows no name is a different experiment (`O/2026-08-18-lcd-silent`).
- **A result that matches proves nothing.** Backup “1024 DMR contacts” matching `CONTACTS_MAX` does not prove the User Database is 1024.
- **qdmr is what qdmr writes, not what the 1701 does.** Trust `Offset` + `encode()` over class comments; still verify on radio.
- **Do not mix stock TYT DM-1701 maps with OpenGD77.** 10 000 contacts at `0x140000` is stock firmware.
- **One variable per expensive radio run.**
