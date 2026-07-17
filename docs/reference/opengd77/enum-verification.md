# OpenGD77 — wire elicitation worksheet

Fill this in while driving **official OpenGD77 CPS** (Baofeng 1701 / RT-84 profile preferred). For each row: change the setting in CPS UI → **File → CSV → Export to CSV** → record the exact cell text (capitalisation, spaces, punctuation).

**Tracking:** [#403](https://github.com/pskillen/codeplug-studio/issues/403) · Parent [#36](https://github.com/pskillen/codeplug-studio/issues/36)  
**Gap notes:** [`tmp/opengd77-wire-docs-issues.md`](../../../tmp/opengd77-wire-docs-issues.md) (local working notes; gitignored)  
**Headers / adapter:** [`columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts)

### Follow-up tickets (filed from #403)

| Area | Issue | Status |
| --- | --- | --- |
| Tier-3 docs drift (power table, channels.md, G4EML caveats, …) | [#436](https://github.com/pskillen/codeplug-studio/issues/436) | Open — includes correcting `channels.md` TOT/VOX claims vs adapter hardcodes |
| Redacted 1701 CPS fixture under `test-data/` | [#437](https://github.com/pskillen/codeplug-studio/issues/437) | Open |
| CPS-safe defaults for unmodelled channel columns | [#438](https://github.com/pskillen/codeplug-studio/issues/438) | Open |
| Squelch wire map (`Disabled` / `Open` / `Closed` / `Master` / `%`) | [#439](https://github.com/pskillen/codeplug-studio/issues/439) | Open |
| Power ladder + user-power (`+W-` / `-W+`) | [#440](https://github.com/pskillen/codeplug-studio/issues/440) | Open |
| Validate MD-9600 power ladder | [#441](https://github.com/pskillen/codeplug-studio/issues/441) | Open |
| OpenGD77 `APRS.csv` body + `Channels.APRS` FK | [#442](https://github.com/pskillen/codeplug-studio/issues/442) (parent [#246](https://github.com/pskillen/codeplug-studio/issues/246)) | Open |

Related (not filed from #403): behavioural cascade on `Rx Only` / `All Skip` [#424](https://github.com/pskillen/codeplug-studio/issues/424) **done** (docs PR [#434](https://github.com/pskillen/codeplug-studio/pull/434)); `txPermit` has no OpenGD77 column (export loss).

Fill this worksheet first for high-priority enums; then land results into tier-3 docs and the tickets above.

### How to use

1. Start from a small scratch codeplug (or a copy of a known-good export).
2. Prefer **one change per export** when unsure; batch only when values are obviously independent.
3. Record **exact wire strings** in **Observed wire values** (e.g. `` `+W-` `` not “plus W”).
4. If CPS UI label ≠ CSV text, put both (UI → wire).
5. Leave **Observed** blank until you personally confirm — pre-filled “hints” are not canon.
6. When done, promote confirmed rows into sibling tier-3 docs (`channels.md`, `power-squelch.md`, …) and file adapter tickets under #36.

### Column key

| Column | Meaning |
| --- | --- |
| **Wire field** | Exact CSV header (or member-slot pattern) |
| **Library / build field** | Current Studio model path, or `—(unmodelled)` |
| **Hint (unconfirmed)** | G4EML / User Guide / sample export — **verify** |
| **CPS UI control** | Where you click in CPS (fill in) |
| **Observed wire values** | Exact CSV cell(s) you saw |
| **Range / step / format** | Numeric bounds, step, decimal places, regex-ish pattern |
| **Notes** | Blank vs `None`, mode-dependent, locale, etc. |

**Omit policy:** Only omit a field if you are certain it needs no elicitation. This sheet errs on inclusion.

---

## Export file set

| File | Role | Studio export today | Elicit? |
| --- | --- | --- | --- |
| `Channels.csv` | RF channel rows | Full serialise | **Yes — priority** |
| `Contacts.csv` | Talk groups + private contacts | Full (TS Override always empty) | **Yes** |
| `TG_Lists.csv` | Promiscuous RX lists | Full | Light (cardinality / blanks) |
| `Zones.csv` | Zone = scan membership | Full | Light (cardinality / blanks) |
| `DTMF.csv` | DTMF sequences | Header only | **Yes** (when modelling) |
| `APRS.csv` | Named APRS configs | Header only | **Yes** (enums + booleans) |

Keep all six in one folder. Cross-file FKs are **case-sensitive exact name** matches.

**Locale (fill once):**

| Question | Observed |
| --- | --- |
| Field delimiter (`,` vs `;`) | |
| Decimal separator in frequencies (`.` vs `,`) | |
| Leading tab on freq / numeric cells? (`Yes`/`No` + which cols) | |
| Line endings if you notice (CRLF vs LF) | |
| CPS version / build date | |
| Radio profile selected in CPS | |

---

## 1. `Channels.csv` (28 columns)

Canonical header order (confirm still matches your CPS):

```text
Channel Number,Channel Name,Channel Type,Rx Frequency,Tx Frequency,Bandwidth (kHz),Colour Code,Timeslot,Contact,TG List,DMR ID,TS1_TA_Tx,TS2_TA_Tx ID,RX Tone,TX Tone,Squelch,Power,Rx Only,Zone Skip,All Skip,TOT,VOX,No Beep,No Eco,APRS,Latitude,Longitude,Use Location
```

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Channel Number` | —(export order only; not stored) | 1–1023 unique; gaps OK; Append ignores | | | | |
| `Channel Name` | Build channel wire name ← `Channel.name` / `callsign` / export name style | ~16 LCD chars | | | | FK target for Zones |
| `Channel Type` | `modeProfiles[].mode` → Analogue/Digital | `Analogue` \| `Digital` only | | | | No dual-mode row |
| `Rx Frequency` | `Channel.rxFrequency` (Hz → MHz) | MHz; 5 dp common; leading tab | | | | |
| `Tx Frequency` | `Channel.txFrequency` (Hz → MHz) | same | | | | |
| `Bandwidth (kHz)` | `ChannelModeProfileAnalog.bandwidthKHz` | `12.5` / `12,5` / `25`; blank digital | | | | Wideband `25`? |
| `Colour Code` | `ChannelModeProfileDMR.colourCode` | 0–15; blank analogue | | | | Confirm **0** allowed |
| `Timeslot` | `ChannelModeProfileDMR.timeslot` | `1` \| `2`; blank analogue | | | | |
| `Contact` | `ChannelModeProfileDMR.contactRef` → TG/contact wire name | name \| `None` \| blank | | | | Blank vs `None` by mode |
| `TG List` | `ChannelModeProfileDMR.rxGroupListId` → RGL wire name | name \| `None` \| blank | | | | |
| `DMR ID` | `ChannelModeProfileDMR.dmrId` | override int \| `None` \| blank | | | | Hotspot / override semantics |
| `TS1_TA_Tx` | —(unmodelled) | `Off` \| `APRS` \| `Text` \| `APRS+Text` | | | | Talker-alias TX TS1 → [#438](https://github.com/pskillen/codeplug-studio/issues/438) |
| `TS2_TA_Tx ID` | —(unmodelled) | same set; confirm **header spelling** | | | | G4EML typo `TS2_TA+Tx` → [#438](https://github.com/pskillen/codeplug-studio/issues/438) |
| `RX Tone` | `ChannelModeProfileAnalog.rxTone` | `None` \| CTCSS `nnn.n` \| DCS `DnnnI`/`DnnnN` | | | | Blank digital |
| `TX Tone` | `ChannelModeProfileAnalog.txTone` | same | | | | |
| `Squelch` | `ChannelModeProfileAnalog.squelch` | `Disabled` \| `Open` \| `Closed` \| `nn%`; User Guide also **Master** | | | | 5% steps? Master wire? → [#439](https://github.com/pskillen/codeplug-studio/issues/439) |
| `Power` | `Channel.power` (% ↔ P-ladder) | `Master` \| `P1`…`P9` \| `+W-` or `-W+` | | | | See power ladder below → [#440](https://github.com/pskillen/codeplug-studio/issues/440) |
| `Rx Only` | `forbidTransmit` cascade | `Yes` \| `No` | | | | Cascade shipped [#424](https://github.com/pskillen/codeplug-studio/issues/424) |
| `Zone Skip` | —(unmodelled; Studio exports empty) | `Yes` \| `No` | | | | vs `All Skip` → defaults [#438](https://github.com/pskillen/codeplug-studio/issues/438) |
| `All Skip` | `scanInclusion` cascade | `Yes` \| `No` | | | | Cascade shipped [#424](https://github.com/pskillen/codeplug-studio/issues/424) |
| `TOT` | `Channel.transmitTimeout` (adapter still hardcodes null → empty) | 0–495 step 15; `0` = off | | | | Tier-3 overclaims model map — [#436](https://github.com/pskillen/codeplug-studio/issues/436) |
| `VOX` | `Channel.voxEnabled` (adapter still hardcodes `Off`) | `Off` \| `On` | | | | Same docs/adapter drift — [#436](https://github.com/pskillen/codeplug-studio/issues/436) |
| `No Beep` | —(unmodelled; Studio exports empty) | `Yes` \| `No` | | | | → [#438](https://github.com/pskillen/codeplug-studio/issues/438) |
| `No Eco` | —(unmodelled; Studio exports empty) | `Yes` \| `No` | | | | → [#438](https://github.com/pskillen/codeplug-studio/issues/438) |
| `APRS` | —(Studio exports empty; not `Channel.aprs` digital binding) | `None` \| APRS config name | | | | FK → `APRS.csv` → [#442](https://github.com/pskillen/codeplug-studio/issues/442) |
| `Latitude` | `Channel.location.lat` | decimal degrees | | | | |
| `Longitude` | `Channel.location.lon` | decimal degrees | | | | |
| `Use Location` | `Channel.useLocation` | `Yes` \| `No` | | | | Missing from G4EML PDF |

### 1a. Power ladder (1701) — fill every step

Map **CPS UI label** → **exact `Power` CSV cell** → **approx watts** (optional). Studio stores percent via profile ladder.

| CPS UI / watts (hint) | Observed `Power` wire | Approx W | Studio `%` today (1701) | Notes |
| --- | --- | ---: | ---: | --- |
| Master / radio default | | | `null` → export `Master` | |
| 50 mW | | 0.05 | `P1` → 1 | |
| 250 mW | | 0.25 | `P2` → 5 | |
| 500 mW | | 0.5 | `P3` → 10 | |
| 750 mW | | 0.75 | `P4` → 15 | |
| 1 W | | 1 | `P5` → 20 | |
| 2 W | | 2 | `P6` → 40 | |
| 3 W | | 3 | `P7` → 60 | |
| 4 W | | 4 | `P8` → 80 | |
| 5 W | | 5 | `P9` → 100 | |
| User power (`+W-` / `-W+`?) | | | —(unmodelled) | Exact string critical |

### 1b. Squelch ladder / specials

| CPS UI | Observed `Squelch` wire | Maps to library? | Notes |
| --- | --- | --- | --- |
| Master (band default) | | `squelch: null`? | Confirm if Master appears in CSV |
| Disabled | | | Sample uses this often |
| Open | | | G4EML; User Guide |
| Closed | | | G4EML; User Guide |
| 0% | | | Same as Open/Disabled? |
| 5% | | | Step size |
| 10% | | | |
| 45% (band default hint) | | | |
| 50% | | | |
| 75% | | | Seen in sample |
| 100% | | | Same as Closed? |
| _(other)_ | | | |

### 1c. Tone / DCS patterns

| Kind | CPS UI | Observed wire (RX) | Observed wire (TX) | Notes |
| --- | --- | --- | --- | --- |
| None | | | | |
| CTCSS example | | | | e.g. `103.5` |
| DCS Normal | | | | G4EML `DnnnN` |
| DCS Invert | | | | G4EML `DnnnI` |
| Blank on digital | | | | Expect empty |

### 1d. Mode-dependent blank / sentinel matrix

For one analogue + one digital channel, tick what CPS writes when a field is “unused”:

| Wire field | Analogue unused → | Digital unused → |
| --- | --- | --- |
| `Bandwidth (kHz)` | | |
| `Colour Code` | | |
| `Timeslot` | | |
| `Contact` | | |
| `TG List` | | |
| `DMR ID` | | |
| `TS1_TA_Tx` / `TS2_TA_Tx ID` | | |
| `RX Tone` / `TX Tone` | | |
| `Squelch` | | |

---

## 2. `Contacts.csv` (4 columns)

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Contact Name` | `TalkGroup.name` / `DigitalContact.name` (build wire name) | display; FK target | | | | Also used from Channels / TG lists |
| `ID` | `TalkGroup.digitalId` / `DigitalContact.digitalId` | DMR ID integer as text | | | | |
| `ID Type` | entity kind (TG → Group, private → Private) | `Group` \| `Private` \| **`AllCall`?** | | | | Confirm AllCall still exists |
| `TS Override` | —(unmodelled on TG/contact; Studio always `''`) | `Disabled` \| `1` \| `2` | | | | Sample uses these three |

**Naming pattern (optional):** two contacts same ID, names `… TS1` / `… TS2` — note whether TS Override must match name.

| Scenario | Observed `ID Type` | Observed `TS Override` | Notes |
| --- | --- | --- | --- |
| Group TG, no override | | | |
| Group TG, force TS1 | | | |
| Group TG, force TS2 | | | |
| Private call | | | |
| AllCall (if available) | | | |

---

## 3. `TG_Lists.csv` (33 columns)

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `TG List Name` | `RxGroupList.name` (build wire name) | FK from Channels `TG List` | | | | |
| `Contact1`…`Contact32` | `RxGroupList.members[].ref` → contact/TG wire names | max 32; trailing blank OK | | | | Exact name match to Contacts |
| _(cardinality)_ | profile `tgListMembers` (32 on 1701) | Can CPS export >32 cols on other radios? | | | | MD-9600? |

| Question | Observed |
| --- | --- |
| Empty member cells: omitted trailing columns vs padded blanks? | |
| Duplicate member names allowed? | |
| Private + Group mixed in one list? | |

---

## 4. `Zones.csv` (81 columns)

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Zone Name` | `Zone.name` / build zone wire name | unique | | | | |
| `Channel1`…`Channel80` | Zone members → channel wire names (build layout) | max 80; **no space** in header | | | | Zone = scan order |
| _(cardinality)_ | profile `zoneMembers` (80 on 1701) | Other radios differ? | | | | |

| Question | Observed |
| --- | --- |
| Header spelling `Channel1` vs `Channel 1`? | |
| Empty slots: trailing columns omitted? | |
| Duplicate channel in one zone? | |
| Rename channel without updating zone — CPS import behaviour? | |

---

## 5. `DTMF.csv` (2 columns)

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Contact Name` | closest: `AnalogContact.name` (not wired today) | label | | | | |
| `Code` | closest: `AnalogContact.code` (not wired today) | `0-9A-D*#` only | | | | |

| Question | Observed |
| --- | --- |
| Max code length? | |
| Case of `A`–`D`? | |
| Empty file (header only) accepted on import? | |

---

## 6. `APRS.csv` (16 columns)

Studio has a **digital** `AprsConfiguration` singleton + `Channel.aprs` binding — **not** a 1:1 map to OpenGD77 named analog APRS configs. Treat this file as wire-only until modelled — export work tracked in [#442](https://github.com/pskillen/codeplug-studio/issues/442) under epic [#246](https://github.com/pskillen/codeplug-studio/issues/246).

Confirm header order:

```text
APRS config Name,SSID,Via1,Via1 SSID,Via2,Via2 SSID,Icon table,Icon,Comment text,Ambiguity,Use position,Latitude,Longitude,TX Frequency,Transmit QSY,Baud rate setting
```

| Wire field | Library / build field | Hint (unconfirmed) | CPS UI control | Observed wire values | Range / step / format | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `APRS config Name` | —(unmodelled); FK from Channels `APRS` | name | | | | |
| `SSID` | — | e.g. `9` | | | | |
| `Via1` | — | e.g. `WIDE1` | | | | |
| `Via1 SSID` | — | e.g. `1` | | | | |
| `Via2` | — | e.g. `WIDE2` | | | | |
| `Via2 SSID` | — | e.g. `1` | | | | |
| `Icon table` | — | sample `0` | | | | Enum/int? |
| `Icon` | — | sample `15` | | | | |
| `Comment text` | — | free text | | | | Max length? |
| `Ambiguity` | — | sample `3` | | | | Allowed set |
| `Use position` | — | sample `False` (bool casing!) | | | | `True`/`False` vs `Yes`/`No` |
| `Latitude` | — | sample `0` | | | | |
| `Longitude` | — | sample `0` | | | | |
| `TX Frequency` | — | MHz 5 dp e.g. `144.80000` | | | | |
| `Transmit QSY` | — | sample `False` | | | | |
| `Baud rate setting` | — | sample `0` | | | | Enum codes? |

### 6a. APRS boolean / enum matrix

| Wire field | CPS UI options | Observed CSV for each option |
| --- | --- | --- |
| `Use position` | | |
| `Transmit QSY` | | |
| `Baud rate setting` | | |
| `Ambiguity` | | |
| `Icon table` / `Icon` | | |

---

## Cross-cutting checks

| Topic | Hint | Observed |
| --- | --- | --- |
| Case sensitivity of FKs | `No` ≠ `no`; names exact | |
| Boolean casing Channels | `Yes`/`No` | |
| Boolean casing APRS | `True`/`False`? | |
| `None` sentinel vs empty string | mode-dependent | |
| Import replaces vs Append | G4EML docs | |
| Max channels | 1023 | |
| Channel name max length (LCD) | ~16 | |
| Contact name max length | | |
| Zone name max length | | |
| TG list name max length | | |

---

## Session log

| Date | CPS version | Radio profile | Operator | Summary of what was confirmed |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Related

- [OpenGD77 reference hub](README.md)
- [channels.md](channels.md) · [power-squelch.md](power-squelch.md) · [contacts.md](contacts.md) · [tg-lists.md](tg-lists.md) · [zones.md](zones.md) · [dtmf-aprs.md](dtmf-aprs.md)
- [Baofeng 1701 profile](radios/baofeng-1701.md)
- Anytone sibling pattern: [anytone/enum-verification.md](../anytone/enum-verification.md)
