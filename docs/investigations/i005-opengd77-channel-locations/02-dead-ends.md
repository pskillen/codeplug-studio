# Dead ends — do not re-chase

**Append-only.** One line per killed hypothesis, plus what killed it. This file exists because the ticket was first filed as a regression, and because a firmware changelog about "15 fractional bits" looks like a competing channel encoding.

---

## Product / history

| Hypothesis                                                                  | Killed by                                  | Why it's dead                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Serial used to write channel GPS and a later commit removed it          | `S/1233` (git log on the codec); `S/codec` | The "not modelled on write" comment is in the first OpenUV380 channel codec (`b645be87`, #624). Nothing was removed.                                                   |
| Distance display is broken because radio GPS / observer location is missing | `S/userguide`; `S/codec`                   | Radio position is necessary **and** channel lat/lon + Use Location. Studio zeros the channel bytes, which is sufficient to show nothing even when the radio has a fix. |

## Encoding

| Hypothesis                                                                                                       | Killed by                                           | Why it's dead                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel lat/lon are contiguous uint24 at a single offset (like APRS config)                                      | `S/fw-struct`; `S/qdmr-offsets`                     | Lat is split around TOT; lon is split around the tone words. Using `setUInt24_le(0x1a)` would overwrite TOT.                                                                                 |
| qDMR `doc/code/opengd77_channel.txt` is the channel map to implement from                                        | committed channel-record.md citation; `S/fw-struct` | That dump still labels `0x1a` unused and has no lat/lon. Firmware and `ChannelElement` Offset table are current.                                                                             |
| Ship the 2026 `latLon*` binary-fixed-point formula (`modf`, 15 binary fraction bits) into the **channel record** | F16–F20                                             | That changelog is GPS/settings conversion. Channel store is 24 bits with a 0–9999 decimal remainder matching `DD.DDDD`. Binary 0.5° would be `16384` in the low 15 bits; qDMR stores `5000`. |

### Deliberately NOT in this file

- **"qdmr encodeAngle matches official CPS bit-for-bit."** Expected, not proven. Firmware struct packing matches; numeric packing is qDMR + precision coincidence with the user guide. A CPS-written dump (`E1`) is the check. Until then it stays an open item, not a dead end — listing it here would stop the capture.
- **"Read hydration must restore channel location to the library."** Un-decided product scope (`O3`), not a killed hypothesis.
