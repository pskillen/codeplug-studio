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

### Satellite transmitter mode support (Studio write eligibility) — operator-confirmed on real hardware

Distinct question from the frequency-range table above: that table filters standard DMR/FM/AM
**channel** RF band and TX eligibility, not which **demodulation modes** the D890 can use to
track a satellite transmitter/transponder ([#1068](https://github.com/pskillen/codeplug-studio/issues/1068),
revised [#1086](https://github.com/pskillen/codeplug-studio/issues/1086)). Neither anytone-cps nor
qdmr GPL source declares a satellite-mode capability list at all — this is a genuine absence, not
a narrower table this doc simply hasn't ported yet, so there is nothing to reuse or cross-check
against here.

**#1086 reversed the original approach.** The #1068 implementation shipped a small **denylist**
of modes believed unsupported (`SSTV`/`SSB`/`CW`), with unrecognised mode strings defaulting to
*supported* — a placeholder guess made with no hardware access, deliberately permissive because
there was no positive evidence either way. An operator has since **directly confirmed on real
D890 hardware** that satellite tracking only works with **FM** (and narrowband-FM spellings) —
other modes, including some the old denylist didn't even cover (GMSK, AFSK, DUV), silently failed
in the field. Given that stronger evidence, Studio now ships an **allowlist**
(`isModeSupportedByAtD890`, `src/core/radios/anytone/at-d890uv/satelliteCapability.ts`) of
FM-family mode strings, and unrecognised/unknown mode strings now default to **NOT supported** —
an intentional reversal of the previous default, made because real hardware evidence now points
at a narrow FM-only capability rather than "no evidence either way."

| Mode                              | Supported? | Basis                                                                                                         |
| ---------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| FM                                 | Yes        | Directly confirmed on real D890 hardware (#1086)                                                              |
| FMN / NFM / FM Narrow / Narrow FM  | Yes        | Reasonable narrowband-FM spelling variant of the confirmed FM family — not independently hardware-confirmed  |
| GMSK                               | **No**     | Operator-reported failing on real hardware (#1086)                                                            |
| AFSK                               | **No**     | Operator-reported failing on real hardware (#1086)                                                            |
| DUV                                 | **No**     | Operator-reported failing on real hardware (#1086)                                                            |
| SSTV                                | **No**     | Not FM-family; previously denylisted, still unsupported                                                       |
| SSB                                 | **No**     | Not FM-family; previously denylisted, still unsupported                                                       |
| CW                                  | **No**     | Not FM-family; previously denylisted, still unsupported                                                       |
| other / unrecognised                | **No**     | Not on the FM-family allowlist — defaults to unsupported (reversed from #1068)                                |

Note: `DMR` satellite transmitters are out of scope for this table — the D890's satellite write
path targets analogue FM transponders/repeaters, and `SatelliteTransmitter.mode` here refers to
the transponder's downlink demodulation mode, not the D890's DMR channel capability described
elsewhere in this document.

## Related

- [limits.md](limits.md) · [power.md](power.md)
- Trait recommendation: [Anytone README](../../../export-formats/anytone/README.md)
