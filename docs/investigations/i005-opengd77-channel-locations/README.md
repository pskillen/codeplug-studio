# i005 — OpenGD77 channel locations on Web Serial write

**Hub for this investigation.** Opened from [#1233](https://github.com/pskillen/codeplug-studio/issues/1233) (operator report: DM-1701 / RT-84 distance-from-repeater empty after Web Serial write).

**Status:** **Open** — implementation in progress on branch `1233/pskil/opengd77-channel-locations`. Packed-angle layout, split byte offsets, and `Use Location` flag are known from qDMR plus OpenGD77 `CodeplugChannel_t`. CSV export already serialises the same library fields; Web Serial write is being wired through `RadioChannelDto` → `encodeChannelRecord()`.

**Prime suspect:** confirmed omission, not a regression. `encodeChannelRecord()` left `0x1a`–`0x1f` / `0x24` zero and never set flags bit 3. `RadioChannelDto` had no location field, so the projection could not carry one.

**Next move:** ship write path + codec tests; hardware verify distance-from-repeater (`E1`).

|                        |                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opened**             | 2026-08-17                                                                                                                                                              |
| **Closed**             | —                                                                                                                                                                       |
| **Tickets**            | [#1233](https://github.com/pskillen/codeplug-studio/issues/1233)                                                                                                        |
| **Intended behaviour** | Library `Channel.location` + `useLocation` pack into the 56-byte channel record so the radio can show distance-from-repeater / roaming / Show dist when the flag is on. |

---

## Read in this order

| File                                                           | What it is                              | Mutability                           |
| -------------------------------------------------------------- | --------------------------------------- | ------------------------------------ |
| this file                                                      | status, strategy, rules                 | status line changes; rest is stable  |
| [`01-findings.md`](01-findings.md)                             | what is **true**, each with a citation  | **append-only**                      |
| [`02-dead-ends.md`](02-dead-ends.md)                           | killed hypotheses + what killed them    | **append-only**                      |
| [`03-ledger.md`](03-ledger.md)                                 | one row per run / capture / source read | **rows are immutable**               |
| [`04-packed-angle-reference.md`](04-packed-angle-reference.md) | bit layout, offsets, worked examples    | append-only facts; examples may grow |
| [`05-open-items.md`](05-open-items.md)                         | open work only                          | edited as things ship                |
| [`errands/`](errands/README.md)                                | two-way briefs and reports              | one file per errand                  |

Settled radio-layout facts that already live in committed docs should be **cited, not duplicated**: [channel-record.md](../../reference/radios/opengd77/channel-record.md), [Channels.csv](../../reference/export-formats/opengd77/channels.md). This directory holds the investigation of the _missing write path_ and packed-angle formula until promoted into tier-3 reference.

## Current strategy

Treat qDMR `OpenGD77BaseCodeplug::ChannelElement` as the write-side recipe Studio already cites for every other field in this record, then independently confirm packing against OpenGD77 firmware `CodeplugChannel_t` (same offsets, LS/MS bytes, `USE_LOCATION = 0x08`). Do **not** copy qDMR's "stamp global GNSS onto every channel then maybe override" encode path — Studio already has per-channel `location` + `useLocation`.

Encode with **round** `abs(angle) * 10000` (not qDMR truncate). Decode populates `RadioChannelDto` only — no Read→library hydration.

## Rules of engagement

- **A result that matches proves nothing.** Encoding Edinburgh as qDMR would, and then seeing _some_ distance on the radio, does not prove the packing is right — a wrong scale can still produce a non-zero km. Discriminator: round-trip a CPS-written record (`E1`) or match known bytes from a dump.
- **qdmr is evidence of what qdmr writes, not of what official CPS writes.** They are expected to match (same firmware struct), but that is an inference until a CPS dump exists. Do not close `E1` by reading qDMR again.
- **The 2026 `latLon*` changelog is not a channel-record spec.** It describes a conversion bug in `uiUtilities.c` for radio GPS / APRS / Maidenhead. Channel bytes are a different store.
- **Firmware comments can be wrong.** `locationLon2` is labelled "Latitude MS byte" in `codeplug.h`. Offsets and LS/MS comments are load-bearing; the word "Latitude" on the lon byte is not.
- **`doc/code/opengd77_channel.txt` in qDMR is stale.** It still calls `0x1a` unused. Studio's channel-record doc already prefers `ChannelElement` over that file — keep doing that.
- **Do not copy qDMR global GNSS onto channels.** qDMR `encode()` writes the radio-wide GNSS fix to every channel, then overwrites from the OpenGD77 channel extension. Studio library channels already carry their own coordinates.
- **Cite, do not restate** committed radio docs. When a fact is promoted into `docs/reference/radios/opengd77/channel-record.md`, delete it from findings and leave a "settled elsewhere" row.
