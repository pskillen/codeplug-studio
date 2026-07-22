# Retevis RT95 VOX

Mobile / base analogue FM radio (AnyTone 778UV family). Studio targets it via CHIRP CSV (`RetevisRT95vox`) and (planned) Web Serial direct-write.

|                  |                                       |
| ---------------- | ------------------------------------- |
| **Manufacturer** | Retevis                               |
| **Model**        | RT95 VOX                              |
| **Aliases**      | RT95 (non-VOX sibling — different allow-list) |
| **Max RF**       | ~25 W (CHIRP High ≈ 44 dBm)           |
| **CHIRP driver** | `RetevisRT95vox` in `anytone778uv.py` |

> **CHIRP CSV wire ≠ binary clone image.** File interchange lives under [export-formats/chirp](../../../export-formats/chirp/README.md). PROGRAM→QX memory maps, channel records, and handshake framing live in the binary docs below.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** [#642](https://github.com/pskillen/codeplug-studio/issues/642) (blocks adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643); parent epic [#640](https://github.com/pskillen/codeplug-studio/issues/640))

## Studio profile ids

| Adapter   | `profileId`  | Notes                                             |
| --------- | ------------ | ------------------------------------------------- |
| CHIRP CSV | `chirp-rt95` | Generic CSV watt strings; 6-char names, 200 slots |

## Documentation map

| Doc                                    | Contents                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| [limits.md](limits.md)                 | Memory slots, name length                                            |
| [capabilities.md](capabilities.md)     | Modes, organisation traits                                           |
| [power.md](power.md)                   | High / Medium / Low ladder (internal %)                              |
| [memory-layout.md](memory-layout.md)   | Contiguous image ≈ `0x0000`–`0x3290` (`0x32A0` bytes)                |
| [channel-record.md](channel-record.md) | 32-byte channel layout + enums                                       |
| [settings.md](settings.md)             | Settings / DTMF / PTT-ID / keys / VOX / bandlimit; RMW notes         |
| [protocol.md](protocol.md)             | Baud, PROGRAM→QX, echo-strip, R/W frames, checksum, model allow-list |
| [fixtures.md](fixtures.md)             | How to capture dumps for tests without committing personal codeplugs |

## Adapter wire (files)

- [CHIRP export-format](../../../export-formats/chirp/README.md) — CSV columns / verification (**not** binary offsets)

## Direct read/write (binary)

PROGRAM→QX clone protocol for Web Serial. See the binary docs in the map above. Kit codec for this family is sibling [#641](https://github.com/pskillen/codeplug-studio/issues/641) (`programQx.ts`) — out of scope for this docs ticket.

## Ground truth (cite; do not copy)

CHIRP is **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio. NeonPlug has **no** RT95 / 778 path.

| Source                                                                                                                    | Role                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| CHIRP `RetevisRT95vox` / `AnyTone778UVBase` in [`anytone778uv.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/anytone778uv.py) | Caps, PROGRAM→QX, contiguous image, channel/settings map |
| Fixture `formats/chirp/__fixtures__/export/Retevis_RT95 VOX_20251106.csv`                                                 | CHIRP CSV export shape only                       |

## Attribution

Protocol lineage credit: `/attributions` entry `chirp` ([#597](https://github.com/pskillen/codeplug-studio/issues/597)). Planned `RadioDescriptor.attributionIds` for the RT95 adapter should include `chirp`.

## Planned Studio module

`src/integrations/radio-io/radios/rt95/` — handshake, layout, encode (see [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md)). This ticket ships **docs only**.

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#640](https://github.com/pskillen/codeplug-studio/issues/640) · memory RE [#642](https://github.com/pskillen/codeplug-studio/issues/642) · adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643) · kit codec [#641](https://github.com/pskillen/codeplug-studio/issues/641)
- CHIRP CSV extract [#621](https://github.com/pskillen/codeplug-studio/issues/621) · earlier epic [#594](https://github.com/pskillen/codeplug-studio/issues/594)
