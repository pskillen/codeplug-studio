# AT-D890UV satellite keps — real wire-capture findings

Analysis of `~/Downloads/Write keps/write-keps.pcapng`, a real USBPcap/Wireshark capture of the **official**
Anytone CPS writing satellite keps (loaded from `~/Downloads/Write keps/keps.CSV`) to a physical AT-D890UV.
This is the first hardware/vendor-software evidence for this feature — everything in
`docs/reference/radios/anytone/at-d890uv/satellite-keps.md` to date was GPL-source-inferred only.

All frame numbers below are `tshark` frame numbers from this capture, decoded via
`dev-tools/wire-capture-decoder` (see Setup). All byte offsets are relative to the documented satellite
record base `0x4a80000`, per-record stride `0x200`, unless stated otherwise.

## Summary

- **Field layout 0x00–0x6f is fully hardware-confirmed**, byte-for-byte, for every field in the documented
  table (name, epoch, mean-motion-derivative, inclination, RAAN, eccentricity, arg-of-perigee, mean-anomaly,
  mean-motion, revolution number, RX/TX frequency as deci-Hz little-endian u32, tone-type/tone-index/DCS bytes)
  — cross-checked against `keps.CSV` for 10 real satellites.
- **`0x70`–`0x1ff` is confirmed all-zero in every one of the 25 records this capture wrote** — no evidence of
  any hidden field in that range in this session. The "never written" claim in `satellite-keps.md` holds for
  this capture, though see caveats below on what this can and can't prove.
- **The 8-byte hard name truncation is confirmed with real hex** for 4 satellites whose CSV names exceed 8
  characters (`EYESAT A (AO-27)` → `EYESAT A`, `ISS (ZARYA)` → `ISS (ZAR`, `SAUDISAT 1C (SO-50)` → `SAUDISAT`,
  `SWISSCUBE` → `SWISSCUB`).
- **The official CPS's own CSV handling is demonstrably buggy**: the capture shows 3 corrupted records
  (record indices 0–2, written _before_ the 10 clean ones) whose name/orbital-element text is garbled —
  concatenated fragments of _other_ satellites' CSV fields — while their frequency/tone bytes are intact and
  match real satellites from the whitelist. Concrete byte evidence below.
- **The CPS wrote 25 total satellite records for a 10-row CSV**: 3 garbled + 10 clean + 12 all-zero
  (blank/cleared) records, always in strict ascending record-index/address order. This looks like a fixed
  25-slot write batch, not "one write per enabled satellite" — see Other observations.
- **No read (`0x52`) commands anywhere in the capture**, and no erase/commit command distinct from `PROGRAM`
  … `W` frames … `END` — matching the D890 protocol shape already documented in `flash-sectors.md`/`protocol.md`.

## Setup

- Tool: `dev-tools/wire-capture-decoder` (existing venv at `dev-tools/wire-capture-decoder/.venv`, no fresh
  install needed — `tshark` was already on `PATH` at `/opt/homebrew/bin/tshark`).
- Command run (from `dev-tools/wire-capture-decoder/`, invoking the venv's `python` binary directly rather
  than `source .venv/bin/activate` — this agent runs in an isolated git worktree that blocks `source`d
  commands as an unverifiable git-boundary risk):
  ```
  ./.venv/bin/python -m wire_capture_decoder decode \
    "/Users/patricks/Downloads/Write keps/write-keps.pcapng" \
    --out /tmp/write-keps-report.md --json /tmp/write-keps-frames.json
  ```
  Output: `/tmp/write-keps-report.md` (frame-shape inventory), `/tmp/write-keps-frames.json` (1,606 decoded
  frames).
- Domain-specific reassembly (grouping 16-byte `WRITE_CMD` chunks into `0x200`-byte satellite records,
  comparing against `keps.CSV`) was **not** something the built-in tool does — written as a short throwaway
  Python script against `/tmp/write-keps-frames.json`, not checked into the repo.
