# AT-D890UV — capabilities

## Feature availability

| Feature      | CPS files           | Studio v1 export                                                                                                                                                                           |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DMR channels | `Channel.CSV`, DMR* | Shipped ([#233](https://github.com/pskillen/codeplug-studio/issues/233))                                                                                                                   |
| Scan lists   | `ScanList.CSV`      | Shipped                                                                                                                                                                                    |
| AM air       | `AMAir.CSV`         | Channel bank export shipped ([#267](https://github.com/pskillen/codeplug-studio/issues/267)); `AMZone.CSV` export shipped ([#316](https://github.com/pskillen/codeplug-studio/issues/316)) |
| Broadcast FM | `FM.CSV`            | Channel bank export shipped ([#268](https://github.com/pskillen/codeplug-studio/issues/268)); **no `FMZone.CSV` on D890**                                                                  |
| NXDN         | `NX*.CSV`           | Wire documented; export deferred ([#247](https://github.com/pskillen/codeplug-studio/issues/247))                                                                                          |
| APRS         | `APRS.CSV`          | Shipped — conditional when `library.aprsConfiguration` exists ([#251](https://github.com/pskillen/codeplug-studio/issues/251))                                                             |

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes   | TX           |
| ---------- | ------- | ------------ |
| 136–174    | FM, DMR | Yes          |
| 400–480    | FM, DMR | Yes          |
| 108–136    | AM      | Yes          |
| 87.5–108   | FM      | Receive-only |

Source: Studio Anytone bank docs + common CPS clamps.

### Satellite transmitter mode support (Studio write eligibility) — placeholder, not hardware-verified

Distinct question from the frequency-range table above: that table filters standard DMR/FM/AM
**channel** RF band and TX eligibility, not which **demodulation modes** the D890 can use to
track a satellite transmitter/transponder ([#1068](https://github.com/pskillen/codeplug-studio/issues/1068)).
Neither anytone-cps nor qdmr GPL source declares a satellite-mode capability list at all — this
is a genuine absence, not a narrower table this doc simply hasn't ported yet, so there is nothing
to reuse or cross-check against here.

Studio ships a small **denylist** of modes believed unsupported (`isModeSupportedByAtD890`,
`src/core/radios/anytone/at-d890uv/satelliteCapability.ts`), on the reasoning that the D890 is a
DMR/analog-FM handheld with no documented SSB/CW/digital-transponder demodulation hardware. A
denylist (rather than an allowlist) is deliberate: `SatelliteTransmitter.mode` is free text with
no closed taxonomy, so an allowlist would silently reject any mode spelling Studio hasn't seen.
Unknown/unrecognised mode strings default to **supported**.

| Mode  | Supported? | Basis                                                             |
| ----- | ---------- | ----------------------------------------------------------------- |
| FM    | Yes        | Native D890 demodulation                                          |
| DMR   | Yes        | Native D890 demodulation                                          |
| SSTV  | **No**     | Placeholder — issue's own example; image mode, no D890 demod path |
| SSB   | **No**     | Placeholder — no documented SSB demodulation on this handheld     |
| CW    | **No**     | Placeholder — no documented CW demodulation on this handheld      |
| other | Yes        | Unrecognised — defaults to supported, not silently dropped        |

## Related

- [limits.md](limits.md) · [power.md](power.md)
- Trait recommendation: [Anytone README](../../../export-formats/anytone/README.md)
