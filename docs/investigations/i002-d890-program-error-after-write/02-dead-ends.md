# Dead ends — do not re-chase

**Append-only while live.** This archive keeps the killed list so the next Program Error is not
re-litigated as i001 markers or as ZoneHide-only.

This file exists because i001 filed the actual root cause as a dead end on a run that never tested
it. When in doubt, leave the hypothesis open.

---

## Killed on this incident

| Hypothesis                                                                                                                                            | Killed by                         | Why it's dead                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LocalInfo / frequency mode was overwritten by the brick or recovery write                                                                             | `D/21-37` vs `D/21-41`; `R/21-40` | `localInfo.bin` is byte-identical. Byte `0x03` is `0x03` both sides. Both verifies list LocalInfo `not_written`.                                             |
| ZoneHide-all-hidden was **the remaining** cause after recovery (i.e. fixing only ZoneHide would unbrick)                                              | `R/22-36`; `D/22-37`              | #1125 reached the wire (`ZoneHide` all-`0x00`, 11 zones visible). Radio still Program-Error’d. W6 still true as a firmware behaviour; it was not sufficient. |
| Phase 3 Radio Info UI caused the brick                                                                                                                | `O/hw-pass-p2`                    | Brick reproduced on the phase-2 write path; Radio Info was not required.                                                                                     |
| Phase 1 strip-on-load caused the brick                                                                                                                | F1; `O/hw-pass-p2`                | The writer that bricked was assemble-from-`0xff`, not bag-strip-on-load.                                                                                     |
| RadioIdSet-all-`0xff` is _the_ reject reason                                                                                                          | F1; F2; F4                        | Measured on the brick dumps; overlaying a live cache (healthy occupancy) unbricked without a zeros overlay.                                                  |
| Unmodelled ID banks should be replaced with empty occupancy (#1129 as implemented)                                                                    | E5; E6; F4                        | Studio does not model D890 radio IDs. Zeros occupancy + live records is a new inconsistent image. Parked.                                                    |
| Unmodelled channel bytes at `0xff` is _the_ reject reason                                                                                             | F1; F2                            | Channel `prior` from a live cache is radio-shaped; #1132 was a symptom of the blank map.                                                                     |
| Per-field `0xff` patches on [PR #1126](https://github.com/pskillen/codeplug-studio/pull/1126) (#1125 ZoneHide, then #1130–#1132) were the product fix | `O/1126-still-bricks`; F1; F2     | ZoneHide reached the wire and still bricked. Encode-base was the remaining cause. Those PRs/issues stay parked.                                              |
| The 1-byte AES-index mismatch caused the brick                                                                                                        | `D/21-37`; V3                     | Slot 134 `0xfd` vs staged `0xff` is real. 180 other occupied slots already had AES `0xff`.                                                                   |

## Still true, not a dead end

| Fact                                               | Why it stays                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero **visible** zones is a firmware reject        | **Operator fact** (W6). This incident _also_ had that state on `D/21-37`. After #1126 it did **not** and still bricked — so it is not the remaining cause, but the firmware behaviour stands. |
| Studio transmitted sector-management markers again | No wire capture of `R/21-10`. Suppression is structural after i001; still unproven for this write. Not needed for F1.                                                                         |
