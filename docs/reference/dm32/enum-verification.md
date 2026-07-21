# DM32 — wire elicitation worksheet

Fill this in while driving **official Baofeng DM-32UV CPS v1.60**. For each row: change the setting in CPS UI → export CSV bundle → record the exact cell text (capitalisation, spaces, punctuation).

**Tracking:** [#404](https://github.com/pskillen/codeplug-studio/issues/404) · Parent [#503](https://github.com/pskillen/codeplug-studio/issues/503) (was [#37](https://github.com/pskillen/codeplug-studio/issues/37))  
**Supersedes:** [#356](https://github.com/pskillen/codeplug-studio/issues/356)  
**Gap notes:** [`tmp/dm32-wire-docs-issues.md`](../../../tmp/dm32-wire-docs-issues.md) (local; gitignored)  
**Headers / adapter:** [`columns.ts`](../../../src/core/import-export/formats/dm32/columns.ts)  
**Canonical CPS sample:** [`sample-codeplugs/baofeng-dm32/1.60/`](../../../sample-codeplugs/baofeng-dm32/1.60/) (unadulterated v1.60 export)  
**Test fixture (may differ):** [`test-data/baofeng-dm32/v1.60/`](../../../test-data/baofeng-dm32/v1.60/)

> **Sibling path:** NeonPlug `.neonplug` DM32UV export (epic [#536](https://github.com/pskillen/codeplug-studio/issues/536)) is a separate wire. This worksheet is **stock CPS CSV only** — do not mix NeonPlug JSON field names into Observed cells.

### Follow-up tickets (filed from #404)

| Area                                   | Issue                                                                                                                                                  | Status                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier-3 docs drift                      | [#444](https://github.com/pskillen/codeplug-studio/issues/444)                                                                                         | **Done** — PR [#453](https://github.com/pskillen/codeplug-studio/pull/453)                                                                        |
| APRS channel columns from model        | [#250](https://github.com/pskillen/codeplug-studio/issues/250) (epic [#246](https://github.com/pskillen/codeplug-studio/issues/246); updated, not new) | **Done** — PR [#473](https://github.com/pskillen/codeplug-studio/pull/473); still elicit edge enums in §1f |
| TX Admit full CPS enum                 | [#445](https://github.com/pskillen/codeplug-studio/issues/445)                                                                                         | Open — cascade maps `busyLock`/`permitAlways` only (PR [#433](https://github.com/pskillen/codeplug-studio/pull/433)); elicit remaining CPS values |
| Remove personal DMR ID profile default | [#446](https://github.com/pskillen/codeplug-studio/issues/446)                                                                                         | Open                                                                                                                                              |
| Scan.csv synthesised constants         | [#447](https://github.com/pskillen/codeplug-studio/issues/447)                                                                                         | Open                                                                                                                                              |
| Contacts.csv metadata export           | [#448](https://github.com/pskillen/codeplug-studio/issues/448)                                                                                         | **Done** — PR [#454](https://github.com/pskillen/codeplug-studio/pull/454); `Alert Call`/`Type`/`Repeater` still elicit                           |
| Richer v1.60 fixture rows              | [#449](https://github.com/pskillen/codeplug-studio/issues/449)                                                                                         | Open                                                                                                                                              |
| RX Squelch Mode Carrier vs Carrier/CTC | [#450](https://github.com/pskillen/codeplug-studio/issues/450)                                                                                         | Open — cascade maps both wires; fixture still only `Carrier/CTC`                                                                                  |
| Fixed Analog Channel Type              | [#451](https://github.com/pskillen/codeplug-studio/issues/451)                                                                                         | Open                                                                                                                                              |

Related (not filed from #404):

| Area | Issue | Status |
| --- | --- | --- |
| Per-repeater scratch export | [#140](https://github.com/pskillen/codeplug-studio/issues/140) | **Done** — PR [#455](https://github.com/pskillen/codeplug-studio/pull/455) |
| Scan names empty/garbled after CPS import | [#478](https://github.com/pskillen/codeplug-studio/issues/478) | Open — round-trip investigation |
| Scan Name length (stricter than `nameLimit` 16) | [#485](https://github.com/pskillen/codeplug-studio/issues/485) | **Done** — PR [#494](https://github.com/pskillen/codeplug-studio/pull/494); limit later set to **10** (PR [#547](https://github.com/pskillen/codeplug-studio/pull/547); CPS official ~11, NeonPlug field 10) |
| Scan CSV member cap 15 (16th = current channel) | [#486](https://github.com/pskillen/codeplug-studio/issues/486) | **Done** — PR [#494](https://github.com/pskillen/codeplug-studio/pull/494) |
| Trailing `\|` on Scan.csv Channel Members | [#487](https://github.com/pskillen/codeplug-studio/issues/487) | **Done** — PR [#494](https://github.com/pskillen/codeplug-studio/pull/494); Zones.csv still no trailing pipe |
| Empty / zero-member Scan.csv floor | [#564](https://github.com/pskillen/codeplug-studio/issues/564) | **Done** — PRs [#566](https://github.com/pskillen/codeplug-studio/pull/566) / [#567](https://github.com/pskillen/codeplug-studio/pull/567): always ≥1 Scan.csv row; members floor with first channel wire name |
| Profile export limits (zone 64, scan/RGL name 10, …) | [#517](https://github.com/pskillen/codeplug-studio/issues/517) | **Done** — PR [#547](https://github.com/pskillen/codeplug-studio/pull/547) |

### How to use

1. Prefer a scratch codeplug (or a copy of the v1.60 fixture imported into CPS).
2. Prefer **one change per export** when unsure.
3. Record **exact wire strings** in **Observed wire values**.
4. If CPS UI label ≠ CSV text, put both (UI → wire).
5. Leave **Observed** blank until you personally confirm — hints are not canon.
6. When done, update tier-3 entity docs and file follow-up tickets under [#503](https://github.com/pskillen/codeplug-studio/issues/503).

### Column key

| Column                    | Meaning                                                       |
| ------------------------- | ------------------------------------------------------------- |
| **Wire field**            | Exact CSV header                                              |
| **Library / build field** | Current Studio model path, or `—(unmodelled)` / `—(constant)` |
| **Hint (unconfirmed)**    | Fixture / docs / Studio default — **verify**                  |
| **CPS UI control**        | Where you click in CPS                                        |
| **Observed wire values**  | Exact CSV cell(s)                                             |
| **Range / step / format** | Bounds, step, decimal places                                  |
| **Notes**                 | Blank vs `None`, mode-dependent, etc.                         |

**Omit policy:** Only omit a field if certain it needs no elicitation. This sheet errs on inclusion.

---

## Export file set

CPS import/export is **manual per CSV** with **no default filenames** — basename drift vs Studio/docs is inconsequential if the role is clear. Names below are the Studio/docs labels; the [canonical sample](../../../sample-codeplugs/baofeng-dm32/1.60/) may use close spellings (`TalkGroups.csv`, `DigitalContacts.csv`, …).

| File               | Role                           | Studio export today                                                                    | Elicit?             |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------- | ------------------- |
| `Channels.csv`     | RF channels (40 cols)          | Full serialise + many constants                                                        | **Yes — priority**  |
| `Zones.csv`        | Zone membership (pipe members) | Full                                                                                   | Light               |
| `Talkgroups.csv`   | Group (+ some private) TGs     | Full                                                                                   | **Yes** (Type enum) |
| `Contacts.csv`     | DMR private contacts           | Full (City/Province/Country/Remark from model; Type/`Alert Call`/`Repeater` constants) | **Yes**             |
| `RXGroupLists.csv` | RX group lists                 | Full                                                                                   | Light               |
| `DTMFContacts.csv` | Analog DTMF contacts           | Full                                                                                   | **Yes**             |
| `Scan.csv`         | Scan lists                     | Zone-derived synthesis + constants                                                     | **Yes**             |
| `DMR-ID.csv`       | Radio ID table                 | **Not exported** (accepted gap)                                                        | Inventory only      |

Official CPS uses **CRLF**. Studio export matches CRLF ([#314](https://github.com/pskillen/codeplug-studio/issues/314)).

**Locale / session (fill once):**

| Question                                  | Observed                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| CPS version / build                       |                                                                 |
| Field delimiter                           |                                                                 |
| Decimal separator in frequencies          |                                                                 |
| Line endings (expect CRLF)                |                                                                 |
| Filename case / `channels.csv.csv` quirk? | Inconsequential — CPS save is manual per file; no default names |

---

## 1. `Channels.csv` (40 columns)

Canonical header order (confirm matches your CPS):

```text
No.,Channel Name,Channel Type,RX Frequency[MHz],TX Frequency[MHz],Power,Band Width,Scan List,TX Admit,Emergency System,Squelch Level,APRS Report Type,Forbid TX,APRS Receive,Forbid Talkaround,Auto Scan,Lone Work,Emergency Indicator,Emergency ACK,Analog APRS PTT Mode,Digital APRS PTT Mode,TX Contact,RX Group List,Color Code,Time Slot,Encryption,Encryption ID,APRS Report Channel,Direct Dual Mode,Private Confirm,Short Data Confirm,DMR ID,CTC/DCS Decode,CTC/DCS Encode,Scramble,RX Squelch Mode,Signaling Type,PTT ID,VOX Function,PTT ID Display
```

| Wire field              | Library / build field                                 | Hint (unconfirmed)                                                               | CPS UI control | Observed wire values | Range / step / format | Notes                                                                                                   |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `No.`                   | —(export order)                                       | Sequential 1…n                                                                   |                |                      |                       |                                                                                                         |
| `Channel Name`          | Build channel wire name ← `Channel.name` / `callsign` | ~16 LCD                                                                          |                |                      |                       | FK for zones/scan                                                                                       |
| `Channel Type`          | `modeProfiles` + dual-mode                            | `Analog` \| `Digital` \| `Fixed Analog` \| `Fixed Digital`; import typo `Anlaog` |                |                      |                       | Fixture missing Fixed Analog                                                                            |
| `RX Frequency[MHz]`     | `Channel.rxFrequency`                                 | 5 dp MHz                                                                         |                |                      |                       |                                                                                                         |
| `TX Frequency[MHz]`     | `Channel.txFrequency`                                 | 5 dp; empty RX-only?                                                             |                |                      |                       |                                                                                                         |
| `Power`                 | `Channel.power`                                       | `High`/`Middle`/`Low` → 100/50/20                                                |                |                      |                       | See power ladder                                                                                        |
| `Band Width`            | analog `bandwidthKHz`                                 | `12.5KHz` \| `25KHz`                                                             |                |                      |                       | Exact casing                                                                                            |
| `Scan List`             | Zone-derived / manual                                 | `None` or scan name                                                              |                |                      |                       | FK → Scan.csv                                                                                           |
| `TX Admit`              | `txPermit` cascade                                    | Fixture: `Channel Idle`, `Allow TX`                                              |                |                      |                       | Partial map shipped; **full dropdown** → [#445](https://github.com/pskillen/codeplug-studio/issues/445) |
| `Emergency System`      | —(constant)                                           | Studio/`None`                                                                    |                |                      |                       | Other names?                                                                                            |
| `Squelch Level`         | analog `squelch`                                      | `0`–`9`; analog null→`1`                                                         |                |                      |                       | See squelch ladder                                                                                      |
| `APRS Report Type`      | `Channel.aprs.reportType`                             | `Off` / `Digital`                                                                |                |                      |                       | Shipped [#250](https://github.com/pskillen/codeplug-studio/issues/250); Analog wire?                    |
| `Forbid TX`             | `forbidTransmit` cascade                              | `0` \| `1`                                                                       |                |                      |                       | Cascade shipped (PR [#433](https://github.com/pskillen/codeplug-studio/pull/433))                       |
| `APRS Receive`          | `Channel.aprs.receiveEnabled`                         | `0`/`1`                                                                          |                |                      |                       | Shipped [#250](https://github.com/pskillen/codeplug-studio/issues/250)                                  |
| `Forbid Talkaround`     | —(Studio `0`)                                         | Fixture `0`,`1`                                                                  |                |                      |                       |                                                                                                         |
| `Auto Scan`             | Scan carrier only → `1` else `0`                      | Fixture only `0`                                                                 |                |                      |                       |                                                                                                         |
| `Lone Work`             | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `Emergency Indicator`   | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `Emergency ACK`         | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `Analog APRS PTT Mode`  | —(constant `0`)                                       | `0`                                                                              |                |                      |                       | No analog APRS hardware                                                                                 |
| `Digital APRS PTT Mode` | `Channel.aprs.digitalPttMode`                         | `0`/`1`                                                                          |                |                      |                       | Shipped [#250](https://github.com/pskillen/codeplug-studio/issues/250)                                  |
| `TX Contact`            | DMR `contactRef` → wire name                          | name \| `None`                                                                   |                |                      |                       | FK Talkgroups/Contacts                                                                                  |
| `RX Group List`         | DMR `rxGroupListId`                                   | name \| `None` \| `ALL`                                                          |                |                      |                       |                                                                                                         |
| `Color Code`            | DMR `colourCode`                                      | 0–15; `0` on analog                                                              |                |                      |                       |                                                                                                         |
| `Time Slot`             | DMR `timeslot`                                        | `Slot 1` \| `Slot 2`                                                             |                |                      |                       |                                                                                                         |
| `Encryption`            | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       | Skip amateur?                                                                                           |
| `Encryption ID`         | —(Studio `None`)                                      | `None`                                                                           |                |                      |                       |                                                                                                         |
| `APRS Report Channel`   | `Channel.aprs.reportSlotIndex`                        | Digital → slot/`1`; else analog `256` / digital `1`                              |                |                      |                       | Shipped [#250](https://github.com/pskillen/codeplug-studio/issues/250); meaning of 256?                 |
| `Direct Dual Mode`      | —(Studio `0`)                                         | Fixture `0`,`1`                                                                  |                |                      |                       |                                                                                                         |
| `Private Confirm`       | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `Short Data Confirm`    | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `DMR ID`                | —(lossy profile string)                               | Fixture `Paddy MM7IGV`                                                           |                |                      |                       | Radio ID label FK?                                                                                      |
| `CTC/DCS Decode`        | analog `rxTone`                                       | `None` \| CTCSS \| DCS?                                                          |                |                      |                       | DCS form                                                                                                |
| `CTC/DCS Encode`        | analog `txTone`                                       | same                                                                             |                |                      |                       |                                                                                                         |
| `Scramble`              | —(Studio `None`)                                      | `None`                                                                           |                |                      |                       |                                                                                                         |
| `RX Squelch Mode`       | `analogSquelchMode` cascade                           | `Carrier` \| `Carrier/CTC`                                                       |                |                      |                       | Cascade maps both; confirm CPS → [#450](https://github.com/pskillen/codeplug-studio/issues/450)         |
| `Signaling Type`        | —(Studio `None`)                                      | `None`                                                                           |                |                      |                       |                                                                                                         |
| `PTT ID`                | —(Studio `OFF`)                                       | `OFF`                                                                            |                |                      |                       | Casing                                                                                                  |
| `VOX Function`          | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |
| `PTT ID Display`        | —(Studio `0`)                                         | `0`                                                                              |                |                      |                       |                                                                                                         |

### 1a. Power ladder

| CPS UI        | Observed `Power` wire | Studio `%` today | Notes               |
| ------------- | --------------------- | ---------------: | ------------------- |
| High          |                       |              100 |                     |
| Middle / Mid? |                       |               50 | Exact wire spelling |
| Low           |                       |               20 |                     |
| _(other)_     |                       |                — |                     |

### 1b. Squelch Level ladder (`0`–`9`)

|             Wire | Observed? | Studio % (hint: `round(n×100/9)`) | Notes                    |
| ---------------: | --------- | --------------------------------: | ------------------------ |
|                0 |           |                                 0 |                          |
|                1 |           |                               ~11 | Analog default when null |
|                2 |           |                               ~22 |                          |
|                3 |           |                               ~33 |                          |
|                4 |           |                               ~44 |                          |
|                5 |           |                               ~56 |                          |
|                6 |           |                               ~67 |                          |
|                7 |           |                               ~78 |                          |
|                8 |           |                               ~89 |                          |
|                9 |           |                               100 |                          |
| Digital unused → |           |                                   | Always `0`?              |

### 1c. TX Admit — full CPS dropdown

| CPS UI label | Observed wire | Maps to `txPermit`?                | Notes |
| ------------ | ------------- | ---------------------------------- | ----- |
|              |               | `busyLock` → Studio `Channel Idle` |       |
|              |               | `permitAlways` → Studio `Allow TX` |       |
|              |               |                                    |       |
|              |               |                                    |       |

### 1d. Channel Type matrix

| CPS UI / intent         | Observed `Channel Type` | Notes                  |
| ----------------------- | ----------------------- | ---------------------- |
| Analog only             |                         |                        |
| Digital only            |                         |                        |
| Dual, TX analog         |                         | Expect `Fixed Analog`  |
| Dual, TX digital        |                         | Expect `Fixed Digital` |
| Typo/`Anlaog` on import |                         | Accept only            |

### 1e. Tone / DCS

| Kind            | Observed Decode | Observed Encode | Notes        |
| --------------- | --------------- | --------------- | ------------ |
| None            |                 |                 |              |
| CTCSS e.g. 88.5 |                 |                 |              |
| DCS Normal      |                 |                 | Exact string |
| DCS Invert      |                 |                 |              |

### 1f. APRS block (channels)

| Wire field              | CPS options | Observed values | Notes |
| ----------------------- | ----------- | --------------- | ----- |
| `APRS Report Type`      |             |                 |       |
| `APRS Receive`          |             |                 |       |
| `Analog APRS PTT Mode`  |             |                 |       |
| `Digital APRS PTT Mode` |             |                 |       |
| `APRS Report Channel`   |             |                 |       |

### 1g. 0/1 flag columns — confirm meaning of `1`

| Wire field            | UI when `0` | UI when `1` | Notes |
| --------------------- | ----------- | ----------- | ----- |
| `Forbid TX`           |             |             |       |
| `APRS Receive`        |             |             |       |
| `Forbid Talkaround`   |             |             |       |
| `Auto Scan`           |             |             |       |
| `Lone Work`           |             |             |       |
| `Emergency Indicator` |             |             |       |
| `Emergency ACK`       |             |             |       |
| `Direct Dual Mode`    |             |             |       |
| `Private Confirm`     |             |             |       |
| `Short Data Confirm`  |             |             |       |
| `VOX Function`        |             |             |       |
| `PTT ID Display`      |             |             |       |
| `Encryption`          |             |             |       |

---

## 2. `Zones.csv`

| Wire field        | Library / build field             | Hint       | CPS UI                              | Observed | Range / format | Notes |
| ----------------- | --------------------------------- | ---------- | ----------------------------------- | -------- | -------------- | ----- |
| `No.`             | —                                 | Sequential |                                     |          |                |       |
| `Zone Name`       | Zone / build wire name            | ~16        |                                     |          |                |       |
| `Channel Members` | Zone members → channel wire names | Pipe `\|` separated; **no** trailing `\|` (unlike Scan.csv) | | | | Exact separator |

| Question                | Observed |
| ----------------------- | -------- |
| Max members per zone?   |          |
| Empty zone allowed?     |          |
| Duplicate member names? |          |

---

## 3. `Talkgroups.csv`

| Wire field | Library / build field   | Hint                                  | CPS UI | Observed | Range / format | Notes     |
| ---------- | ----------------------- | ------------------------------------- | ------ | -------- | -------------- | --------- |
| `No.`      | —                       | Sequential                            |        |          |                |           |
| `Name`     | `TalkGroup.name` (wire) | FK target                             |        |          |                |           |
| `ID`       | `TalkGroup.digitalId`   | DMR ID                                |        |          |                |           |
| `Type`     | entity kind / export    | Fixture: `Group Call`, `Private Call` |        |          |                | Full enum |

| Question                                     | Observed |
| -------------------------------------------- | -------- |
| Private Call rows live here vs Contacts.csv? |          |
| All Call / other Type values?                |          |

---

## 4. `Contacts.csv`

| Wire field   | Library / build field           | Hint                             | CPS UI | Observed | Range / format | Notes                                                                                 |
| ------------ | ------------------------------- | -------------------------------- | ------ | -------- | -------------- | ------------------------------------------------------------------------------------- |
| `No.`        | —                               | Sequential                       |        |          |                |                                                                                       |
| `ID`         | `DigitalContact.digitalId`      | DMR ID                           |        |          |                |                                                                                       |
| `Repeater`   | —(Studio empty)                 |                                  |        |          |                | Still unmodelled after [#448](https://github.com/pskillen/codeplug-studio/issues/448) |
| `Name`       | `DigitalContact.name`           |                                  |        |          |                |                                                                                       |
| `City`       | `DigitalContact.city`           | Exported                         |        |          |                | Shipped [#448](https://github.com/pskillen/codeplug-studio/issues/448)                |
| `Province`   | `DigitalContact.state`          | Exported as `Province`           |        |          |                |                                                                                       |
| `Country`    | `DigitalContact.country`        | Exported                         |        |          |                |                                                                                       |
| `Remark`     | `DigitalContact.remarks`        | Exported (`comment` is separate) |        |          |                |                                                                                       |
| `Type`       | —(Studio always `Private Call`) |                                  |        |          |                | Other types?                                                                          |
| `Alert Call` | —(Studio `0`)                   | Fixture `0`                      |        |          |                | Non-zero values?                                                                      |

---

## 5. `RXGroupLists.csv`

| Wire field        | Library / build field | Hint                   | CPS UI | Observed | Range / format | Notes |
| ----------------- | --------------------- | ---------------------- | ------ | -------- | -------------- | ----- |
| `No.`             | —                     | Sequential             |        |          |                |       |
| `RX Group Name`   | `RxGroupList.name`    | Includes meta `ALL`    |        |          |                |       |
| `Contact Members` | `members[]` → names   | Pipe-separated; cap 32 |        |          |                |       |

| Question                            | Observed |
| ----------------------------------- | -------- |
| Is `ALL` editable / special in CPS? |          |
| Member order significance?          |          |
| Max members confirmed 32?           |          |

---

## 6. `DTMFContacts.csv`

| Wire field        | Library / build field | Hint        | CPS UI | Observed | Range / format | Notes                  |
| ----------------- | --------------------- | ----------- | ------ | -------- | -------------- | ---------------------- |
| `No.`             | —                     | Sequential  |        |          |                |                        |
| `Analog Contacts` | `AnalogContact.name`  |             |        |          |                |                        |
| `ID`              | `AnalogContact.code`  | DTMF digits |        |          |                | Valid charset / length |

---

## 7. `Scan.csv`

Studio **synthesises** rows from zones when zone-derived scan export is on. Still elicit CPS-native values so constants can be corrected ([#447](https://github.com/pskillen/codeplug-studio/issues/447)).

**Empty-list floor** ([#564](https://github.com/pskillen/codeplug-studio/issues/564)): if derivation would emit zero rows, Studio still writes one default `Scan list 1` row whose `Channel Members` is the first expanded channel wire name + trailing `|` (no synthetic carrier; channel `Scan List` stays `None`).

| Wire field            | Studio export today    | Hint from fixture      | CPS UI | Observed values | Range / format | Notes            |
| --------------------- | ---------------------- | ---------------------- | ------ | --------------- | -------------- | ---------------- |
| `No.`                 | Sequential             |                        |        |                 |                |                  |
| `Scan Name`           | Zone wire name ≤`scanListNameLimit` (**10**) |                        |        |                 | ≤10            | Shipped [#485](https://github.com/pskillen/codeplug-studio/issues/485) / tightened [#547](https://github.com/pskillen/codeplug-studio/pull/547) — confirm CPS max (docs: official ~11) |
| `CTC Scan Mode`       | `Detection CTC`        | same                   |        |                 |                | Other modes?     |
| `Scan Tx Mode`        | `Last Actived Channel` | also `Current Channel` |        |                 |                | Typo “Actived”?  |
| `Hang Time`           | `5.0`                  | `3.0`, `5.0`           |        |                 |                | Step / unit      |
| `Priority Channel 1`  | `None`                 | `None`                 |        |                 |                | Channel name FK? |
| `Priority Channel 2`  | `None`                 | `None`                 |        |                 |                |                  |
| `Designed Channel`    | Carrier wire name (floor: `None`) | Channel name           |        |                 |                |                  |
| `Priority Sweep Time` | `500`                  | `500`, `1100`          |        |                 |                | Units ms?        |
| `Talkback`            | `0`                    | `0`, `1`               |        |                 |                |                  |
| `Channel Members`     | Pipe-separated ≤15 + trailing `\|` | sample ends with `\|` |        |                 | ≤15 named      | Cap/terminator shipped [#486](https://github.com/pskillen/codeplug-studio/issues/486) · [#487](https://github.com/pskillen/codeplug-studio/issues/487); floor ≥1 member [#564](https://github.com/pskillen/codeplug-studio/issues/564) |

---

## 8. `DMR-ID.csv` (not exported by Studio)

Inventory for documentation / future only.

| Wire field   | Hint from fixture | Observed | Notes                                |
| ------------ | ----------------- | -------- | ------------------------------------ |
| `No.`        |                   |          |                                      |
| `Radio ID`   | numeric           |          | Relation to Channels `DMR ID` label? |
| `Radio Name` | display label     |          |                                      |

| Question                                          | Observed |
| ------------------------------------------------- | -------- |
| Does CPS require this file on import of a subset? |          |
| Should Studio ever emit it?                       |          |

---

## Cross-cutting

| Topic                               | Hint                            | Observed |
| ----------------------------------- | ------------------------------- | -------- |
| Pipe `\|` member lists — trailing pipe? | Scan.csv **yes** (shipped); Zones.csv **no** | |
| Case-sensitive name FKs             | Yes                             |          |
| `None` vs empty                     | Mode-dependent                  |          |
| Max channel / zone / TG / contact name length | **16** (`nameLimit`) — PR [#547](https://github.com/pskillen/codeplug-studio/pull/547) | |
| Max scan list name length           | **10** (`scanListNameLimit`; CPS official ~11) — [#485](https://github.com/pskillen/codeplug-studio/issues/485) / [#547](https://github.com/pskillen/codeplug-studio/pull/547) | |
| Max RX group list name length       | **10** (`rxGroupListNameLimit`) | |
| Max zone members                    | **64** (scan still truncates to 15) | |
| Scan CSV named members              | **15** (16th = implicit current channel) — shipped [#486](https://github.com/pskillen/codeplug-studio/issues/486) | |
| Empty Scan.csv                      | Floor row `Scan list 1` + ≥1 member — [#564](https://github.com/pskillen/codeplug-studio/issues/564) | |
| Colour code 0 on digital allowed?   |                                 |          |

---

## Session log

| Date | CPS version | Operator | Summary confirmed |
| ---- | ----------- | -------- | ----------------- |
|      |             |          |                   |

---

## Related

- [DM32 reference hub](README.md)
- [channels.md](channels.md) · [zones.md](zones.md) · [talkgroups.md](talkgroups.md) · [contacts.md](contacts.md) · [rx-group-lists.md](rx-group-lists.md) · [dtmf-contacts.md](dtmf-contacts.md) · [scan-lists.md](scan-lists.md)
- [baofeng-dm32uv.md](radios/baofeng-dm32uv.md)
- Outstanding: [dm32-outstanding.md](../../features/import-export/dm32-outstanding.md)
- Sibling worksheets: [anytone/enum-verification.md](../anytone/enum-verification.md) · [opengd77/enum-verification.md](../opengd77/enum-verification.md)
