# Evidence ledger

**Rows are immutable.** Once a row is written it is never edited. If a verdict turns out to be
wrong, add a **new** row referencing the old id and stating what changed.

| Prefix | Kind                          |
| ------ | ----------------------------- |
| `R/`   | Studio write + write-verify   |
| `D/`   | memory dump                   |
| `C/`   | wire capture                  |
| `O/`   | operator report (no artefact) |

**Timestamps in artefact names are UTC.** Operator notes and git commits may be BST (+1).

Raw dumps stay out of the repo (same policy as i001: `~/radio-artefacts/at-d890uv/` when present).
The write-verify markdown for `R/21-10` is small enough to keep under
[`artifacts/`](artifacts/write-verify-2026-08-12T21-10-54-050Z.md).

---

## Runs

| id        | Artefact                                                                                         | Config                                                                                                                                                                                                                                                                                                                                                                                                          | Result as reported                                                                                                                                                                                                                                  | What it actually established                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R/21-10` | [`write-verify-2026-08-12T21-10-54-050Z.md`](artifacts/write-verify-2026-08-12T21-10-54-050Z.md) | local Studio, Firefox, build `820c7938-6ad1-48b9-834c-402520ebef9f`, egress `29976603-1f03-4352-b4ad-1c40f90781d4`, profile `radio-io-at-d890uv`, branch the operator was testing (ephemeral-radio-info phase 3 stack). Staging captured 2026-08-12T21:06:52.172Z; measured 2026-08-12T21:10:27.671Z. Verify: new PROGRAM session, 2 987 056 bytes in 27.0s, digital contacts and analog address book excluded. | Overall **FAIL**, 1 / 2603 chunk mismatch, sentinels PASS, all `must-change` units `committed`. Single mismatch `channelData` `0x1080320` byte2 `ff`→`fd`. Cache vs last Download: 1634 blocks differ.                                              | (1) Transport ACKs and Studio’s success path ran. (2) Almost all staged chunks match the post-write read — this is **not** the i001 “bytes landed in the shadow bank” signature. (3) The radio still presented Program Error after this write (operator). (4) Does **not** establish which commit introduced the brick. (5) Does **not** establish that the AES-index byte caused the error. |
| `R/21-40` | [`write-verify-2026-08-12T21-40-21-629Z.md`](artifacts/write-verify-2026-08-12T21-40-21-629Z.md) | **dev** `https://dev.codeplug.mm9pdy.net`, Studio `d981444`, same build `820c7938-…` / same egress. Operator: write used **stashed memory**. Staging 2026-08-12T21:38:11.681Z; measured 2026-08-12T21:40:13.839Z. 2 987 056 bytes in 25.1s.                                                                                                                                                                     | Overall **PASS**, 0 / 2909 mismatched, sentinels PASS. Units with work `committed` (`0x1000000` 896, `0x1080000` 371, `0x3480000` 5). Cache vs last Download: 2112 blocks. Extra units vs `R/21-10`: `0x1f80000`, `0x3680000` (both `no-evidence`). | (1) Same build as the brick, different writer (main+stash vs phase-3 assemble-from-`0xff`). (2) Firmware booted the result (operator). (3) Does **not** prove main is safe on a healthy radio — the radio was already in Program Error. (4) Stash was in the loop; this is not “main without hydration.”                                                                                     |
| `R/22-36` | [`write-verify-2026-08-12T22-36-39-311Z.md`](artifacts/write-verify-2026-08-12T22-36-39-311Z.md) | local Studio, same build/egress, PR #1126 (`1125/pskil/d890-zonehide-visible`). Staging 2026-08-12T22:32:53.886Z; measured 2026-08-12T22:36:18.347Z.                                                                                                                                                                                                                                                            | FAIL 1/2605, sentinels PASS, same `0x1080320` mismatch. `zoneHide` match (2 chunks). `radioIdSet` **not_written**. Unit `0x3480000` must-change 1 committed.                                                                                        | (1) #1125 reached modelled staging for ZoneHide. (2) Radio still Program-Error’d (operator). (3) `not_written` on RadioIdSet is not evidence it stayed at the healthy `01` — dump `D/22-37` is all-`0xff`.                                                                                                                                                                                   |

## Operator reports

