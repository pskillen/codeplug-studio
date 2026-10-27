# AT-D890UV — digital contact Write

How the digital contact database (the **ID database**, which only names incoming calls) is written, by the
official CPS and by Studio. Layout of the bank (meta, order table, block-hopped records) is in
[memory-layout.md](memory-layout.md#digitalcontact-huge-bank).

The AT-D890UV is dual-bank ([#1433](https://github.com/pskillen/codeplug-studio/issues/1433)): the build's
library contacts go to the **Contacts list** (talk-group records, as private calls after the talk groups;
[talkgroup-record.md](talkgroup-record.md)) with every image Write. This bank is filled only when the Write's
**Digital contacts** part is ticked, from the build's contacts, the ID directory or both.
Firmware facts are from the firmware repo's findings F274 to F278 (F279 is the emulator harness they were run in) and Q82 to Q83
([findings.md](https://github.com/pskillen/anytone-d890-firmware/blob/main/docs/initial-re/findings.md)).

## What the CPS does

The CPS builds the contact database in a fresh, zero-filled buffer for `0x07000000..0x11FFFFFF` and
**never reads it** (F277). It marks only what it fills:

- the header block (8 bytes: contact count, end address);
- the order entries, 8 bytes each, rounded up to an even count;
- `0xC8` bytes per record start, aware of the bank hop.

Then it sends 16-byte `W` frames in ascending address order, one ACK per frame, one run per erase unit,
and finally `END`. It sends no `R` after the first `W` of any session. Because the first `W` into a unit
erases it ([flash-sectors.md](flash-sectors.md)), every byte of a touched contact unit that the CPS did
not send reads `FF` afterwards.

## What Studio does

Every contact erase unit a Write touches is **Studio-owned**: it starts from `FF`, the packer's chunks are
overlaid, all-`FF` blocks are skipped, and **no byte of a contact unit is read**. The writer sends only
`W` frames, in ascending order, one run per unit, then the session ends with `END` like any other Write.

- Contact units are the A half of `0x07000000` (meta), of `0x07080000 + k * 0x80000` for k = 0..15
  (order) and of `0x07900000 + k * 0x80000` for k = 0..499 (data). `digitalContactUnits.ts` lists them;
  the writer refuses, before sending anything, a staged block outside them.
- The bookkeeping markers (`+0x3FBF0`, `+0x3FFF0`) are never sent, as everywhere else.
- Every check that can throw (packing, the hard deny, the unit list) runs before the first `W` of the
  session, so a Write does not fail midway for a reason known up front.

### Why no byte needs preserving

| Source                    | What it shows                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPS                       | Rebuilds the range from zeros and never reads it, so any byte it did not mark is erased on every CPS contact write (F277)                                                                                                 |
| Firmware                  | Reads contacts only through the header count: order entries `count * 8`, 200-byte records with the hop at `0x30D40` (F276). A search for other users of `0x07xxxxxx` found none beyond the bank and its `+0x40000` halves |
| Owner backup (2026-10-16) | Every non-bank tail of the meta, order and data units was `FF`                                                                                                                                                            |
| MM9PDY storage            | No MM9PDY storage contract claims a contact unit                                                                                                                                                                          |

The "unmodelled bytes are kept" guarantee therefore holds for every unit **outside** the contact units.
Inside them, anything outside the header, the order entries and the records is erased, as the CPS does.
The stale tail of an earlier, longer list is erased, not re-sent.

### Differences from the CPS bytes

Both are harmless: the firmware reads only `count` entries and self-terminating records.

- An odd order table is padded with `FF x 8`; the CPS pads with zeros.
- The last record is padded with `FF` to 16 bytes; the CPS sends `0xC8` bytes of zeros.

## Why the old preserve read mattered

Before #1406 Studio read each touched contact unit whole ("Preserving untouched contact data") after the
codeplug's `W` frames. That `R` after a `W` is what stops the radio committing the unit it was writing,
and it also re-sent every stale block of an earlier, longer list. See
[protocol.md — Session rule](protocol.md#session-rule-no-r-after-the-first-w).

Frames sent for a contact Write over a radio that already held 18,894 contacts (synthetic, pinned by
`digitalContactWrite.frames.test.ts`):

| Contacts written | Before: `R` / `W` frames | After: `R` / `W` frames |
| ---------------- | ------------------------ | ----------------------- |
| 2                | 3,279 / 21,951           | 0 / 14                  |
| 100              | 3,279 / 21,951           | 0 / 626                 |
| 1,000            | 3,279 / 21,951           | 0 / 6,251               |

("Before" counted three planted non-bank tail blocks that the old write re-sent unchanged.) The codeplug
part of a Write is unchanged. Times per `W` frame are not measured yet: Studio logs per-stage timings on
every D890 Write (`[d890-write-timing]`) and the Done step has **Copy write timings**.

Not yet checked on a radio.

## Related

- [protocol.md](protocol.md) · [flash-sectors.md](flash-sectors.md) · [memory-layout.md](memory-layout.md)
- [Contact directories](../../../../features/contact-directories/README.md#at-d890uv-dual-bank-contacts)
