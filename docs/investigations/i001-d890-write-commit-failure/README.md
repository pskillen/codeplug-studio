# i001 — AT-D890UV Web Serial writes never commit

**Opened:** 2026-07-27 (as an AM airband investigation; the subject changed)
**Closed:** 2026-07-30
**Cost:** ~3 days, 10 hardware write runs, 6 retracted conclusions, one factory-reset radio
**Outcome:** Studio was transmitting the radio's own flash sector-management markers

**Technical conclusion lives in
[`docs/reference/radios/anytone/at-d890uv/flash-sectors.md`](../../reference/radios/anytone/at-d890uv/flash-sectors.md).**
This record is how it was established, and what was ruled out on the way.

| | |
| --- | --- |
| **Symptom** | Every write frame ACKed, bytes reached flash, radio behaved as if nothing had been written |
| **Root cause** | `+0x3fbf0` and `+0x3fff0` in every `0x40000` erase unit are radio-managed flash sector metadata. Writing them diverted the whole write to a shadow sector at `+0x40000` |
| **Introduced by** | `fe6955e3` — whole-erase-unit RMW writeback swept the markers into the transmitted set |
| **Masked by** | `98f67b50` — added a suppression flag, but wired it only into the verify snapshot; the transmit loop kept iterating the unfiltered list, so the flag never affected a transmitted byte |
| **Fixed by** | Making the transmit loop iterate the filtered list |

---

## What the failure looked like

Studio could read the radio fine. Writes were accepted — every 16-byte frame returned `0x06`, and a rejected
frame would have aborted the upload. But the radio's configuration never changed.

The bytes were not lost. They were landing exactly `0x40000` above the address we sent, in every bank, while
the addressed location kept its previous contents:

```
scanListData
  0x2100000 (addressed, live) : 0000 ffffffff 3200 3200 3200 3200 "Scan List 1"   <- CPS, timing 50
  0x2140000 (+0x40000)        : 0000 ffffffff 1e00 1e00 1e00 1e00 "Home Shack"    <- OURS, timing 30
```

Because the radio reads the live bank, it showed the last **official CPS** write and looked untouched. Worse,
it stayed *functional* — the un-committed banks still held a coherent CPS codeplug — so the radio's own
behaviour was useless as evidence for three days.

## Root cause

Two 16-byte blocks in every `0x40000` erase unit are the radio's own flash sector-management markers —
byte patterns and the never-write rule live in
[`flash-sectors.md`](../../reference/radios/anytone/at-d890uv/flash-sectors.md).

The radio maintains them itself — one was observed changing from all-`0xff` to the marker pattern on a sector
Studio had never addressed. The official Anytone CPS never writes them: confirmed directly from a USB wire
capture, zero hits across 9,976 write frames.

`fe6955e3` changed the upload path from "transmit only the chunks Studio encodes" to "read each touched erase
unit, overlay the modelled chunks, write back every non-`0xff` block in the unit". That swept the markers in.
From that commit onward, Studio could not program the radio.

The most economical explanation for the diversion is A/B ping-pong sector management — writing the marker
tells the controller the sector is already programmed, so the payload goes to the alternate sector, which sits
at `+0x40000`. That would also make ChannelData's documented `+0x40000` alias stride and the write-diversion
window one mechanism rather than two. **This is inference and was never proven** — the actionable finding does
not depend on it.

## The proof

Two runs, one variable, opposite outcomes:

| Markers on the wire | Outcome |
| ------------------- | ------- |
| **suppressed** | Verify PASS, 0 / 2927 staged chunks mismatched. 12 of 12 erase units with work `committed`, `must-change == changed` exactly in every one. Independent before/after dump diff: **32,933 bytes changed** on the live bank across 18 regions, including every occupancy bitmap |
| **restored** | Radio displayed *"Program error please initialise the radio!"* and **factory-reset itself**, losing the clock and the operator's entire configuration |

