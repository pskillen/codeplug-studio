# AT-D890UV flash sector markers

Durable facts about erase-unit geometry and the two per-unit sector-management blocks Studio must
**never** write. How these were established: investigation
[i001](../../../investigations/i001-d890-write-commit-failure/README.md).

## Erase unit

| Property    | Value                       |
| ----------- | --------------------------- |
| Size        | `0x40000` (256 kB), aligned |
| Write chunk | always 16 bytes             |

A write into a unit has been observed to clear co-resident bytes. When Studio touches a unit it
re-stages those bytes (sparse erase-unit RMW — see [memory-layout.md](memory-layout.md)).

## Sector-management markers

Two 16-byte blocks at the tail of **every** erase unit are the radio's own flash sector-management
metadata, **not** codeplug payload:

| Offset in unit | Typical pattern (hex)                             |
| -------------- | ------------------------------------------------- |
| `+0x3fbf0`     | `ff ff ff ff 22 33 44 55 ff ff ff ff ff ff ff ff` |
| `+0x3fff0`     | `ff ff ff ff ff ff ff ff ff ff ff ff 55 55 aa aa` |

The radio maintains them itself — observed changing from all-`0xff` to the marker pattern on a sector
Studio never addressed. The official CPS encoder we read does not write them (USB wire capture of a
full codeplug write: 9,976 `WRITE_CMD` frames, zero hits on either offset).

### Never write them

Studio must not transmit these addresses on any path (staging, transmit filter, or write fence). There
is no diagnostic or debug exception.

**Consequence (hardware, 2026-07-30, one variable):** restoring marker writes made the radio display
_"Program error please initialise the radio!"_ and **factory-reset itself**, destroying the operator's
configuration. Suppressing them restores normal commit behaviour.

Sparse erase-unit RMW itself is correct for preserving co-resident codeplug / settings bytes; only
these marker blocks are excluded.

### ⚠️ That message has more than one cause

_"Program error please initialise the radio!"_ is **not** specific to marker writes. Two unrelated causes are
confirmed on hardware, both of which destroy the operator's configuration and require an on-radio init plus a
full official-CPS restore:

| Cause                                                                                    | Status                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Studio transmitting the sector-management markers above                                  | **Fixed** — [#871](https://github.com/pskillen/codeplug-studio/pull/871), suppression is structural                                                                                                                                                                                                                                                                      |
| Writing a codeplug with **channels but zero zones** — an invalid state for this firmware | **Open** — [#880](https://github.com/pskillen/codeplug-studio/issues/880) (refusal); [#881](https://github.com/pskillen/codeplug-studio/issues/881) (synthesised "All Channels" zone as the fix)                                                                                                                                                                         |
| Assemble-from-`0xff` leaving **RadioIdSet** (and ChannelSet tail / channel AES) as fill  | **Not the product contract** — Write encodes onto the in-session download cache ([#875](https://github.com/pskillen/codeplug-studio/issues/875) / [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118)). Do not implement [#1129](https://github.com/pskillen/codeplug-studio/issues/1129) zeros-as-overlay. Hardware verify of the cache prior is pending. |

Do not diagnose that message as a marker problem without checking the zone count first. A zero-zone codeplug
is written faithfully by Studio and rejected by the radio — it is not an encoding fault.

**Recovery, either way:** on-radio init, then write a full codeplug from the **official** Anytone CPS. Studio
alone is not known to be sufficient. A typical Studio write touches 15 erase units. The official CPS
encoder we read touched 30 units: it writes the blocks it marks and re-sends every settings block.

## Alternate half at `+0x40000`

The upper half of a `0x40000` unit is an alternate unit, not a mirror of the lower half. Firmware
selects the live half at run time from the end-of-unit words in
[memory-layout.md — Alternate half](memory-layout.md#alternate-half-of-a-0x40000-unit). The PC-link
address map is not settled. Studio still must not write the `+0x3fbf0` / `+0x3fff0` markers; that
warning stands on the program-error incident above.

## No commit / erase / swap command

The PROGRAM session is `PROGRAM` → ident → `R`/`W` frames → `END`. A full official-CPS wire capture
(19,960 frames) decoded to only those kinds plus bare `0x06` ACKs — **zero unknown frames**. `END`
receives a bare `0x06` and nothing else follows.

There is **no** separate commit, erase, or bank-swap command on the wire. Writes land according to the
radio's flash sector state; `END` exits the session. Older docs that said "`END` commits" were wrong —
see [protocol.md](protocol.md) for the corrected session description.