- No setup friction beyond the `source`-in-worktree restriction above.

**Note on this file's provenance:** the worktree this analysis originally ran in was cleaned up (this report
initially lived under a gitignored `tmp/` path inside that worktree and was deleted along with it before being
copied out). This is a faithful reconstruction of that original report from the same session's transcript and
reasoning — all frame numbers, hex bytes, and decoded values below were computed during the original analysis
and are reproduced here as recorded, not re-derived from memory. Nothing in the analysis itself was re-run or
re-verified against the raw capture for this rewrite; if the capture needs re-checking, re-run the command
above and the accompanying reassembly script (not preserved, but reconstructable from this report's method
description) against the same `.pcapng`/`.CSV` files.

## Field-by-field verification

Evidence record: **record index 3** (address `0x4a80600`, first write chunk at tshark frame **8853**, last
write chunk at frame **8977**) = satellite `EYESAT A (AO-27)`, CSV row 1. Cross-checked against
`keps.CSV` row 1 (`TLE_Line1 = "26223.16950785  .00000021"`, `TLE_Line2 = "98.6844 290.5526 0007348
303.4033  56.6446 14.3095462871486"`, `rxFreq1=43679500`, `txFreq1=14585000`, no CTCSS/DCS).

| Field                            | Documented claim                                                | Capture evidence (record 3, `EYESAT A`)                                                                                                                                                                        | Verdict                                       |
| -------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Name @0x00 len8                  | ASCII, left-justified, 8 bytes                                  | `45 59 45 53 41 54 20 41` = `"EYESAT A"` (name `"EYESAT A (AO-27)"` hard-truncated to 8)                                                                                                                       | **Confirmed**                                 |
| Epoch @0x08 len14                | Raw TLE substring, ASCII                                        | `"26223.16950785"` — exact match to CSV `TLE_Line1` first 14 chars                                                                                                                                             | **Confirmed**                                 |
| Mean motion deriv @0x16 len11    | Raw TLE substring, right-justified                              | `"  .00000021"` — exact match to remainder of CSV `TLE_Line1`                                                                                                                                                  | **Confirmed**                                 |
| Inclination @0x21 len8           | Raw TLE substring                                               | `" 98.6844"` — matches CSV `TLE_Line2` field 1                                                                                                                                                                 | **Confirmed**                                 |
| RAAN @0x29 len9                  | Raw TLE substring                                               | `" 290.5526"`                                                                                                                                                                                                  | **Confirmed**                                 |
| Eccentricity @0x32 len8          | Raw TLE substring                                               | `" 0007348"`                                                                                                                                                                                                   | **Confirmed**                                 |
| Arg of perigee @0x3a len9        | Raw TLE substring                                               | `" 303.4033"`                                                                                                                                                                                                  | **Confirmed**                                 |
| Mean anomaly @0x43 len9          | Raw TLE substring                                               | `"  56.6446"`                                                                                                                                                                                                  | **Confirmed**                                 |
| Mean motion @0x4c len12          | Raw TLE substring                                               | `" 14.30954628"`                                                                                                                                                                                               | **Confirmed**                                 |
| Revolution number @0x58 len5     | Raw TLE substring                                               | `"71486"` — completes CSV `TLE_Line2`'s trailing `"...62871486"` exactly with the two fields concatenated                                                                                                      | **Confirmed**                                 |
| RX freq @0x60 len4 u32LE deci-Hz | Little-endian u32, Hz÷10                                        | bytes at `0x60` decode to `43679500` — **exact match** to CSV `rxFreq1=43679500` (not derived indirectly; this is a direct CSV field, stronger confirmation than the doc's AO-27-public-frequency cross-check) | **Confirmed**                                 |
| TX freq @0x64 len4 u32LE deci-Hz | Little-endian u32, Hz÷10                                        | `14585000` — exact match to CSV `txFreq1=14585000`                                                                                                                                                             | **Confirmed**                                 |
| Tone bytes @0x68–0x6f            | enc-type/dec-type/enc-idx/dec-idx/DCS-enc(u16LE)/DCS-dec(u16LE) | `00 00 00 00 00 00 00 00` — CSV row has empty `EnCtc`/`DeCtc`/`EnDcs`/`DeDcs` (no tone)                                                                                                                        | **Confirmed** (all-zero = "none", consistent) |

Second cross-check with tone actually **set**: record index 4 (`ISS (ZARYA)`, frame range 8981–9105), CSV row
2 has `TxCdt=1`, `EnCtc=67.0`, `RxCdt=0`, `DeCtc` empty. Bytes at `0x68`–`0x6f`: `01 00 01 00 00 00 00 00`.
`0x68=01` (encode type CTCSS) and `0x69=00` (decode type none) match CSV `TxCdt=1`/no decode tone exactly.
`0x6a=01` is presumably the CTCSS-encode tone-table index for 67.0 Hz (consistent with 67.0 Hz commonly being
the lowest/first entry in a standard CTCSS table) — **this specific index→Hz mapping was not independently
verified against a full CTCSS table in this pass**, flagged as a follow-up. `0x6c`–`0x6f` (DCS) are zero,
matching the CSV's empty `EnDcs`/`DeDcs`. **Verdict: confirmed for type-byte semantics; tone-index-to-Hz table
inconclusive** (plausible but not independently checked).

Records 5 (`SAUDISAT`), 6 (`SWISSCUB`), 7 (`LILACSAT`), 8–12 (`TEVEL2-4/3/2/7/8`) all reproduce the same
pattern — every field lines up with the corresponding `keps.CSV` row, frequencies match `rxFreq1`/`txFreq1`
exactly, and tone bytes are all-zero matching each row's empty CTCSS/DCS columns. Not tabulated individually
here for brevity; raw hex was dumped during the original analysis but not persisted to a separate file.

## The 0x70–0x1ff question

**Confirmed all-zero across every one of the 25 records written in this capture.** Checked programmatically:
for each of records 0–24, all 352 bytes at offsets `0x70`–`0x1ff` (spanning write chunks at record-relative
offsets `0x70` through `0x1f0`, i.e. tshark frames 8477–8593 for record 0 alone, and the equivalent chunk
range for every other record) were `0x00`. No record in this capture has any non-zero byte in that range.

**What this does and does not prove:**

- It **does** show that, for a from-scratch 10-satellite CSV write on this session, the official CPS's own
  `encode()` behaves exactly as GPL source suggested: zero-init the `0x200` buffer, only ever touch
  `0x00`–`0x6f`, leave the rest zero.
- It does **not** prove `0x70`–`0x1ff` is unused by the _radio firmware_ — only that the _official CPS never
  writes anything there_. A firmware-side use of that range (e.g. a satellite AOS/LOS tracking cache, a
  last-computed-pass cache, a per-satellite enable flag written by the radio itself rather than the CPS) would
  be invisible to a USB write capture. This capture only rules out "the CPS secretly writes something to
  `0x70+` that GPL source-reading missed" — which was the actual open question, so this is still a meaningful
  upgrade from "unverified" to "verified for the write side," but it is not a full-record hardware audit
  (that would require a **read** of the region after write, which this capture does not contain — see below).
- No read of the satellite region happens anywhere in this capture (see Other observations), so there's no
  independent confirmation of what's actually sitting in `0x70`–`0x1ff` on the radio's flash after this write
  — only that the CPS didn't just put it there in this session. If a previous session (or firmware default)
  had left non-zero data there, and the CPS never reads before writing (also confirmed below), this capture
  cannot detect stale non-zero data surviving underneath — it can only speak to what byte values the _write
  path itself_ transmitted, all of which are `0x00` in this region.

## CSV-escaping bug findings

**Concrete evidence found — not the operator's verbal report alone.** Records 0–2 (addresses `0x4a80000`,
`0x4a80200`, `0x4a80400`; first write chunks at tshark frames **8469**, **8597**, **8725** respectively) are
written _before_ the 10 clean records (3–12) and contain garbled name/orbital-element text that is not any
single CSV row — it's concatenated fragments of _multiple_ rows, while the frequency and tone bytes at
`0x60`–`0x6f` remain intact and match a real satellite's values from the whitelist.

