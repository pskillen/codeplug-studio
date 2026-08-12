# AT-D890UV flash sector markers

Durable facts about erase-unit geometry and the two per-unit sector-management blocks Studio must
**never** write. How these were established: investigation
[i001](../../../investigations/i001-d890-write-commit-failure/README.md).

## Erase unit

| Property    | Value                       |
| ----------- | --------------------------- |
| Size        | `0x40000` (256 kB), aligned |
| Write chunk | always 16 bytes             |

Writing any 16-byte block into a unit can erase the whole unit; co-resident bytes must be re-staged if
Studio touches the unit (sparse erase-unit RMW — see [memory-layout.md](memory-layout.md)).

## Sector-management markers

Two 16-byte blocks at the tail of **every** erase unit are the radio's own flash sector-management
metadata, **not** codeplug payload:

| Offset in unit | Typical pattern (hex)                             |
| -------------- | ------------------------------------------------- |
| `+0x3fbf0`     | `ff ff ff ff 22 33 44 55 ff ff ff ff ff ff ff ff` |
| `+0x3fff0`     | `ff ff ff ff ff ff ff ff ff ff ff ff 55 55 aa aa` |

The radio maintains them itself — observed changing from all-`0xff` to the marker pattern on a sector
Studio never addressed. Official Anytone CPS never writes them (USB wire capture of a full codeplug
write: 9,976 `WRITE_CMD` frames, zero hits on either offset).

### Never write them

Studio must not transmit these addresses on any path (staging, transmit filter, or write fence). There
is no diagnostic or debug exception.

**Consequence (hardware, 2026-07-30, one variable):** restoring marker writes made the radio display
_"Program error please initialise the radio!"_ and **factory-reset itself**, destroying the operator's
configuration. Suppressing them restores normal commit behaviour.

Sparse erase-unit RMW itself is correct for preserving co-resident codeplug / settings bytes; only
these marker blocks are excluded.

### ⚠️ That message has more than one cause

_"Program error please initialise the radio!"_ is **not** specific to marker writes. Confirmed or dump-backed
causes, all of which destroy the operator's configuration and require an on-radio init plus a
full official-CPS restore:

| Cause                                                                                                                                      | Status                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio transmitting the sector-management markers above                                                                                    | **Fixed** — [#871](https://github.com/pskillen/codeplug-studio/pull/871), suppression is structural                                                                                                                                                                                                                                                                    |
| Writing a codeplug with **channels but zero visible zones** — empty `ZoneSet`, or occupied zones that are all hidden (`ZoneHide` bits set) | **Partial** — [#1125](https://github.com/pskillen/codeplug-studio/issues/1125) zeros `ZoneHide` on encode and refuses Write when visible zones would be zero; [#880](https://github.com/pskillen/codeplug-studio/issues/880) (projection-empty refusal copy / DM-32); [#881](https://github.com/pskillen/codeplug-studio/issues/881) (synthesised "All Channels" zone) |
| Assemble-from-`0xff` leaving **`RadioIdSet` all-set** in erase unit `0x3480000` (RMW skips `0xff` blocks; occupancy reads as 256 IDs)      | **Code** — [#1129](https://github.com/pskillen/codeplug-studio/issues/1129) zeros the bitmap on virgin fill and stages the zeros. Hardware verify pending. Empty projection still retains a **hydrated** RadioId bank.                                                                                                                                                  |

Do not diagnose that message as a marker problem without checking **visible** zone count first (`ZoneSet` occupied and not hidden). A zero-visible-zone codeplug
is written faithfully by Studio unless the Write guard refuses it, and is rejected by the radio — it is not an encoding fault.

**Recovery, either way:** on-radio init, then write a full codeplug from the **official** Anytone CPS. Studio
alone is not known to be sufficient — it writes 15 erase units where CPS writes 30.

## Write diversion at `+0x40000`

When Studio transmitted the markers (after sparse RMW began sweeping them in), every write frame was
ACKed and reached flash, but bytes landed at `address + 0x40000` while the live bank kept its previous
contents.

**Inference (not proven):** that diversion is probably the same A/B sector mechanism as ChannelData's
documented alias stride of `+0x40000` ([memory-layout.md — Address aliasing](memory-layout.md#address-aliasing)).
The actionable rule does not depend on proving that link — do not write the markers either way.

## No commit / erase / swap command

The PROGRAM session is `PROGRAM` → ident → `R`/`W` frames → `END`. A full official-CPS wire capture
(19,960 frames) decoded to only those kinds plus bare `0x06` ACKs — **zero unknown frames**. `END`
receives a bare `0x06` and nothing else follows.

There is **no** separate commit, erase, or bank-swap command on the wire. Writes land according to the
radio's flash sector state; `END` exits the session. Older docs that said "`END` commits" were wrong —
see [protocol.md](protocol.md) for the corrected session description.
