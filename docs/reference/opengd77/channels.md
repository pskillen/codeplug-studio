# OpenGD77 — Channels.csv

Generic column reference for `Channels.csv`. Cardinality and display-length limits are radio-profile-specific — see [radios/baofeng-1701.md](radios/baofeng-1701.md).

**Code:** [`columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts) · [`parse.ts`](../../../src/core/import-export/formats/opengd77/parse.ts) · [`serialise.ts`](../../../src/core/import-export/formats/opengd77/serialise.ts) · [`channelWire.ts`](../../../src/core/import-export/formats/opengd77/channelWire.ts) (import) · [`channelWire.ts`](../../../src/core/import-export/formats/opengd77/channelWire.ts) (export)

## Required headers (app import)

| Header | Reason |
| --- | --- |
| `Channel Name` | Identity; rows without a name are skipped |
| `Latitude` | Map/plot support; must be present as a column |
| `Longitude` | Map/plot support; must be present as a column |

All other columns are optional at import — missing headers yield empty values.

## Column reference

| Vendor header | Internal field | Required (import) | Import rule | Export rule | Bidirectional mapping | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Channel Number` | _(export only)_ | No | **Ignored** on import | Sequential `1…n` in channel list order | Not preserved | Direct-access number in All-channels zone; see radio profile for range |
| `Channel Name` | `Channel.name` | **Yes** | Trim; skip row if empty | As stored | String pass-through | FK target for zones; case-sensitive |
| `Channel Type` | `Channel.mode` | No | `Analogue`/`Analog` → `fm`; `Digital` → `dmr`; else `other` | All analog modes → `Analogue`; all digital → `Digital`; else passthrough | Lossy for non-FM/DMR | See [channel-modes.md](../channel-modes.md) |
| `Rx Frequency` | `Channel.rxFrequency` | No | MHz wire → integer Hz | Hz → MHz wire (5 dp) | Lossless when valid | `.` or `,` decimal accepted on import |
| `Tx Frequency` | `Channel.txFrequency` | No | MHz wire → integer Hz | Hz → MHz wire (5 dp) | Lossless when valid | |
| `Bandwidth (kHz)` | `Channel.bandwidthKHz` | No | Parse float kHz | As number string | Lossless | Analogue: typically `12.5` or `25` |
| `Colour Code` | `Channel.colourCode` | No | Parse 0–15 | As integer string | Lossless | Digital only |
| `Timeslot` | `Channel.timeslot` | No | `1` or `2` | As `1`/`2` | Lossless | Digital only |
| `Contact` | `Channel.contactName` | No | Trim | As stored | String pass-through | TX talk group name; FK → Contacts.csv |
| `TG List` | `Channel.rxGroupListName` | No | Trim | As stored | String pass-through | Promiscuous RX list; FK → TG_Lists.csv |
| `DMR ID` | `Channel.dmrId` | No | Parse integer; `None`/empty → `null` | Mode-aware — see [mode-dependent columns](#mode-dependent-columns) | Lossless | Digital: `None` when unset; analogue: empty |
| `TS1_TA_Tx` | `Channel.opengd77Extras['TS1_TA_Tx']` | No | Trim → opengd77Extras | From opengd77Extras | opengd77Extras | Talkaround TS1 |
| `TS2_TA_Tx ID` | `Channel.opengd77Extras['TS2_TA_Tx ID']` | No | Trim → opengd77Extras | From opengd77Extras | opengd77Extras | Talkaround TS2 |
| `RX Tone` | `Channel.rxTone` | No | Wire → tone enum (`None` → `none`) | Mode-aware — see below | Lossless | CTCSS/DCS; see tones below |
| `TX Tone` | `Channel.txTone` | No | Wire → tone enum | Mode-aware — see below | Lossless | |
| `Squelch` | `Channel.squelch` | No | Wire → percent | Mode-aware — see below | Lossless | See [power-squelch.md](power-squelch.md) |
| `Power` | `Channel.power` | No | Wire → percent | Percent → wire | Lossless | See [power-squelch.md](power-squelch.md) |
| `Rx Only` | `Channel.forbidTransmit` | No | `Yes`/`No` → boolean | `wireYesNo` | Lossless boolean | |
| `Zone Skip` | `Channel.opengd77Extras['Zone Skip']` | No | Trim → opengd77Extras | From opengd77Extras | opengd77Extras | Not mapped to `scanSkip` |
| `All Skip` | `Channel.scanSkip` | No | `Yes` → `true` | `wireYesNo(scanSkip)` | Lossless boolean | Global scan skip |
| `TOT` | `Channel.transmitTimeout` | No | Parse seconds | As integer string | Lossless | `0` = off; CPS step 15 (0–495) |
| `VOX` | `Channel.voxEnabled` | No | `Off` or empty → `false`; else `true` | `Off` / `On` | Lossless boolean | |
| `No Beep` | `Channel.opengd77Extras['No Beep']` | No | Trim → opengd77Extras | From opengd77Extras | opengd77Extras | |
| `No Eco` | `Channel.opengd77Extras['No Eco']` | No | Trim → opengd77Extras | From opengd77Extras | opengd77Extras | |
| `APRS` | `Channel.aprsConfigName` | No | Trim | As stored | String pass-through | FK → APRS.csv |

### TX Admit

OpenGD77 `Channels.csv` has **no TX Admit column**. The internal `Channel.txAdmit` enum is retained for cross-format projects (e.g. imported from DM-32) but is **not serialised** on OpenGD77 export.
| `Latitude` | `Channel.location.lat` | **Column required** | Parse float | String from location | Lossless when valid | Pair with longitude |
| `Longitude` | `Channel.location.lon` | **Column required** | Parse float | String from location | Lossless when valid | |
| `Use Location` | `Channel.useLocation` | No | `Yes` → `true` | `wireYesNo(useLocation)` | Lossless boolean | |

`Channel Name` maps to split internal fields on import and is **composed on export** from `callsign`, `name`, and `exportNameMode`. Split rules: [channel-name-parsing](../../features/channel-name-parsing.md).

## Export name length and shortening

Radio LCD limits are profile-specific (~16 chars on [Baofeng 1701](radios/baofeng-1701.md)). The app default `nameLimit` is **16** on OpenGD77 profiles (`src/core/import-export/formats/opengd77/profiles.ts`).

When a composed or expanded wire name exceeds the effective limit, export runs the shortening pipeline (dictionary → vowel-squeeze → optional `callsign_suffix` downgrade → truncate). Zone `ChannelN` members and TG-list contact names receive the **same** shortened strings as `Channels.csv`.

Operator controls and bidirectional mapping caveats: name shortening (Phase 4+). Per-profile manual overrides: archive reference #122.

## Tone wire forms

| OpenGD77 wire | Internal `rxTone` / `txTone` |
| --- | --- |
| `None`, empty | `none` |
| CTCSS (e.g. `103.5`) | same frequency string |
| DCS (e.g. `D023N`) | same code string |

## Mode-dependent columns

Export derives wire from **model fields + `Channel.mode`** — never from hidden import provenance.

| Column | Digital export | Analogue export |
| --- | --- | --- |
| `RX Tone` / `TX Tone` | always empty | `None` when `none`; else CTCSS/DCS wire |
| `Squelch` | always empty | `Disabled` when `null`; else `N%` |
| `DMR ID` | `None` when unset; else integer string | always empty |
| `Contact` / `TG List` | `None` when unset; else resolved wire name | empty when unset; else resolved wire name |

`Disabled` squelch and `Master` both map to `squelch: null` on import (radio default).

## Digital channel patterns

**Single-TG TX** — set `Contact`, leave `TG List` empty or `None`:

```csv
13,GB7DA Airdrie,Digital,145.77500,145.17500,,1,2,Scotland TS1,None,...
```

**Promiscuous RX** — `Contact` is `None`, set `TG List`:

```csv
16,GB7GL Glasgow,Digital,430.85000,438.45000,,7,2,None,GB7GL,...
```

## Analogue channel pattern

Leave digital columns empty. FM+DMR repeater sites need **separate rows** for `Analogue` and `Digital`:

```csv
1,GB3CS Motherwell,Analogue,145.75000,145.15000,12.5,,,,,,,,None,103.5,75%,Master,No,No,No,0,Off,No,No,None,55.789,-3.989,Yes
```

## Related

- [Power and squelch wire mapping](power-squelch.md)
- [File format rules](file-format.md)
- [Contacts](contacts.md) · [TG lists](tg-lists.md)
- [Channel modes](../channel-modes.md)
- [DTMF / APRS](dtmf-aprs.md)
