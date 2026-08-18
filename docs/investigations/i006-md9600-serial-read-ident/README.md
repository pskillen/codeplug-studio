# i006 — MD-9600 Web Serial Read returned FirmwareInfo, not FLASH

**Opened:** 2026-08-18
**Closed:** 2026-08-18
**Cost:** one calendar day, two Studio Backups, three dump-CLI probes, one hang that almost became a map rewrite
**Outcome:** OpenUV380 bases are correct. The first Backup finished while the radio was hung and tiled the FirmwareInfo prefix into every 32-byte FLASH block. Inspect decoded that as names. A later healthy Backup displays correctly.

**Technical conclusion lives in** [protocol.md](../../reference/radios/opengd77/protocol.md) (one hung session’s `'R'` replies) **and** [memory-layout.md](../../reference/radios/opengd77/memory-layout.md) (OpenUV380 bases unchanged). Dump CLI: [radio-memory-dump](../../../dev-tools/radio-memory-dump/README.md). Ticket: [#1244](https://github.com/pskillen/codeplug-studio/issues/1244).

Promoted from live notes in `tmp/investigations/i006-md9600-serial-read-ident/` (gitignored). Number **i006** is used; do not reuse.

|                   |                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**       | Backup inspect showed garbage hex-like channel/TG names; zones/contacts missing. Fear: wrong FLASH map ⇒ Write also wrong.                    |
| **Root cause**    | Hung radio. 32-byte `'R'` replies were the first 32 bytes of FirmwareInfo, repeated. Download still completed (`expectedLength` 32).          |
| **Introduced by** | Not a Studio offset regression. `OPENUV380_OFFSET` / `OPENUV380_FLASH_SPANS` unchanged since `b645be87` (2026-07-24).                         |
| **Masked by**     | Span _sizes_ matching the map; inspect treating occupancy as “not all `0xff`”; FirmwareInfo ASCII (`dd73274`, `20241215`) looking like names. |
| **Fixed by**      | Nothing to retarget. Healthy Backup (`11:31Z`) decodes at documented bases. Do not Restore the hung zip.                                      |

---

## What the failure looked like

Operator hardware: TYT MD-9600 / RT-90, OpenGD77 `radioType` `05h`, firmware `dd73274`, build date prefix `20241215`. Prod Write already enabled ([#788](https://github.com/pskillen/codeplug-studio/issues/788)).

`08:46Z` Web Serial Backup: four restorable FLASH spans, lengths exactly `OPENUV380_FLASH_SPANS`, **100%** this 32-byte tile (FirmwareInfo prefix, not a full 46-byte ident frame):

```
03 00 00 00 05 00 00 00 64 64 37 33 32 37 34 00
00 00 00 00 00 00 00 00 32 30 32 34 31 32 31 35
```

Inspect listed `dd73274` / `20241215` as “names”. Zone/contact codecs skip names starting `0x00`, so those lists looked empty.

That is not a general hang detector. The next unresponsive radio may stall, return different garbage, or fail the session. This session happened to ACK 32-byte ident-shaped payloads until the zip was full.

---

## Root cause

Studio `download()` asks for FLASH (`'R'` mem `01h`, length 32) after ident (`09h`, 46 bytes) and SHOW_CPS. A 46-byte FirmwareInfo reply on a 32-byte read would throw. The hung radio returned **32-byte** ident-shaped blocks, so the session finished.

Live inspect uses `extractHydration` on that download image — not zip reconstruct — so the bins _are_ what inspect showed.

Dump CLI (`dev-tools/radio-memory-dump`) issues a distinct `'R'` per mem/addr. While hung, FLASH and EEPROM at `0x3780` (and FLASH at `0x80`) were the same tile. After the radio recovered, the same addresses were a real channel-bank window (bitmask + first name `GB7EM Aberdeen`), with or without `--ident`.

---

## The proof

| Capture            | Radio                              | What `'R'` / the zip contained                                                                                                                   |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `08:46Z` Backup    | hung (inferred; session completed) | 100% ident tile across four FLASH spans                                                                                                          |
| Dump CLI `E1`/`E2` | hung                               | Ident tile at `0x3780` (FLASH and EEPROM; skip-ident still tile)                                                                                 |
| Dump CLI `E3`      | recovered                          | Channel-bank window at `0x3780`; ident did not replace it                                                                                        |
| `11:31Z` Backup    | not hung                           | Real OpenUV380 codeplug: 113 channels, 11 zones, 39 contacts, 12 RX lists. Inspect displays correctly. `channelBank0` first 32 bytes match `E3`. |

One variable that discriminated: whether the radio was responsive. Mem `01h` vs `02h`, skip-ident, and “map recently moved” did not.

---

## Process failures

### 1. Span length was treated as FLASH content

The hung zip had the right region sizes. That is equally consistent with a radio that ACKs 32-byte junk until the span is full.

> **A result that matches proves nothing.** Occupancy and span length are not a codeplug.

### 2. Probes ran on a hung radio and almost became a map rewrite

`E1`/`E2` ident tiles were measured while the radio was hung. Sticky ident and EEPROM-for-low-banks looked live until a recovered session (`E3`) and a healthy Backup.

> **Do not retarget `OPENUV380_OFFSET` from a dump taken while the radio is unresponsive.**

### 3. FirmwareInfo ASCII looked like channel names

`dd73274` / `20241215` are ident fields. Channel occupancy is “name/freq not all `0xff`”, so a repeating ident prefix lists as occupied junk.

> **Do not treat ident ASCII as channel names.**

### 4. Download finishing was treated as proof of FLASH

Length-32 replies completed. That only proves the radio returned 32 bytes per block, not that those bytes were FLASH.

---

## Still open (not this investigation)

- **Do not Restore the `08:46Z` zip** — it would program ident tiles. The `11:31Z` zip is the keepable image. Operator artefacts stay in Downloads; not committed.
- **Write `'X'`** was not measured here. Prod Write stays as #788 left it. This ticket was a Read scare, not a Write proof.
- **EEPROM `'R'` at `0x3780` matching FLASH** on the recovered radio is unexplained. Not a reason to rewrite the adapter.
- **No hang detector in Backup/Restore.** This dump shape is an edge case; the next hang may look different.

---

## Related

- [evidence.md](evidence.md) — condensed ledger
- [dead-ends.md](dead-ends.md)
- [#1244](https://github.com/pskillen/codeplug-studio/issues/1244) · dump CLI [PR #1246](https://github.com/pskillen/codeplug-studio/pull/1246)
- Adapter [#625](https://github.com/pskillen/codeplug-studio/issues/625) · Write gate [#788](https://github.com/pskillen/codeplug-studio/issues/788) · epic [#634](https://github.com/pskillen/codeplug-studio/issues/634)
