# i004 — DM-32UV serial Write: scan carriers + APRS upload ID

**Hub for this investigation.** Opened from live-radio report [#1223](https://github.com/pskillen/codeplug-studio/issues/1223).

**Status:** **Live.** Two Studio backups decoded (`D/2026-08-15-before`, `D/2026-08-15-after`). APRS endian is dump-proven. Unnamed lists are `0x00` vacant slots. Morning Walk **carrier** `0x19` is wrong (`0x41` vs expected `0x48`).

**Prime suspects (current):**

1. Scan-list unused slots `0x00`-filled — **seen on radio image**. Switch to NeonPlug `0xFF` fill (one variable).
2. Morning Walk Scan channel byte `0x19` = `0x41` (scanAdd, list id 0, stray bit 0) instead of `0x48` (list 2). Other carriers match `scanAdd | (n<<2)`.
3. APRS upload ID written 24-bit **BE** (`03 95 f7` = 234999). Firmware displays **LE** → `16225539`. NeonPlug encode is the same BE; Studio copied it.

**Next move:** (a) `0xFF`-fill scan bank; (b) write APRS ID little-endian and re-dump `0x332–0x334` + radio UI; (c) chase why carrier list index 2 encodes as `0x41`. Do not bundle these in one hardware run if you need to tell them apart.

|                        |                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opened**             | 2026-08-15                                                                                                                                                                 |
| **Closed**             | —                                                                                                                                                                          |
| **Tickets**            | [#1223](https://github.com/pskillen/codeplug-studio/issues/1223) (serial); [#1225](https://github.com/pskillen/codeplug-studio/issues/1225) (NeonPlug member `scanListId`) |
| **Intended behaviour** | Zone-derived scan carriers bind to their own list; unused scan slots stay vacant; APRS upload ID is the library contributing slot (`234999` private in this fixture).      |

---

## Read in this order

| File                                   | What it is                                           | Mutability                          |
| -------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| this file                              | status, strategy, rules                              | status line changes; rest is stable |
| [`01-findings.md`](01-findings.md)     | what is **currently believed**, each with a citation | append-only; dead rows move to 02   |
| [`02-dead-ends.md`](02-dead-ends.md)   | killed hypotheses                                    | append-only                         |
| [`03-ledger.md`](03-ledger.md)         | source-read / operator / future runs                 | **rows immutable**                  |
| [`05-open-items.md`](05-open-items.md) | open work only                                       | edited as things ship               |

Settled radio facts belong in `docs/reference/radios/baofeng/dm-32uv/` — cite, do not duplicate once promoted.

## Current strategy

Compare Studio serial encode to NeonPlug `dm32uv` (authoritative for this family). qDMR `DM32UVCodeplug::ScanListElement` is the **virtual image**, not the serial sparse map — use only as a negative check.

## Rules of engagement

- **NeonPlug serial encode is a reference for what NeonPlug writes, not proof of firmware.** Confirm on radio before changing tier-3.
- **qdmr DM-32 tables are a different memory world** (virtual image). Do not “fix” Studio Write from them. Same rule as [contacts-zones-lists.md](../../reference/radios/baofeng/dm-32uv/contacts-zones-lists.md).
- **A result that matches proves nothing.** Matching NeonPlug on named-list packing does not prove unused-slot fill is harmless.
- **One variable per expensive radio run.** Do not change fill _and_ member `scanListId` _and_ APRS patch in the same Write when trying to tell fixes apart.
- **APRS `16225539` is LE of BE `234999`.** Earlier kill used wrong hex (`0x039477`). Fix is little-endian write at `0x332–0x334`, not a different DMR ID.