The negative control was more destructive than predicted. Writing these addresses does not merely divert the
write — it corrupts sector management badly enough that the firmware rejects the codeplug wholesale. That is
why suppression is now structural rather than flag-gated.

Corroborating detail: post-fix, erase unit `0x1000000` staged exactly **1024** chunks. The prediction made a
day earlier, when the marker hypothesis was first raised and then wrongly dismissed, was "1026 → exactly
1024".

## Why it took three days

The bug was two lines. Three process failures kept it hidden, and all three are cheap to avoid.

### 1. A fix that never reached the wire

`AT_D890_SKIP_BOOKKEEPING_WRITES` was declared as a constant, imported, referenced in a filter, described
accurately in a commit message, and covered by a passing test — and never affected a single transmitted byte,
because the filter built a list the transmit loop did not read.

> **Verify a claimed fix actually reaches the thing under test.** Confirm the code path executes before
> crediting *or blaming* a change.

### 2. A test that could not fail

`protocol.test.ts` had a test named *"never transmits the per-unit flash bookkeeping blocks"*. It passed with
the suppression flag forced to `false`, because the fixture never staged a marker block in the first place.
The assertion guarding the exact behaviour that later bricked a radio was vacuous.

> **Distrust a test that cannot fail.** Invert the condition it guards and re-run. This took 30 seconds and
> would have saved two days.

### 3. A hypothesis "cleared" by a run that predated it

The sector-marker hypothesis was tested on hardware at 18:18 local and recorded as cleared. The commit adding
the suppression flag landed at **22:00 local** — four hours *later*. Combined with (1), the hypothesis was
never tested at all. Once it was in the dead column, nobody looked there again, and it was the answer.

The dump filenames were UTC and the commits were local (BST, +1), which is what made the ordering easy to get
wrong.

> **Re-examine anything recorded as "cleared".** Check the run actually exercised it, and that it does not
> predate the change it supposedly tested. Reconcile clocks explicitly.

### The compounding factor

Six conclusions were retracted, two of them inverted. Individually they looked like reasoning errors; the
cluster was a structural problem. The notes were organised chronologically — a document per session, per
phase — so corrections had to be threaded back through prose that had already been read, as
`~~strikethroughs~~` and "superseded by §11" banners. Restructuring them by *role* (what is true / what was
ruled out / an immutable evidence ledger) is what surfaced the four-hour discrepancy in (3) within an hour.

## What else this produced

| Finding | Where it went |
| ------- | ------------- |
| The protocol has **no** commit / erase / swap command; `END` is not a commit. 19,960 CPS frames, zero unknown | [`flash-sectors.md`](../../reference/radios/anytone/at-d890uv/flash-sectors.md), `protocol.md` |
| Scan-list record layout: 100 members at `0x30`–`0xF7`, `revert_channel` at `0xF8`, record reaches `0xF9` | [`scan-list-record.md`](../../reference/radios/anytone/at-d890uv/scan-list-record.md) |
| Bank capacities: zones 250, RX groups 250, RX members 64, scan lists 100 | [`limits.md`](../../reference/radios/anytone/at-d890uv/limits.md) |
| `auto_scan` is bit 4 of channel byte `0x34`, and is *not* scan-list membership | [`channel-record.md`](../../reference/radios/anytone/at-d890uv/channel-record.md) |
| CPS writes 17 erase units Studio does not model, two of them the densest banks in the capture | **Still open** — see [`cps-wire-capture.md`](cps-wire-capture.md) |
| `anytone-cps` is wrong on at least three counts about the scan-list record | [`dead-ends.md`](dead-ends.md) |
| A reusable USB wire-capture decoder | `dev-tools/wire-capture-decoder/` |

## Further reading

- [`evidence.md`](evidence.md) — the runs and captures the conclusions rest on
- [`dead-ends.md`](dead-ends.md) — hypotheses ruled out, and what killed each
- [`cps-wire-capture.md`](cps-wire-capture.md) — what the official CPS actually sends, including the
  unmodelled banks