**Record 0** (frame 8469 first chunk), bytes `0x00`–`0x5f` decoded as ASCII:

```
"1","SAU6223.17444633  .00000439"ACSAT-2","26223.51518255  .00009902","97.4612 262.5147 00079
```

This is legible as literal, un-descaped CSV syntax (`"1","SAU`, stray `"`, `,`, `"ACSAT-2"`) — i.e. **raw CSV
punctuation ended up inside what should be a pure orbital-element field**, mixed with:

- `6223.17444633  .00000439` — SWISSCUBE's epoch/mean-motion-derivative (CSV row 4: `26223.17444633
.00000439`, missing its leading `2`)
- `ACSAT-2` — a fragment of `LILACSAT-2` (CSV row 5's name, missing `LIL`)
- `26223.51518255  .00009902` — LILACSAT-2's actual epoch/mean-motion-derivative (CSV row 5, exact match)
- `97.4612 262.5147 00079` — the start of LILACSAT-2's TLE_Line2 (CSV row 5, exact prefix match), cut off
  mid-field by the 16-byte-chunked write's `0x200` record boundary (buffer is zero from `0x5f` on)

Bytes `0x60`–`0x6f` for record 0: `rx=43679500, tx=14585000, tone=01 00 01 00 00 00 00 00`. `43679500` /
`14585000` matches **both** `EYESAT A (AO-27)` and `SAUDISAT 1C (SO-50)` in `keps.CSV` (they share identical
frequencies); the tone bytes (`01 00 01 …`) match `SAUDISAT 1C`'s row (`TxCdt=1, EnCtc=67.0`) exactly, not
EYESAT A's (which has no tone). So record 0's _numeric tail_ is SAUDISAT-1C's real data, while its _name/text
head_ is garbage assembled from SWISSCUBE and LILACSAT-2 fragments — three unrelated satellites' data bleeding
into one record.

**Record 1** (frame 8597) and **record 2** (frame 8725) show the same pattern: legible raw CSV syntax
(`"1","TEV`, stray `"`, `,`, `EL2-2"`) mixed with correct-looking numeric fragments from TEVEL-family
satellites, and tail frequency/tone bytes (`rx=43640000, tx=14597000, tone=00 00 …`) matching the TEVEL
family's real (toneless) CSV values.

