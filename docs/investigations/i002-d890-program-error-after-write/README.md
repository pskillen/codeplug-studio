# i002 — AT-D890UV Program Error after Studio write

**Opened:** 2026-08-12  
**Closed:** 2026-08-13  
**Cost:** one calendar day, three write-verify runs, three region dumps, two Program Error recoveries via `main`+stash, a parked symptom PR ([#1126](https://github.com/pskillen/codeplug-studio/pull/1126))  
**Outcome:** Phase 2 encoded the modelled overlay onto a virgin `0xff` map. The requirement was overlay on the in-session Read. That work was not finished on the first landing.

**Technical conclusion lives in the radio-read-write hub** ([AT-D890UV adapter row](../../features/radio-read-write/README.md) — write base is this PROGRAM session’s download cache, never a virgin `0xff` assemble) **and [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118).** Firmware Program Error is still not diagnostic — see [i001](../i001-d890-write-commit-failure/README.md) and [flash-sectors.md](../../reference/radios/anytone/at-d890uv/flash-sectors.md).

Promoted from live notes in `tmp/investigations/i002-d890-program-error-after-write/` (gitignored). Number **i002** is used; do not reuse.

|                   |                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**       | Studio reported write success; radio rebooted to _Program Error Please Initialize The Radio_                                                                                                                                                       |
| **Root cause**    | `assembleAtD890WriteImage` filled `0xff`, then the same codecs “left what was already in the image.” Sparse RMW only preserves bytes **outside** the modelled overlay                                                                              |
| **Introduced by** | First landing of ephemeral-radio-info phase 2 ([#875](https://github.com/pskillen/codeplug-studio/issues/875) / [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118)) — drop stash without a radio-shaped encode prior                |
| **Masked by**     | The old stash _was_ radio-shaped, so the codecs looked fine; dump diffs looked like independent occupancy/ZoneHide/AES bugs                                                                                                                        |
| **Fixed by**      | `encodeAtD890WriteImageFromDownloadCache` — overlay on this PROGRAM download cache; empty cache → `download()` once; still empty → refuse Write, no `0xff` fallback ([PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118) `1920341f`) |

---

## What the failure looked like

Same build `820c7938-6ad1-48b9-834c-402520ebef9f` / egress `29976603-1f03-4352-b4ad-1c40f90781d4`:

1. Write on the ephemeral-radio-info stack → success toast → Program Error + Confirm.
2. This incident **did not Confirm** (Confirm is believed to init the radio into EU commercial frequency mode).
3. Recovery: Studio on **dev `origin/main` using stashed memory** (`R/21-40`) — radio booted, verify PASS.

Write-verify on the brick (`R/21-10`, `R/22-36`) was **not** the i001 shadow-bank signature: 1 / ~2600 staged chunks mismatched, every `must-change` erase unit `committed`. The radio still rejected the image on reboot.

Dumps of the rejected image (`D/21-37`, later `D/22-37`) showed radio-shaped gaps filled with assemble `0xff`: ZoneHide all-hidden, RadioIdSet all-set, ChannelSet bits 4000+ `ff`, occupied-channel AES index almost all `0xff`. LocalInfo / frequency-mode byte was untouched.

---

## Root cause

Requirements for dropping the hydration stash: unmodelled bytes come from an **in-session** read; modelled overlay runs **on that image**.

The first phase-2 landing implemented “no bag” as **fill `0xff` then encode**. `encodeAtD890ProjectionOntoImage` still patches “what’s already in the image.” On a stash that was a previous Read, unmodelled fields stayed radio-shaped. On `0xff`, they stayed `0xff`. `applyAtD890WriteImageToCache` then copied that modelled overlay in as intent. Sparse erase-unit RMW cannot resurrect co-residents **inside** the overlay.

Zero **visible** zones (ZoneHide all-`0xff` despite 11 `ZoneSet` bits) is a **confirmed firmware reject** (W6) and was present on the first brick. [PR #1126](https://github.com/pskillen/codeplug-studio/pull/1126) put ZoneHide on the wire (`D/22-37` only `zoneHide.bin` changed vs the first brick). The radio still Program-Error’d. Necessary, not sufficient.

---

## The proof

| Writer                                                                       | Encode prior                        | Outcome                                               |
| ---------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Phase-2 first landing / phase-3 stack                                        | Virgin `0xff` map                   | Program Error (`R/21-10`, `R/22-36`)                  |
| `origin/main` + stash                                                        | Radio-shaped bag                    | Boots (`R/21-40`) — recovery, not a healthy-radio A/B |
| [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118) `1920341f` | This PROGRAM session download cache | **HW PASS** (`O/hw-pass-p2`)                          |

One variable that discriminated: whether the encode prior was radio-shaped. Per-field `0xff` patches (#1125 ZoneHide, #1129 zeros RadioIdSet, #1130–#1132) were not that variable.

---

## Why it felt anticlimactic

The bug was a **half-finished phase**, not a new flash mystery.

### 1. W3 implemented as “blank flash”

The plan said overlay on the in-session base. The first landing assembled a blank map and reused codecs that preserve prior bytes. Tests could pass on constructed images without ever proving the download cache was the Write prior.

> **Dropping stash is not encoding onto `0xff`.** The prior is the live session image (D890: download cache; OpenGD77: pre-write FLASH read). Refuse Write if that image is missing.

### 2. Symptom tickets looked like the fix

Dump diffs were real. ZoneHide-all-hidden matched a known firmware reject (W6), so [#1125](https://github.com/pskillen/codeplug-studio/issues/1125) shipped and **reached the wire** — then still bricked. RadioIdSet-all-set invited a zeros overlay ([#1129](https://github.com/pskillen/codeplug-studio/issues/1129)) that would have violated “Studio does not model these IDs.”

> **A dump delta is not a product invariant.** Occupancy and unmodelled fields should stay byte-identical when Studio does not model them. Do not invent a zeros policy from an `0xff` fill.

### 3. Verify `committed` still does not mean the firmware will boot

i001 already taught this. `R/21-10` is the exhibit again: 1 mismatch, all work units `committed`, Program Error anyway.

> **Do not treat write-verify PASS/near-PASS as “the radio accepted the codeplug.”** Boot is the test. Dump before/after.

### 4. Same lesson, other radio, quieter failure

OpenGD77 dirty-sector Write against a prior that already matched (and a contact name mode that Write ignored) programmed **0 FLASH sectors**. The 1701 stayed in a zone — the local “did we write?” indicator. Same W3 class, no Program Error string.

---

## What else this produced

| Finding                                                                      | Where it went                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D890 Write encode prior is the in-session download cache; no `0xff` fallback | [radio-read-write hub](../../features/radio-read-write/README.md), [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118)                                                                                                       |
| Zero visible zones → Program Error                                           | firmware fact W6; still true; [#880](https://github.com/pskillen/codeplug-studio/issues/880)                                                                                                                                               |
| OpenGD77 overlay on live pre-write FLASH; 0 dirty sectors must be visible    | [opengd77 protocol.md](../../reference/radios/opengd77/protocol.md), [PR #1133](https://github.com/pskillen/codeplug-studio/pull/1133)                                                                                                     |
| Recover Program Error with `main`+stash; do not Confirm on-radio init        | **Still open** as radio-reference copy — see [`05-open-items.md`](05-open-items.md) I002-7                                                                                                                                                 |
| Capture running SHA in write-verify reports                                  | **Still open** — I002-6                                                                                                                                                                                                                    |
| Parked ZoneHide / RadioIdSet-zeros / ChannelSet-tail / channel-prior tickets | [#1126](https://github.com/pskillen/codeplug-studio/pull/1126), [#1129](https://github.com/pskillen/codeplug-studio/issues/1129)–[#1132](https://github.com/pskillen/codeplug-studio/issues/1132) — do not continue as the encode-base fix |

## Further reading

- [`01-findings.md`](01-findings.md) — measured claims (W/V/C/D/E) plus closed F1–F5
- [`02-dead-ends.md`](02-dead-ends.md) — hypotheses ruled out
- [`03-ledger.md`](03-ledger.md) — runs, dumps, operator reports (rows immutable)
- [`05-open-items.md`](05-open-items.md) — leftovers that are not the brick
- [`artifacts/`](artifacts/) — write-verify markdown for `R/21-10`, `R/21-40`, `R/22-36`
- [i001](../i001-d890-write-commit-failure/README.md) — same error string, different cause (sector markers)
