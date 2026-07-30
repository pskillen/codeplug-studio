# i001 — evidence

Condensed from the working ledger. Only the runs and captures that a conclusion still rests on; the ones that
produced retracted findings are kept where the retraction is instructive.

**Timestamps in artefact names are UTC. Commit timestamps are local (BST, +1).** Reconciling those two is what
resolved the investigation — see the parent README, process failure 3.

Raw dumps, verify reports and `.pcapng` captures are **not** in the repo — they live in
`~/radio-artefacts/at-d890uv/`, with an `INDEX.md` mapping every id below to its file. Deliberately outside
the repo: a cleanup agent deleted the working directory on 2026-07-30 and took the decoded CPS frame JSONs
with it.

---

## Decisive runs

| id               | Artefact                                | Configuration                                         | What it established                                                                                                                                                                                                         |
| ---------------- | --------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R/07-53`        | `write-verify-2026-07-29T07-53-01-652Z` | defaults                                              | 126 mismatches, all the `auto_scan` bit on channels 0–127. Read at the time as a deterministic single-unit failure — **that reading was wrong**, but the run is the cleanest picture of the symptom                         |
| `R/12-25`        | `…T12-25-27-399Z`                       | post-#845                                             | Reported 55 / 3481 mismatches — reads as a 98.4% pass. The independent dump diff showed **ten of thirteen erase units changed zero bytes**. The origin of "a low mismatch count is not evidence of commit"                  |
| `R/13-08`        | `…T13-08-09-818Z`                       | 5 ms inter-frame pacing                               | Reported twelve units `committed`. The dump diff showed **1 byte changed on the entire radio**, and it was operator knob churn. All twelve verdicts false — the verify baseline was the stale download cache, not the radio |
| `R/17-18`        | `…T17-18-42-229Z`                       | marker suppression _believed_ active — **it was not** | Zero of 12 units with work committed, `channelData` included. Killed the idea that some banks commit and others divert. **Wrongly recorded as clearing the sector-marker hypothesis**                                       |
| **`R/30-06-56`** | `write-verify-2026-07-30T06-56-39-871Z` | **markers genuinely suppressed**                      | **The fix.** PASS, 0 / 2927. 12 of 12 units `committed`, `must-change == changed` exactly. Unit `0x1000000` staged 1024 chunks — the exact prediction                                                                       |
| **`R/30-nc`**    | none — the write did not complete       | markers deliberately restored                         | **Causation proven.** _"Program error please initialise the radio!"_ → factory reset                                                                                                                                        |

## Decisive dumps and probes

| id                          | Artefact                                    | Written by       | What it established                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D/08-47`                   | `d890-memory-dump-2026-07-29T08-47-45-764Z` | **official CPS** | Control: ChannelData block 0 changed 418 bytes and the `auto_scan` count dropped 137 → 11. **The radio's flash is healthy and the defect is entirely Studio-side.** Also the ground-truth scan-list record layout |
| `D/11-50`                   | `…T11-50-53-192Z`                           | **official CPS** | Bank capacities. Also the 1 MB sweep proving scan-list slots above ~100 are not flat-addressed                                                                                                                    |
| `P/14-50`                   | `d890-aliasProbe-2026-07-29T14-50-41-654Z`  | —                | **Found the whole Studio write image at `+0x40000`**, in every probed bank. Identified by a timing constant of `0x1e` (30 ds) that nothing but Studio writes                                                      |
| `D/29-18-03` → `D/30-06-57` | dumps either side of `R/30-06-56`           | Studio           | **32,933 bytes changed on the live bank** across 18 regions, including every occupancy bitmap. `talkgroupData` split at `0x40000`: 6,595 live / 176 window                                                        |
| `P/30-06-58`                | `d890-aliasProbe-2026-07-30T06-58-45-439Z`  | —                | Post-fix: the live bank holds Studio's payload _and_ so does the `+0x40000` window — the same signature an official CPS write produces                                                                            |

## Added after closure — 2026-07-30 factory reset

The negative control (`R/30-nc`) factory-reset the radio. Recovering it produced two dumps that answer a
separate open question and add supporting evidence for the mechanism.