**Speculation on mechanism (clearly labelled as speculation — not verified further in this pass):** this
reads like a fixed-offset substring bug reading from an in-memory flat/raw copy of the CSV text rather than
from properly-parsed, quote-aware fields — i.e. the CPS's CSV parser appears to compute per-row string offsets
that don't correctly account for variable-length quoted fields, so text from adjacent rows in the raw file
buffer leaks into fields it's trying to slice. The fact that the _frequency and tone bytes_ (which come from
numeric CSV columns, not the free-text name/TLE columns) are always internally consistent with _some_ real
satellite's row, while the _name/TLE text_ is scrambled across multiple rows, is consistent with a bug
specifically in the free-text field-slicing path rather than a wholesale data-corruption bug — but this is
inference from the pattern of what's correct vs. garbled, not confirmed from source (no official-CPS source is
available to check).

**This directly corroborates the operator's verbal report** ("writes badly escaped CSV strings to the radio")
with concrete on-wire byte evidence, not just an eyeballed impression.

## Other observations

- **Satellite count:** `keps.CSV` has exactly 10 data rows (11 lines including header). The capture wrote 25
  total `0x200`-byte records (indices 0–24): 3 garbled (0–2), 10 clean matching all 10 CSV rows in order
  (3–12), and 12 fully-zeroed/blank records (13–24). **10 clean records for 10 CSV rows is a match** — every
  CSV row made it through cleanly at least once, consistent with `satellite-keps.md`'s documented 10-satellite
  hardcoded whitelist (AO-27, ISS, SAUDISAT-1C, SWISSCUBE, LilacSat-2, 5× TEVEL) all being present in this
  CSV and all matching. **But the CPS did not write "10 records" — it wrote a fixed batch of 25**, of which 15
  are either corrupted duplicates or explicit zero-fill. This looks like a fixed-size satellite table (25
  slots) that the CPS always fully rewrites — filling used slots and explicitly zeroing the rest — rather than
  writing exactly `count` records and leaving the remainder untouched. **This is new information not covered
  by the "Occupancy and clearing behavior — unconfirmed" section of `satellite-keps.md`**: the official CPS's
  own byte-for-byte zero writes to slots 13–24 are direct evidence _for_ explanation (1) in that section
  ("anytone-cps clears trailing slots on write") — though the GPL source review that produced that section
  found no code that does this, so either the reviewed GPL source doesn't match the official CPS binary
  behavior exactly, or the 25-slot table is populated by a different code path (e.g. the dialog always submits
  a fixed 25-row internal table, pre-zeroed, rather than a variable-length list) that the GPL review didn't
  identify as "clearing." Either way, **this capture is direct evidence that trailing/unused slots get
  explicitly zeroed, not left stale**, for at least this from-scratch (previously-unpopulated, presumably)
  radio and this CSV.
