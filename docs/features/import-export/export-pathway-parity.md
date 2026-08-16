# Export pathway parity

**Tracking:** [#776](https://github.com/pskillen/codeplug-studio/issues/776) (epic) · contract [#778](https://github.com/pskillen/codeplug-studio/issues/778) · harness [#779](https://github.com/pskillen/codeplug-studio/issues/779)

## Purpose

For every radio Codeplug Studio supports, the operator may export the same **radio build** through more than one **egress pathway**: CPS CSV, Web Serial Write (`radio-io`), and NeonPlug (where shipped). Those pathways must project the **same semantics** unless a build capability trait, profile cap, or wire-encoding limit genuinely forbids it.

This document is the **parity contract** (what must match vs what may differ) and a **divergence inventory** linked to remediation tickets. It complements per-format export docs and tier-3 wire references — it does not duplicate CPS column tables.

**North star:** radios should only diverge where traits, profile caps, and wire limits actually differ — not because CSV and serial (or sibling CPS formats) run divergent projection pipelines.

**Testing:** pathway equality is **directional** (constructed library + build → compare egress outputs). It is orthogonal to import↔export round-trip gates — see [DESIGN.md — Testing](../../../DESIGN.md#testing) and [pathway parity tests](../../build/testing/pathway-parity.md).

## Egress pathways per radio

| Radio                 | CPS CSV  | Web Serial                 | NeonPlug             |
| --------------------- | -------- | -------------------------- | -------------------- |
| Baofeng DM-1701/RT-84 | OpenGD77 | `radio-io-opengd77-1701`   | —                    |
| TYT MD-9600/RT-90     | OpenGD77 | `radio-io-opengd77-md9600` | —                    |
| Anytone AT-D890UV     | Anytone  | `radio-io-at-d890uv`       | —                    |
| Baofeng DM-32UV       | DM32     | `radio-io-dm32uv`          | `neonplug-dm32uv`    |
| Baofeng UV-5R Mini    | CHIRP    | `radio-io-uv5r-mini`       | `neonplug-uv5r-mini` |
| Baofeng UV-21Pro V2   | CHIRP    | `radio-io-uv21`            | —                    |
| Retevis RT95 VOX      | CHIRP    | `radio-io-rt95`            | —                    |

All pathways share `assemble(build, library)` as the organisation entry point. Divergence bugs appear when a pathway bypasses shared expansion, naming, or default-resolution helpers.

## Must match

When the wire format or pathway can express the fact, these dimensions must agree across every egress of the **same** radio target.

| #   | Dimension                                    | What "match" means                                                                                                                                                                                                     | Code anchors                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Channel wire name**                        | Same base compose (callsign/name per export name mode), abbreviation policy (strategy-when-over-limit, not unconditional substitution), shortening trigger, override precedence, multi-mode / multi-TG suffix handling | `src/core/domain/channelNaming.ts` · `src/core/import-export/channelExpansion/exportWireNames.ts` · radio-io lean channel DTOs resolve via `src/core/services/resolveWireNames.ts` (CSV serialisers still call the primitives directly; repointing them is tracked separately) |
| 2   | **Row / channel cardinality**                | Same exported row count per canonical channel: multi-mode fan-out, M×N repeater×talkgroup fan-out, scratch rows, unsupported-mode dropping                                                                             | `mxnExpandAll.ts` · `opengd77ExportModes.ts` · `talkGroupTimeslotClones.ts`                                                                                                                                                                                                    |
| 3   | **Scan / skip flags**                        | Skip / Zone Skip mirror the same effective scan-inclusion value; per-channel `scanInclusionOverride` honoured identically                                                                                              | `src/core/import-export/scanInclusion/`                                                                                                                                                                                                                                        |
| 4   | **Zone / scan-list / RX-group membership**   | Same expanded slot rows, same ordering                                                                                                                                                                                 | per-format `channelExpansion.ts` · `listWireNames.ts`                                                                                                                                                                                                                          |
| 5   | **Site / repeater wire names**               | Same composer regardless of pathway (where distinct from channel names)                                                                                                                                                | `formats/anytone/channelExpansion.ts` (`resolveAnytoneSiteWireName`) · `services/anytoneChannelExpansion.ts`                                                                                                                                                                   |
| 6   | **Talk group / contact naming**              | Same names, same FK resolution strategy per format family; timeslot-clone naming                                                                                                                                       | `talkGroupWireNames.ts` · `multiTalkGroupWireName.ts` · `talkGroupTimeslotClones.ts` · radio-io talk group/contact/RX-group-list names resolve via `resolveWireNames.ts`                                                                                                       |
| 7   | **Power, tone, bandwidth, squelch defaults** | Same default for unmodelled fields on every pathway (e.g. null `bandwidthKHz` → 12.5 kHz / NFM)                                                                                                                        | `channelBehaviourDefaults/`                                                                                                                                                                                                                                                    |
| 8   | **Name-length / count caps**                 | Same numeric cap across pathways for the same radio — not independently duplicated constants that merely agree today                                                                                                   | format profiles · `formats/radio-io/profiles.ts` · `profileExportLimits.ts`                                                                                                                                                                                                    |
| 9   | **Organisation / library membership**        | Same zone/list inclusion rules (`exportUnlinkedChannels`, `zoneGrouping` layout)                                                                                                                                       | `src/core/services/assemble.ts`                                                                                                                                                                                                                                                |
| 10  | **Character sanitisation**                   | Identical ASCII normalisation                                                                                                                                                                                          | `sanitiseAsciiWireString.ts`                                                                                                                                                                                                                                                   |

See also [name-shortening.md](name-shortening.md) for the documented abbreviation-when-over-limit spec.

## May legitimately differ

Document as **loss** or **trait**, not as a pathway bug:

- **Fields a wire format cannot carry** — e.g. CHIRP flat-memory CSV has no per-channel scan-list concept the way DMR CSV does; NeonPlug radio-settings merge vs CPS CSV's lossy `APRS.md`-guide approach.
- **Genuine trait differences between radios** (not between pathways of the same radio) — e.g. OpenGD77 DM-1701/MD-9600 correctly drop YSF/D-STAR/P25/NXDN/M17/TETRA rows; flat-memory CHIRP radios have no zones.
- **NeonPlug index FKs vs CSV name FKs** — architectural format difference; never "fix" by making one pathway match the other's relationship-key strategy.
- **Deliberate per-radio export defaults** — e.g. `exportZoneDerivedScanLists` may differ between Anytone and DM32 as a product decision, but **the same radio's** CSV, serial, and NeonPlug egresses must still agree with each other.

## Root-cause taxonomy

Recurring divergence patterns from the 2026-07 investigation:

| Key     | Pattern                                                                    | Example                                                                                                                              |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **(a)** | Format wrapper bypasses shared engine                                      | Historical: Anytone/CHIRP unconditional-abbreviation wrappers (fixed [#780](https://github.com/pskillen/codeplug-studio/issues/780)) |
| **(b)** | Manually mirrored constants that can drift                                 | `nameLimit` declared in CSV profile, radio-io profile, and `profileExportLimits`                                                     |
| **(c)** | Shared function wired with per-format defaults via comment, not derivation | `getFormatExportDefaults()` for `radio-io-opengd77-*` missing OpenGD77 scan default                                                  |
| **(d)** | New pathway added without threading a callback the original relied on      | radio-io M×N expansion without `resolveSiteWireName`                                                                                 |

## Divergence inventory

Actionable findings from the pathway audit (2026-07). Fix and lock tickets are children of [#776](https://github.com/pskillen/codeplug-studio/issues/776).

| #   | Radio(s) | Dimension | Ticket | Severity | Summary |
| --- | -------- | --------- | ------ | -------- | ------- |

**Closed (clean):** [#777](https://github.com/pskillen/codeplug-studio/issues/777) — OpenGD77 channel wire naming parity (CSV ↔ serial) · [#780](https://github.com/pskillen/codeplug-studio/issues/780) — Anytone + CHIRP channel abbreviation policy (shorten-time only; CSV ↔ serial) · [#781](https://github.com/pskillen/codeplug-studio/issues/781) — dual-mode row cardinality · [#782](https://github.com/pskillen/codeplug-studio/issues/782) — AT-D890UV lean site wire names (length cap + ASCII sanitisation on serial) · [#783](https://github.com/pskillen/codeplug-studio/issues/783) — `scanInclusionOverride` · [#803](https://github.com/pskillen/codeplug-studio/issues/803) — default scan inclusion · [#804](https://github.com/pskillen/codeplug-studio/issues/804) — DM-32UV RX group list count cap (CSV ↔ serial ↔ NeonPlug) · [#805](https://github.com/pskillen/codeplug-studio/issues/805) — DM-32UV zone-derived scan-list count cap · [#806](https://github.com/pskillen/codeplug-studio/issues/806) — UV-5R Mini NeonPlug `defaultScanInclusion` (`skip`, radio SoT; matches CHIRP / serial) · [#807](https://github.com/pskillen/codeplug-studio/issues/807) — UV-21/RT95 slot collision handling (CSV ↔ serial) · [#808](https://github.com/pskillen/codeplug-studio/issues/808) — UV-21 AM export parity (CSV `Mode=AM`; serial FM wide).

**Lock suites (harness consumers):** [#784](https://github.com/pskillen/codeplug-studio/issues/784) DM-32UV · [#785](https://github.com/pskillen/codeplug-studio/issues/785) UV-5R Mini · [#786](https://github.com/pskillen/codeplug-studio/issues/786) UV-21 + RT95.

### Config-drift notes (not separate tickets)

Low-severity risks to address alongside adjacent fixes:

| #   | Radio(s)           | Note                                                                                  | Root cause |
| --- | ------------------ | ------------------------------------------------------------------------------------- | ---------- |
| 12  | DM-32UV            | `exportZoneDerivedScanLists` explicit on CSV adapter but omitted on radio-io/NeonPlug | (c)        |
| 13  | DM-32UV            | `radio-io-dm32uv` profile omits `scanListNameLimit` / `rxGroupListNameLimit` fields   | (b)        |
| 14  | All radios         | `nameLimit` declared up to three times per radio (currently in sync)                  | (b)        |
| 15  | AT-D890UV, DM-32UV | radio-io `getFormatExportDefaults` mirrors CSV via comment, not derivation            | (c)        |

### Confirmed clean (no divergence)

- OpenGD77 channel wire naming ([#777](https://github.com/pskillen/codeplug-studio/issues/777), re-confirmed under stress).
- Anytone + CHIRP channel wire naming — shorten-time abbreviation only; CSV ↔ serial match ([#780](https://github.com/pskillen/codeplug-studio/issues/780)).
- OpenGD77 dual-mode row cardinality and zone fan-out ([#781](https://github.com/pskillen/codeplug-studio/issues/781)).
- OpenGD77 scan/skip flags — default `scan` and per-channel override ([#783](https://github.com/pskillen/codeplug-studio/issues/783), [#803](https://github.com/pskillen/codeplug-studio/issues/803)).
- M×N row cardinality for AT-D890UV and DM-32UV (CSV and radio-io call identical `expandAllMxNChannels()`).
- AT-D890UV site / repeater wire names — lean and fan-out rows match CSV (length cap + ASCII sanitisation via `resolveAnytoneSiteWireName` on serial) ([#782](https://github.com/pskillen/codeplug-studio/issues/782)).
- DM-32UV channel/site wire naming — 3-way match (CSV / radio-io / NeonPlug), including forced shortening.
- UV-5R Mini, UV-21, RT95 — DTCS reverse polarity, power ladder breakpoints, bandwidth-null defaults, slot collision policy, and UV-21 AM encode match across pathways ([#807](https://github.com/pskillen/codeplug-studio/issues/807), [#808](https://github.com/pskillen/codeplug-studio/issues/808)).
- Zone/scan-list/RX-group **membership content** (distinct from aggregate count caps in rows 6–7).
- Charset across pathways (including AT-D890UV lean serial rows — [#782](https://github.com/pskillen/codeplug-studio/issues/782)).
- Organisation semantics — single `assemble()` entry point; no per-format override found.

## Test harness

Shared Vitest helpers live at `src/core/import-export/channelExpansion/__testUtils__/pathwayParity.ts`. How to add a radio target: [pathway-parity tests](../../build/testing/pathway-parity.md).

Reference consumers:

- `src/core/import-export/formats/opengd77/wireNameParity.test.ts` — OpenGD77 CSV ↔ serial ([#777](https://github.com/pskillen/codeplug-studio/issues/777))
- `src/core/import-export/formats/chirp/wireNameParity.test.ts` — CHIRP CSV ↔ serial ([#780](https://github.com/pskillen/codeplug-studio/issues/780))
- `src/core/import-export/formats/anytone/wireNameParity.test.ts` — Anytone lean CSV ↔ serial ([#780](https://github.com/pskillen/codeplug-studio/issues/780))

## Related

- [import-export hub](README.md) · [radio-read-write hub](../radio-read-write/README.md)
- [adding-a-new-format.md](adding-a-new-format.md) · [adding-a-radio-adapter.md](../radio-read-write/adding-a-radio-adapter.md) — parity checklist items
- [DESIGN.md — Export](../../../DESIGN.md#import-and-export) · [DESIGN.md — Testing](../../../DESIGN.md#testing)
