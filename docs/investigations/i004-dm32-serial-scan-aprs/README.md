# i004 — DM-32UV serial Write: scan carriers + APRS upload ID

**Hub for this investigation.** Opened from live-radio report [#1223](https://github.com/pskillen/codeplug-studio/issues/1223).

**Status:** **Parked** (2026-08-16). APRS LE fix **verified** on hardware. Scan vacant-slot clear (`+0x0B=0x00` after `0xFF` bank fill) shipped in branch but **did not** fix phantom blanks or Morning Walk→Glasgow Airband UI misbind. Write-verify shows carrier `0x19=0x48` (list 2) correct on wire — root cause of UI mismatch **open**.

**Prime suspects (parked):**

1. Phantom scan slots 14–32 had `+0x0B=0xFF` before vacant clear — **fixed in code**, hardware still wrong → firmware may use another vacant-slot rule or UI reads a different field.
2. Morning Walk carrier `scanListId` on wire is **list 2** per write-verify; radio UI shows Glasgow Airband (list 8) — investigate designated-TX reverse lookup vs byte `0x19`.
3. APRS upload ID LE — **done** (`03 95 f7` LE displays `234999`).

**Next move when resumed:** Read-back full channel bank at `0x95000` (sparse backup omits it); compare scan-list picker firmware behaviour; consider CPS round-trip of same build.

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