- **Why 25, not some other number:** not determined in this pass — could be a fixed UI table size in the
  satellite dialog, unrelated to the 10-row CSV or the whitelist's cardinality. Flagged as a follow-up, not
  resolved here.
- **Session framing:** `PROGRAM` (frame 8461) → `PROGRAM_REPLY` (`51 58 06` / `"QX\x06"`) → `IDENT_PROBE`
  (`02`) → `IDENT_REPLY` (`49 44 38 39 30 55 56 00 03 56 31 30 30 00 00 06` = `"ID890UV\x00\x03V100\x00\x00\x06"`,
  confirming this really is a D890UV, ident matches `satellite-keps.md`'s and `protocol.md`'s documented
  model-allow-list string) → 800 `W`/ACK pairs → `END` (frame 11669) → trailing bare `0x06` ACK (frame 11671).
  This matches the documented "own PROGRAM→ident→W→END session, decoupled from a full codeplug write" shape
  exactly — no `RADIO_DATA` full-codeplug frames, no image writes, nothing else in the session.
- **No reads:** zero `READ_CMD`/`0x52` frames anywhere in the capture (0 of 1,606 decoded frames). The
  official CPS does **not** read the satellite region (or anything else) before writing in this session — this
  is direct hardware evidence _against_ a pre-write read-modify-write on the official CPS's part for this
  region, and is consistent with (does not contradict) Studio's own decision to apply sparse erase-unit RMW
  defensively regardless, since the erase-unit-safety open question in `satellite-keps.md` is about what
  happens to _other, undeclared_ data that might share unit 298 — this capture only shows the official CPS's
  own behavior, not what's safe for Studio to assume about co-resident bytes it didn't itself just write.
- **Checksums:** all 800 `WRITE_CMD` frames have `checksum_ok: true` per the decoder's own checksum
  verification — no malformed or corrupted-in-transit frames.
- **Frame shape inventory** (full detail was in `/tmp/write-keps-report.md`, ephemeral scratch output from the
  original run): `WRITE_CMD` ×800, `WRITE_ACK` ×800, `PROGRAM`/`PROGRAM_REPLY`/`IDENT_PROBE`/`IDENT_REPLY`/
  `END` ×1 each, one trailing bare `0x06` after `END` (frame 11671) — the decoder flags this as its only
  "anomaly," but it's simply the ACK for `END` itself, not a genuinely unknown frame shape. **Zero
  unknown/unrecognized frame shapes** in the entire capture.
