# OpenGD77 — Channels.csv

Generic column reference for `Channels.csv`. Cardinality and display-length limits are radio-profile-specific — see [profiles.md](profiles.md) / [dm-1701](../../radios/baofeng/dm-1701/README.md).

**Code (export shipped):** [`columns.ts`](../../../../src/core/import-export/formats/opengd77/columns.ts) · [`serialise.ts`](../../../../src/core/import-export/formats/opengd77/serialise.ts) · [`channelWire.ts`](../../../../src/core/import-export/formats/opengd77/channelWire.ts)

**Import:** planned ([#522](https://github.com/pskillen/codeplug-studio/issues/522)) — parse rules below describe target behaviour.

## Required headers (target import)

| Header         | Reason                                        |
| -------------- | --------------------------------------------- |
| `Channel Name` | Identity; rows without a name are skipped     |
| `Latitude`     | Map/plot support; must be present as a column |
| `Longitude`    | Map/plot support; must be present as a column |

All other columns are optional at import — missing headers yield empty values.

## Column reference

| Vendor header     | Internal field            | Import (target)                  | Export (shipped)                                                                                                   | Notes                                                                                               |
| ----------------- | ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `Channel Number`  | _(export only)_           | Ignored                          | Sequential `1…n` in channel list order                                                                             | Direct-access number in All-channels zone                                                           |
| `Channel Name`    | `Channel.name`            | Trim; skip empty                 | Composed wire name from build + library                                                                            | FK target for zones; case-sensitive                                                                 |
| `Channel Type`    | `Channel.mode`            | `Analogue`→`fm`; `Digital`→`dmr` | Analog modes → `Analogue`; digital → `Digital`                                                                     | See [channel-modes.md](../../channel-modes.md)                                                      |
| `Rx Frequency`    | `Channel.rxFrequency`     | MHz → Hz                         | Hz → MHz (5 dp)                                                                                                    | `.` or `,` decimal on import (target)                                                               |
| `Tx Frequency`    | `Channel.txFrequency`     | MHz → Hz                         | Hz → MHz (5 dp)                                                                                                    |                                                                                                     |
| `Bandwidth (kHz)` | analog `bandwidthKHz`     | Parse float                      | Analogue: `12.5` when unset; digital: empty                                                                        |                                                                                                     |
| `Colour Code`     | DMR `colourCode`          | 0–15                             | Integer string; digital only                                                                                       |                                                                                                     |
| `Timeslot`        | DMR `timeslot`            | `1` / `2`                        | `1` / `2`; digital only                                                                                            |                                                                                                     |
| `Contact`         | DMR `contactRef`          | Trim                             | Resolved wire name (incl. TS clones — [#764](https://github.com/pskillen/codeplug-studio/issues/764))              | FK → Contacts.csv                                                                                   |
| `TG List`         | DMR `rxGroupListId`       | Trim                             | Resolved RX-group wire name                                                                                        | FK → TG_Lists.csv                                                                                   |
| `DMR ID`          | DMR `dmrId`               | Parse int                        | Mode-aware — see [mode-dependent columns](#mode-dependent-columns)                                                 |                                                                                                     |
| `TS1_TA_Tx`       | _(unmodelled)_            | —                                | `Off` on digital; empty on analogue ([#438](https://github.com/pskillen/codeplug-studio/issues/438))               | Talkaround TS1; enum set needs elicitation (#403)                                                   |
| `TS2_TA_Tx ID`    | _(unmodelled)_            | —                                | `Off` on digital; empty on analogue ([#438](https://github.com/pskillen/codeplug-studio/issues/438))               | Talkaround TS2                                                                                      |
| `RX Tone`         | analog `rxTone`           | Wire → tone                      | Mode-aware — see below                                                                                             |                                                                                                     |
| `TX Tone`         | analog `txTone`           | Wire → tone                      | Mode-aware — see below                                                                                             |                                                                                                     |
| `Squelch`         | analog `squelch`          | Wire → percent                   | Mode-aware — see below; [power-squelch.md](power-squelch.md)                                                       |                                                                                                     |
| `Power`           | `Channel.power`           | Wire → percent                   | Ladder wire via profile — [power-squelch.md](power-squelch.md)                                                     |                                                                                                     |
| `Rx Only`         | `forbidTransmit` cascade  | `Yes`/`No`                       | `effectiveForbidTransmit` → `wireYesNo` (`Yes`/`No`)                                                               | See [behavioural defaults cascade](#behavioural-defaults-cascade)                                   |
| `Zone Skip`       | `Channel.scanInclusion`   | `Yes`→skip                       | Mirrors `All Skip` from effective `scanInclusion` ([#772](https://github.com/pskillen/codeplug-studio/issues/772)) | Same value as `All Skip` on CSV and serial Write                                                    |
| `All Skip`        | `Channel.scanInclusion`   | `Yes`→skip                       | `scanInclusion` + build default → `wireYesNo`                                                                      | Global scan skip                                                                                    |
| `TOT`             | `Channel.transmitTimeout` | Parse seconds                    | Empty when unmodelled (export)                                                                                     | CPS step 15 (0–495); `0` = off                                                                      |
| `VOX`             | `Channel.voxEnabled`      | `Off`→false                      | `Off` when unmodelled (export)                                                                                     |                                                                                                     |
| `No Beep`         | _(unmodelled)_            | —                                | `No` ([#438](https://github.com/pskillen/codeplug-studio/issues/438))                                              |                                                                                                     |
| `No Eco`          | _(unmodelled)_            | —                                | `No` ([#438](https://github.com/pskillen/codeplug-studio/issues/438))                                              |                                                                                                     |
| `APRS`            | `Channel.aprsConfigName`  | Trim                             | Empty when unmodelled                                                                                              | FK → APRS.csv — body under APRS epic [#442](https://github.com/pskillen/codeplug-studio/issues/442) |
| `Latitude`        | `Channel.location.lat`    | Parse float                      | String from location                                                                                               |                                                                                                     |
| `Longitude`       | `Channel.location.lon`    | Parse float                      | String from location                                                                                               |                                                                                                     |
| `Use Location`    | `Channel.useLocation`     | `Yes`→true                       | `wireYesNo(useLocation)`                                                                                           |                                                                                                     |

### TX Admit / Busy Lock

OpenGD77 `Channels.csv` has **no TX Admit or Busy Lock column**. Resolved `txPermit` from the [behavioural defaults cascade](../../channel-behavioural-defaults.md) is **not serialised** on OpenGD77 export (export loss). Legacy `Channel.txAdmit` from cross-format imports is also omitted on export.

### Behavioural defaults cascade

| Cascade field       | OpenGD77 wire                        | Export                                                             |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `forbidTransmit`    | `Rx Only`                            | Shipped via cascade → `Yes`/`No`                                   |
| `txPermit`          | _(none)_                             | Loss — no Busy Lock / TX Admit column                              |
| `sendTalkerAlias`   | _(none)_                             | Loss — no talker-alias column (TS1/TS2 talkaround cells unrelated) |
| `analogSquelchMode` | _(none — distinct from `Squelch` %)_ | Loss — `Squelch` is level percent only                             |

`Channel Name` maps to split internal fields on import (target) and is **composed on export** from `callsign`, `name`, and the operator's default export name style (see [name-shortening](../../../features/import-export/name-shortening.md)). Split rules: [channel-name-parsing](../../../features/channel-name-parsing.md).

## Export name length and shortening

Radio LCD limits are profile-specific (~16 chars on [Baofeng 1701](../../radios/baofeng/dm-1701/README.md)). The app default `nameLimit` is **16** on OpenGD77 profiles (`src/core/import-export/formats/opengd77/profiles.ts`).

When a composed or expanded wire name exceeds the effective limit, export runs the shortening pipeline (dictionary → vowel-squeeze → optional `callsign_suffix` downgrade → truncate). Zone `ChannelN` members and TG-list contact names receive the **same** shortened strings as `Channels.csv`.

## Tone wire forms

| OpenGD77 wire        | Internal `rxTone` / `txTone` |
| -------------------- | ---------------------------- |
| `None`, empty        | `none`                       |
| CTCSS (e.g. `103.5`) | same frequency string        |
| DCS (e.g. `D023N`)   | same code string             |

## Mode-dependent columns

Export derives wire from **model fields + `Channel.mode`** — never from hidden import provenance.

| Column                       | Digital export                             | Analogue export                           |
| ---------------------------- | ------------------------------------------ | ----------------------------------------- |
| `Bandwidth (kHz)`            | always empty                               | `12.5` when unset; else model kHz string  |
| `RX Tone` / `TX Tone`        | always empty                               | `None` when `none`; else CTCSS/DCS wire   |
| `Squelch`                    | always empty                               | `Disabled` when `null`/`0`; else `N%`     |
| `DMR ID`                     | `None` when unset; else integer string     | always empty                              |
| `Contact` / `TG List`        | `None` when unset; else resolved wire name | empty when unset; else resolved wire name |
| `TS1_TA_Tx` / `TS2_TA_Tx ID` | `Off` when unmodelled                      | always empty                              |

`Master`, `Open`, and `Closed` squelch sentinels are **not emitted** by Studio export today — see [#439](https://github.com/pskillen/codeplug-studio/issues/439). Binary Web Serial encode uses internal percent at channel offset `0x37` — see [radios/opengd77/channel-record.md](../../radios/opengd77/channel-record.md#squelch-0x37).

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
- [Channel modes](../../channel-modes.md)
- [DTMF / APRS](dtmf-aprs.md)
