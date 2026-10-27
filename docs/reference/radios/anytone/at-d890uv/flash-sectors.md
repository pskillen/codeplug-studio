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
is no diagnostic or debug exception. The deny is non-overridable: `atD890WriteMemory` (the only `W`
sender)
applies it before any caller-supplied transmit guard.

**Consequence (hardware, 2026-07-30, one variable):** restoring marker writes made the radio display
_"Program error please initialise the radio!"_ and **factory-reset itself**, destroying the operator's
configuration. Suppressing them restores normal commit behaviour.

Sparse erase-unit RMW itself is correct for preserving co-resident codeplug / settings bytes; only
these marker blocks are excluded.

### ⚠️ That message has more than one cause

_"Program error please initialise the radio!"_ is **not** specific to marker writes. Several unrelated causes are
confirmed on hardware, both of which destroy the operator's configuration and require an on-radio init plus a
full official-CPS restore:

| Cause                                                                                                   | Status                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Studio transmitting the sector-management markers above                                                 | **Fixed** — [#871](https://github.com/pskillen/codeplug-studio/pull/871), suppression is structural                                                                                                                                                                                                                                                                      |
| A channel **contact word above the boot-check bound**, e.g. `FF FF FF FF` (or `FF FF 00 00`) at `+0x14` | **Fixed** — [#1380](https://github.com/pskillen/codeplug-studio/issues/1380); no contact is now written as 9999 (`0F 27 00 00`). Reproduced in the emulator on stock V1.05; hardware confirmation pending.                                                                                                                                                               |
| Writing a codeplug with **channels but zero zones** — an invalid state for this firmware                | **Open** — [#880](https://github.com/pskillen/codeplug-studio/issues/880) (refusal); [#881](https://github.com/pskillen/codeplug-studio/issues/881) (synthesised "All Channels" zone as the fix)                                                                                                                                                                         |
| Assemble-from-`0xff` leaving **RadioIdSet** (and ChannelSet tail / channel AES) as fill                 | **Not the product contract** — Write encodes onto the in-session download cache ([#875](https://github.com/pskillen/codeplug-studio/issues/875) / [PR #1118](https://github.com/pskillen/codeplug-studio/pull/1118)). Do not implement [#1129](https://github.com/pskillen/codeplug-studio/issues/1129) zeros-as-overlay. Hardware verify of the cache prior is pending. |

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

## Firmware semantics behind the markers

What the firmware does on the PC link (anytone-d890-firmware F274 to F278, with F279, the emulator's PC-mode OS tick and frame-injection harness, behind them; Q82 asks for the radio check of the R-after-W loss and Q83 why a firmware task blocks on hardware, [findings](https://github.com/pskillen/anytone-d890-firmware/blob/main/docs/initial-re/findings.md)), as confirmed by running its real handlers in the emulator:

- **First `W` into a unit** erases that unit's non-live half. Bytes the host never sends read `FF`.
- **Leaving a unit** for the next one writes the PC marker (`22 33 44 55` at `+0x3FBF4`) on the half just written. The marker survives a power-cycle.
- **`END`** marks the unit in progress, then walks every bank and promotes each marked half to live, marking the old half stale. This is why a unit written but never marked is not committed, and why a marked unit is committed by a later session's `END`.
- **An `R` after a `W`** switches the PC-link unit state: the unit being written when the `R` arrives is never marked, and an `R` as the last command before `END` makes `END` skip the walk entirely. See [protocol.md — Session rule](protocol.md#session-rule-no-r-after-the-first-w).
- **Abandoning** a session without `END` leaves marked units pending until some later write-mode `END`: [protocol.md — Abandoned sessions](protocol.md#abandoned-sessions-units-left-pending).

## No commit / erase / swap command

The PROGRAM session is `PROGRAM` → ident → `R`/`W` frames → `END`. A full official-CPS wire capture
(19,960 frames) decoded to only those kinds plus bare `0x06` ACKs — **zero unknown frames**. `END`
receives a bare `0x06` and nothing else follows.

There is **no** separate commit, erase, or bank-swap command on the wire. Writes land according to the
radio's flash sector state; `END` exits the session. Older docs that said "`END` commits" were wrong —
see [protocol.md](protocol.md) for the corrected session description.
