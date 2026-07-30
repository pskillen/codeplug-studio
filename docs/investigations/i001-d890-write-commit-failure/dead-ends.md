# i001 — hypotheses ruled out

Kept so nobody re-derives them. Two of these were independently re-derived by different sessions during the
investigation itself, which is the argument for writing them down.

Run ids are in [`evidence.md`](evidence.md).

---

## The one that was wrongly filed here — and was the answer

**The sector markers.** Recorded as a dead end on 2026-07-29, on the strength of run `R/17-18`.

That clearance never held. The suppression flag never affected a transmitted byte, the test guarding it was
vacuous, and the commit that added the flag landed four hours _after_ the run that supposedly tested it. It
was untested, not cleared — and it was the root cause.

> **A dead-ends entry that was never actually tested is the most expensive error available**, because it stops
> anyone looking. When in doubt about whether a hypothesis was genuinely killed, leave it open and say why.

## About the write failure

| Hypothesis                                                  | Why it's dead                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A missing commit / erase / swap command in the protocol     | 19,960 CPS frames decoded, **zero unknown**. Checked at session start, session end, every address discontinuity, and for status-poll reads                                                                                   |
| CPS writes twice — once at `X`, once at `X+0x40000`         | 9,976 writes, 9,976 distinct addresses, zero `X`/`X+0x40000` pairs                                                                                                                                                           |
| `END` commits the staging window                            | `END` gets a bare `0x06`, identical in shape to a write ACK. Nothing follows                                                                                                                                                 |
| The radio never erases; programming is bit-clear-only       | Bit-_sets_ landed in later sessions, and 1738 of 1761 failed chunks needed only `1→0` transitions anyway                                                                                                                     |
| Frame pacing / flash settle time                            | 5 ms per frame applied on hardware; that write changed one byte on the whole radio, and it was operator knob churn. The premise — that `anytone-cps` is paced by `waitForReadyRead(50)` — was a misreading of a Qt _timeout_ |
| Transmission order / position                               | The first unit transmitted committed in one run; the last one failed                                                                                                                                                         |
| Some specific erase unit is cursed                          | `0x1000000` both failed and committed across runs                                                                                                                                                                            |
| Session-wide shadow limit; split the session per erase unit | Half right — there _is_ a shadow — but it is per-address, not per-session, so splitting cannot help                                                                                                                          |
| Exactly one erase unit fails per session                    | One run lost ten of thirteen                                                                                                                                                                                                 |
| The largest erase unit is the one that fails                | Dead **and inverted** — in that run the three largest committed and everything smaller failed                                                                                                                                |
| Per-unit staged volume threshold (147 vs 130 chunks)        | Coincidence of a single run. A later run committed nothing at any volume                                                                                                                                                     |
| Too much data per unit                                      | A unit with a **single** 16-byte chunk failed                                                                                                                                                                                |
| The failure is intermittent                                 | It was never a failure — every write diverted, every time, for three days                                                                                                                                                    |
| Some banks are directly writable and others are not         | 12 of 15 units had real work and zero committed. One mechanism, all banks                                                                                                                                                    |
| `channelData` and the zone A/B tables do commit             | Artefacts. `channelData`'s alias stride _is_ `0x40000`, so a diverted write is indistinguishable from a committed one for that bank. The zone A/B "commits" were the radio rewriting its own volatile state                  |
| A low verify mismatch count means most of the write landed  | 55 / 3481 while losing ten erase units. Mismatch count measures _disagreement_, not _commit_                                                                                                                                 |
| RMW-preserved spill blocks never land                       | A verify blind spot — the tool reported unread addresses as `0xff`                                                                                                                                                           |
| RMW-preserved blocks void the sector by volume              | One unit had 153 such blocks and committed; another had 2 and failed                                                                                                                                                         |
| Deleting scan lists changed the outcome of later writes     | Timeline artefact — an unrelated fix had landed 19 minutes earlier                                                                                                                                                           |
| Any Studio regression in the preceding 72 h                 | **This one was wrong and was retracted.** Inferred from a dump window that started after the regression. Direct operator experience — "I programmed this radio successfully before then" — beat the inference                |

## About the memory map

| Hypothesis                                                     | Why it's dead                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scan-list slots 100–249 live at `ScanListData + i × 0x200`     | A 1 MB sweep found no record above index 11, no name, no aliasing. RX groups _are_ flat to 250 in the identical shape; the scan-list bank is the odd one. `SCAN_LISTS_MAX` stays 100 |
| The radio clamps zones at 250                                  | It accepts 250–255. The vendor CPS is simply the writer that zeroes them, and matching CPS is the right call                                                                         |
| `TalkgroupData` block-hops like `ChannelData`                  | Not geometry — `0x3a40000` is the live bank's shadow window, equal whenever the last writer committed                                                                                |
| Scan-list records are zero-filled past the member array        | **Retracted, then un-retracted, and was right.** Killed on `anytone-cps` authority; hardware contradicted it. The member array is 100 slots to `0xF7`                                |
| The radio resolves scan lists per zone rather than per channel | Never evidence — an inference, retracted on operator correction                                                                                                                      |

## Standing warning about `anytone-cps`

The community port is a good source for **wire format** and a reasonable one for **advertised semantics**. It
is **not** evidence of firmware behaviour.

For the scan-list record alone it is wrong about the record length (`0xd0` vs `0xF9`), the member count (50 vs
100), and the location of `revert_channel` (it reads member slot 50 as an enum). Its write path is
byte-identical to Studio's, with no erase and no commit anywhere in the class, and has never been verified to
commit on hardware.

Treating it as ground truth cost this investigation a day and produced the one retraction that had to be
un-retracted.