| id           | Artefact                                    | Written by              | What it established                                                                                                                                                                                   |
| ------------ | ------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D/30-09-25` | `d890-memory-dump-2026-07-30T09-25-39-477Z` | radio (on-radio "init") | **No DM-32-style address drift** (#716). Every region except `amZoneScan` still holds content at its expected `D890_MAP` base, and `localInfo` is byte-identical — the device serial survives a reset |
| `P/30-09-27` | `d890-aliasProbe-2026-07-30T09-27-18-869Z`  | —                       | Post-init, the `zonesName` `+0x40000` window holds `12 34 56 78` followed by `"My Radio"` — an unrecognised magic plus a factory zone name                                                            |
| `D/30-09-30` | `d890-memory-dump-2026-07-30T09-30-52-409Z` | **official CPS**        | Scratch codeplug on a freshly-initialised radio. `"Scan List 1"` at `0x2100000`, `"Zone 1"` at `0x3600000` — content exactly at the documented bases                                                  |
| `P/30-09-32` | `d890-aliasProbe-2026-07-30T09-32-05-991Z`  | —                       | After the CPS write the window **mirrors the live bank byte-for-byte** — CPS reaches both, as in `P/30-06-58`                                                                                         |

**Supporting the A/B sector inference (still not proof).** Post-init the `zonesName` window held factory
content and a `12345678` magic while the live base held something else; after one CPS write both hold the
same bytes. That is the behaviour an A/B ping-pong pair would show, with the reset having programmed one
side and CPS then programming the other. The `12345678` magic is unidentified and was not pursued.

### A second, unrelated cause of the same error message

⚠️ **Do not read this record as "_Program error please initialise the radio!_ means marker writes".**

A Studio write on 2026-07-30, after the reset and on post-`R/30-nc` code that **cannot** transmit the markers,
produced the same message. The cause was a codeplug with **channels but zero zones** — an invalid state for
this firmware, unrelated to i001. Studio writes it faithfully; the radio rejects it. A pre-write refusal is
ticketed, and the symptom is cross-referenced in
[`flash-sectors.md`](../../reference/radios/anytone/at-d890uv/flash-sectors.md).

**This retracts a hypothesis offered during recovery.** It was proposed that Studio could not program a
factory-reset radio because the 17 erase units it does not model (`cps-wire-capture.md`) were left at factory
defaults. That is **unsupported** — the zero-zone codeplug accounts for the failure without it. Whether Studio
can program a D890 from bare metal is **untested**, not broken, and the "restore from official CPS first"
advice given during recovery rests on the unmodelled-bank reasoning rather than on evidence.

## Wire captures

Three USBPcap captures of the official Anytone CPS, decoded with `dev-tools/wire-capture-decoder/`.

| id        | Session                                                                                            | Frames |
| --------- | -------------------------------------------------------------------------------------------------- | -----: |
| `C/read`  | one full read-back                                                                                 |  8,026 |
| `C/small` | one channel name edited, then written — **stopped mid-session**, no `END`, secondary evidence only | 13,990 |
| `C/full`  | the operator's real full codeplug, ran to completion — **primary evidence**                        | 19,960 |

See [`cps-wire-capture.md`](cps-wire-capture.md).

---

## Method notes worth reusing

These are what made the evidence trustworthy once it was, and each was learned by getting it wrong first.

- **A result that matches proves nothing.** Only bytes that _had to change_ are evidence. A staged byte equal
  to what is already on flash is equally consistent with the write doing nothing. This invalidated two
  separate headline findings four days apart, and it is the single easiest mistake to repeat.
- **Dump immediately before and immediately after every write.** The diff is the only commit evidence
  independent of the tooling being debugged, and it costs one command.
- **Make the input differ from the target in every bank you care about**, or units can only report
  "no evidence". One run was ~40% uninformative because the same codeplug was written twice. Writing from the
  vendor tool first is the reliable way to guarantee real work in every bank.
- **Distinguish "no evidence" from "pass".** An erase unit where nothing had to change cannot succeed. The
  verify tool originally reported those as `committed`.
- **`talkgroupData` spans both the live bank and its `+0x40000` window.** A naive per-file diff conflates
  them, and did produce one wrong conclusion. Split at offset `0x40000`.
- **Don't read overall behaviour as evidence in a hybrid state.** For most of this investigation the radio
  held Studio's channels and CPS's bitmaps, and worked correctly for reasons that had nothing to do with our
  writes.
- **A reference implementation is evidence of what it does, not of what the firmware does.** The community
  `anytone-cps` port was treated as ground truth and is wrong on at least three counts about one record. Its
  own write path is byte-identical to Studio's and has never been verified to commit on hardware either.