- **Address base confirmed:** every one of the 800 write commands lands at `0x4a80000 ≤ addr ≤ 0x4a831f0`,
  i.e. exactly the documented base through `base + 25×0x200 - 0x10`. No writes below `0x4a80000` at all —
  the documented base address is confirmed correct by direct observation, not just by absence of contradiction.

## Recommended follow-ups

- Upgrade `docs/reference/radios/anytone/at-d890uv/satellite-keps.md`'s **base address**, **stride**, **record
  size**, and **every field in the `0x00`–`0x6f` offset table** from "not hardware-verified" to
  hardware-verified, citing this capture (`write-keps.pcapng`, tshark frames as listed above) alongside the
  existing GPL-source citations.
- Upgrade the **`0x70`–`0x1ff` zero-fill claim** to "hardware-confirmed for the official CPS's write path, for
  all 25 records in one real write session" — but keep it short of "confirmed unused by firmware," since no
  read of that region was captured. Consider explicitly noting the residual gap (firmware could still read/
  write it independently of the CPS) rather than closing the question outright.
- Add a note to the **"Occupancy and clearing behavior"** section: this capture directly observed the official
  CPS zero-filling 12 trailing slots (records 13–24) after writing 13 populated ones, which is evidence
  **for** trailing-slot clearing happening in practice (whether or not the specific GPL code path that does it
  was identified) — worth re-reading `SatelliteDialog`/`writeSatelliteData` with an eye for a fixed-size
  (25-element?) internal table that the earlier GPL review may have missed, since "no clearing code found" and
  "trailing slots observably get zeroed on the wire" are in tension and worth reconciling rather than leaving
  as an open contradiction.
- Investigate the mystery **"25 records"** figure — is it a fixed UI table size in the satellite dialog,
  unrelated to both the CSV row count (10) and the documented whitelist cardinality (10)? Could inform
  Studio's own `AT_D890UV_LIMITS.SATELLITE_MAX` placeholder discussion (currently 50, chosen from qdmr
  cross-family bounds) if 25 turns out to be a genuine D890 UI/firmware constant rather than an artifact of
  this one capture.
- File the **CSV-escaping bug** as a known-vendor-quirk note (not a Studio bug) somewhere appropriate —
  possibly a short callout in `satellite-keps.md` warning that CSVs re-exported by the official CPS, or
  CSVs whose rows have very different quoted-field lengths, may trigger this vendor-side corruption if anyone
  ever compares Studio's own CSV import against official-CPS-written radio data as a correctness oracle. No
  action needed on Studio's own encode path — this is purely informational, since Studio does not reuse or
  replay the official CPS's buggy behavior.
- Consider a **second capture with a non-empty starting radio** (i.e. a keps write onto a radio that already
  has different satellite data loaded) to test whether the "clear trailing slots" behavior observed here holds
  when the previous count is _larger_ than the new count by more than the 25-slot window — this capture can't
  distinguish "always clears 25 slots total" from "always clears up to the previous count," since the prior
  radio state before this capture is unknown.
- No action needed on the **name field 8-byte truncation** claim, the **RX/TX frequency Hz÷10 encoding**
  claim, or the **PROGRAM→ident→W→END session shape / no-RMW-read** claims — all are now hardware-confirmed
  and match the existing documentation with no discrepancies found.
- Re-run the original decode + reassembly (see Setup) if any number in this report needs independent
  re-verification — the reassembly script itself was throwaway and not preserved on disk, but its method
  (group `WRITE_CMD` frames from `/tmp/write-keps-frames.json` by `(address - 0x4a80000) // 0x200`, reassemble
  in address order, decode per the offset table above) is fully described here and takes only a few minutes to
  reproduce against the same capture and CSV files.
