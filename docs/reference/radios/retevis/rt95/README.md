# Retevis RT95 VOX

Mobile / base analogue FM radio (AnyTone 778UV family). Studio targets it via CHIRP CSV (`RetevisRT95vox`) and **Web Serial** direct-write (`radio-io-rt95`).

|                  |                                               |
| ---------------- | --------------------------------------------- |
| **Manufacturer** | Retevis                                       |
| **Model**        | RT95 VOX                                      |
| **Aliases**      | RT95 (non-VOX sibling — different allow-list) |
| **Max RF**       | ~25 W (CHIRP High ≈ 44 dBm)                   |
| **CHIRP driver** | `RetevisRT95vox` in `anytone778uv.py`         |

> **CHIRP CSV wire ≠ binary clone image.** File interchange lives under [export-formats/chirp](../../../export-formats/chirp/README.md). PROGRAM→QX memory maps, channel records, and handshake framing live in the binary docs below.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** epic [#640](https://github.com/pskillen/codeplug-studio/issues/640) (memory RE [#642](https://github.com/pskillen/codeplug-studio/issues/642) · kit [#641](https://github.com/pskillen/codeplug-studio/issues/641) · adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643))

## Studio profile ids

| Adapter        | `profileId`            | Notes                                                                              |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| CHIRP CSV      | `chirp-rt95`           | Generic CSV watt strings; 6-char names, 200 slots                                  |
| Web Serial I/O | `radio-io-rt95`        | PROGRAM→QX @ 9600; `retevis-rt95` radio target                                     |
| Web Serial I/O | `radio-io-rt95-mm9pdy` | MM9PDY modded firmware: zones and descriptions; `retevis-rt95-mm9pdy` radio target |

## Documentation map

| Doc                                    | Contents                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| [limits.md](limits.md)                 | Memory slots, name length and characters, steps, tone lists                |
| [capabilities.md](capabilities.md)     | Modes, organisation traits                                                 |
| [power.md](power.md)                   | High / Medium / Low ladder (internal %)                                    |
| [memory-layout.md](memory-layout.md)   | Contiguous image ≈ `0x0000`–`0x3290` (`0x32A0` bytes)                      |
| [channel-record.md](channel-record.md) | 32-byte channel layout + enums                                             |
| [settings.md](settings.md)             | Settings / DTMF / PTT-ID / keys / VOX / bandlimit; RMW notes               |
| [protocol.md](protocol.md)             | Baud, PROGRAM→QX, echo-strip, R/W frames, checksum, model allow-list       |
| [backup-restore.md](backup-restore.md) | Zip clone region; Restore via clone `upload`; Write overlays in-session    |
| [mm9pdy-data.md](mm9pdy-data.md)       | MM9PDY zones and descriptions table (MMD1) at `0x4000`: guard, write rules |
| [fixtures.md](fixtures.md)             | How to capture dumps for tests without committing personal codeplugs       |
| [firmware.md](firmware.md)             | Front panel firmware flasher: stock pin, sources, update mode, protocol    |

## Mixing Studio and the stock CPS

If you program the same radio with both tools, know what each leaves behind ([#1464](https://github.com/pskillen/codeplug-studio/issues/1464); stock-CPS facts from the firmware project's CPS reference, F110-F130, read in the CPS code and not observed on a radio):

| Sequence                                  | What happens                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio Write, then stock CPS Read + Write | Channel names: anything outside `0-9 A-Z -` (lower case, `/`, `.`, `_`) reads as a space and is written back as a space. The CPS also zeroes every byte it does not model (the gap ranges between DTMF and `0x3200`, tails of DTMF/tone records, `0x30ED`–`0x30EF`); none of those is a field Studio writes today |
| Studio Write, then stock CPS Read         | Channel signalling (DTMF ID, 5-Tone ID, optional signalling) shows as Off, because a Studio channel write resets it ([Write principle](channel-record.md#write-principle))                                                                                                                                        |
| Stock CPS Write, then Studio Read         | Names read correctly. A 20 kHz or custom-CTCSS channel is mis-read (as 25 kHz / no tone) and written back that way by Studio                                                                                                                                                                                      |
| Stock CPS Write (MM9PDY radio)            | The CPS cannot reach `0x4000`–`0x5FFF`, so zones and descriptions survive; a CPS-edited channel hides its description until the next MM9PDY Write. The P-key set to DIR survives                                                                                                                                  |
| Stock CPS Write                           | Refused with no normal channel ("Leave at least one normal channel!"), with an empty VFO, or when the radio's band differs from the file's                                                                                                                                                                        |
| Stock CPS Write after Studio DTMF edits   | The CPS recomputes the DTMF memory in-use mask `0x326E`; Studio does not (known gap)                                                                                                                                                                                                                              |

The stock CPS is documented for serial numbers 202101-202312 only; do not use it on units outside that range.

## Adapter wire (files)

- [CHIRP export-format](../../../export-formats/chirp/README.md) — CSV columns / verification (**not** binary offsets)

## Direct read/write (binary)

PROGRAM→QX clone protocol for Web Serial — see the binary docs in the map above.

| Layer         | Path                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Kit codec     | `src/integrations/radio-io/kit/codecs/programQx.ts` ([#641](https://github.com/pskillen/codeplug-studio/issues/641)) |
| Radio adapter | `src/integrations/radio-io/radios/rt95/` ([#643](https://github.com/pskillen/codeplug-studio/issues/643))            |

## Ground truth (cite; do not copy)

CHIRP is **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio. NeonPlug has **no** RT95 / 778 path.

| Source                                                                                                                                       | Role                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| CHIRP `RetevisRT95vox` / `AnyTone778UVBase` in [`anytone778uv.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/anytone778uv.py) | Caps, PROGRAM→QX, contiguous image, channel/settings map |
| Fixture `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv`                                                                    | CHIRP CSV export shape only                              |

## Attribution

Protocol lineage credit: `/attributions` entry `chirp` ([#597](https://github.com/pskillen/codeplug-studio/issues/597)). `RadioDescriptor.attributionIds` includes `chirp`.

## Shipped Studio module

`src/integrations/radio-io/radios/rt95/` — full-image RMW Write (channels + occupancy/scan bitfields); settings / DTMF / bandlimit retained from an in-session pre-write read (no persisted stash). Radio image inspector ([#732](https://github.com/pskillen/codeplug-studio/issues/732)). Write available on all deploy environments ([#761](https://github.com/pskillen/codeplug-studio/issues/761)); CHIRP CSV file egress remains available.

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#640](https://github.com/pskillen/codeplug-studio/issues/640) · sibling radios [#644](https://github.com/pskillen/codeplug-studio/issues/644) (out of scope)
- CHIRP CSV extract [#621](https://github.com/pskillen/codeplug-studio/issues/621) · earlier epic [#594](https://github.com/pskillen/codeplug-studio/issues/594)