| id                     | When       | What was reported                                                                                                                                                             | What it actually established                                                                                                                      |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `O/main-ok`            | 2026-08-12 | Writes from `origin/main` did not brick this radio.                                                                                                                           | A regression window exists: `origin/main` (post-#1116) vs this stack. Not a controlled A/B on the same hour; still the best bound we have.        |
| `O/stack-brick`        | 2026-08-12 | Write on the phase-3 stack → success toast → reboot → Program Error + Confirm. Init → EU commercial `0x00`; want EU Amateur `0x04`; CPS recovery sequence as previously used. | Symptom and recovery cost. Does not identify the byte that the firmware rejected.                                                                 |
| `O/prior-undocumented` | 2026-08-12 | Operator previously spent ~two weeks debugging D890 soft bricks of this class and did not write it down.                                                                      | Process debt. This directory exists so that does not happen again. No technical claims from that period are in findings — they were not recorded. |
| `O/recover-via-main`   | 2026-08-12 | Official CPS is not to hand. Recovery write will be Studio on `origin/main` in the dev env.                                                                                   | Intent only. Superseded as a _plan_ by `R/21-40` / `O/recovered` — row kept because it was the intent at the time.                                |
| `O/zero-visible-zones` | 2026-08-12 | Operator: a codeplug with zero zones is **known** to be rejected with this Program Error. May not be the only issue; it is definitely a culprit.                              | Firmware behaviour (W6). Combined with `D/21-37` `ZoneHide` all-`0xff`, this incident had zero **visible** zones despite 11 `ZoneSet` bits.       |
| `O/1126-still-bricks`  | 2026-08-12 | PR #1126 write: still Program Error.                                                                                                                                          | ZoneHide fix insufficient.                                                                                                                        |

## Dumps

Raw binaries in `~/Downloads/` (unzipped export-all). Not copied into git.

| id        | Artefact                                                 | Source                                                                                  | Why it matters                                                                                           |
| --------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `D/21-37` | `~/Downloads/d890-memory-dump-2026-08-12T21-37-14-239Z/` | `/debug/d890-erase-probe` Export all, **before** recovery write, radio in Program Error | Last copy of the rejected image. ZoneHide/RadioIdSet all-`0xff`; 11 zones; AES mostly `0xff`.            |
| `D/21-41` | `~/Downloads/d890-memory-dump-2026-08-12T21-41-34-471Z/` | same tool, **after** `R/21-40`                                                          | Post-recovery image the firmware boots. Diff vs `D/21-37` is the recovery write’s effect.                |
| `D/22-37` | `~/Downloads/d890-memory-dump-2026-08-12T22-37-16-573Z/` | Export all after `R/22-36` (#1126), Program Error                                       | #1125 on the wire: ZoneHide all-`0x00`. Only diff vs `D/21-37` is zoneHide. RadioIdSet still all-`0xff`. |

## Code state (for `R/21-10`)

Not a hardware run. Recorded so a later session can match the binary.

| id         | Ref                                                                                                       | What it actually established                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S/phase3` | branch `876/pskil/radio-info-ephemeral`, tip after rebase `2f596473`, stacked on `origin/main` `3d993caa` | The code the operator intended to test. Exact SHA of the running Vite tab was not captured in the verify report (`Studio: local (local)`). If the tab was stale, `R/21-10` did not test `2f596473`. |

---

## Reproducing the comparison

Write-verify is produced by the in-app D890 write-verify flow after upload (`writeMemoryVerify.ts`).
Authority is **staging chunks actually transmitted**, not the projected image.

Trap: `committed` on an erase unit means `must-change` chunks differ on flash vs the pre-overlay
live baseline. It does not mean the firmware will boot the codeplug. `R/21-10` is the exhibit.

Read-only dumps: `/debug/d890-erase-probe` → **Export all (excl. Digital Contacts) → ZIP**.
Filenames are ISO-stamped. Store the ZIP next to other radio artefacts (not in git) and add a
`D/` row. Do not use Paint / Mark / Probe write block sizes on this radio.

| `O/hw-pass-p2` | 2026-08-13 | Operator: Write on `875/pskil/d890-write-base-live` @ `1920341f` ([PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118)) — encode onto in-session download cache — radio booted. | (1) In-session cache encode is a writer this firmware accepts. (2) Does not by itself prove later stack phases; those were rebased onto this tip afterward. |
| `O/opengd77-zero-sectors` | 2026-08-13 | Operator: OpenGD77 DM-1701 Write after drop-stash did not kick to All Channels; Contacts wire preview name→callsign did not change radio labels. | Same W3 class: overlay that does not change FLASH (ignored name mode, then 0 dirty sectors). Fixed on [PR #1133](https://github.com/pskillen/codeplug-studio/pull/1133) (`20e8249d`). Not a D890 Program Error. |

## Code state (correction)

| id        | Ref                                                                                                                                                                        | What it actually established                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `S/p2-w3` | [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118) tip `1920341f` (`encodeAtD890WriteImageFromDownloadCache`; refuse empty cache; no `0xff` Write fallback) | The writer `O/hw-pass-p2` exercised. First phase-2 landing (`assembleAtD890WriteImage` fill `0xff`) is what `R/21-10` / `R/22-36` exercised. |
