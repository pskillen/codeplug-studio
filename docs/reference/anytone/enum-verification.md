# Anytone — enum verification checklist

Tier-3 wire reference. Values **observed** in the operator rich AT-D890UV export (`D890 codeplug export`, July 2026). A single codeplug rarely contains every enum value — use this list to **manually elicit** missing values in CPS and update wire docs + `channelDefaults.ts` / serialisers.

**Tracking:** [#297](https://github.com/pskillen/codeplug-studio/issues/297) · **Manual elicitation:** [#307](https://github.com/pskillen/codeplug-studio/issues/307) (coordinates with [#303](https://github.com/pskillen/codeplug-studio/issues/303)) · **Gaps:** [csv-reconciliation-gaps.md](../../features/import-export/anytone/csv-reconciliation-gaps.md)

**Legend**

| Status                | Meaning                                           |
| --------------------- | ------------------------------------------------- |
| **Observed**          | At least one value seen in operator export        |
| **Studio default**    | Value Studio exports today when unmodelled        |
| **Needs elicitation** | No or insufficient sample data — verify in CPS UI |

---

## `Channel.CSV` (priority — Studio exports)

| Column                         | Status   | Values observed                                 | Studio default                          | Needs elicitation             |
| ------------------------------ | -------- | ----------------------------------------------- | --------------------------------------- | ----------------------------- |
| `Channel Type`                 | Observed | `D-Digital`, `A-Analog`, `D+A TX D`, `A+D TX A` | From `modeProfiles` + `primaryMode`     | `2` / `3` DCDM not modelled   |
| `Transmit Power`               | Observed | `High`, `Low`, `Turbo`                          | `Low` / `High` from `%` ladder          | Full ladder + `Turbo` mapping |
| `Band Width`                   | Observed | `12.5K`, `25K`                                  | From `bandwidthKHz`                     | —                             |
| `Contact/Talk Group Call Type` | Observed | `Group Call` only                               | From `contactRef` kind                  | `Private Call` on channel row |
| `Busy Lock/TX Permit`          | Observed | `Always`, `Off`                                 | `Always`                                | Other values?                 |
| `Squelch Mode`                 | Observed | `Carrier`                                       | `Carrier`                               | Other modes                   |
| `Optional Signal`              | Observed | `Off`                                           | `Off`                                   | DTMF / 5Tone / …              |
| `PTT ID`                       | Observed | `Off`                                           | `Off`                                   | On + ID refs                  |
| `Slot`                         | Observed | `1`, `2`                                        | From `timeslot`                         | —                             |
| `PTT Prohibit`                 | Observed | `Off`, `On`                                     | `Off`                                   | —                             |
| `Reverse`                      | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `Digital Duplex`               | Observed | `Off`                                           | `Off`                                   | `On` / other                  |
| `Slot Suit`                    | Observed | `Off`                                           | `Off`                                   | —                             |
| `AES Digital Encryption`       | Observed | `Normal Encryption`                             | `Normal Encryption`                     | Other encryption modes        |
| `Digital Encryption`           | Observed | `Off`                                           | `Off`                                   | On + key refs                 |
| `Call Confirmation`            | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `Talk Around(Simplex)`         | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `Work Alone`                   | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `Ranging`                      | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `Idle TX`                      | Observed | `Off`, `On`                                     | `Off`                                   | —                             |
| `APRS RX`                      | Observed | `Off`, `On`                                     | `Off`                                   | APRS ticket                   |
| `Analog APRS PTT Mode`         | Observed | `Off`                                           | `Off`                                   | —                             |
| `Digital APRS PTT Mode`        | Observed | `Off`                                           | `Off`                                   | —                             |
| `APRS Report Type`             | Observed | `Off`                                           | `Off`                                   | Report type strings           |
| `SMS Confirmation`             | Observed | `Off`                                           | `Off`                                   | `On`                          |
| `DMR MODE`                     | Observed | `0`, `1`                                        | `0` / `1` from `dmrMode` or RX/TX infer | `2` / `3` (DCDM) deferred     |
| `DataACK Disable`              | Observed | `0`, `1`                                        | `0`                                     | Meaning of `1`                |
| `Auto Scan`                    | Observed | `0`                                             | `0`                                     | `1`                           |
| `Ana APRS Mute`                | Observed | `0`                                             | `0`                                     | —                             |
| `Send Talker Alias DMR/NX`     | Observed | `0`                                             | `0`                                     | Non-zero values               |
| `ARC4`                         | Observed | `0`                                             | `0`                                     | Key index strings             |
| `ex_emg_kind`                  | Observed | `0`                                             | `0`                                     | Emergency kinds               |
| `nxdn_wn`                      | Observed | `0`, `1`                                        | `0`                                     | NXDN wide/narrow              |
| `NxdnEncry`                    | Observed | `0`                                             | `0`                                     | —                             |
| `EnRan` / `DeRan`              | Observed | `0`                                             | `0`                                     | —                             |
| `Scan List`                    | Observed | `None` (+ names when used)                      | `None` or FK                            | —                             |
| `Receive Group List`           | Observed | `None` + RGL names                              | FK / `None`                             | —                             |
| `CTCSS/DCS Decode` / `Encode`  | Observed | `Off`, analog tone strings                      | Mapped from `rxTone`/`txTone`           | Full DCS set                  |

---

## `DMRTalkGroups.CSV`

| Column       | Status   | Values observed | Studio default |
| ------------ | -------- | --------------- | -------------- |
| `Call Type`  | Observed | `Group Call`    | `Group Call`   |
| `Call Alert` | Observed | `None`          | `None`         |

**Needs elicitation:** non-`None` call alert strings.

---

## `DMRDigitalContactList.CSV`

| Column             | Status   | Values observed       | Studio default |
| ------------------ | -------- | --------------------- | -------------- |
| `Call Type`        | Observed | `Private Call`        | `Private Call` |
| `Call Alert`       | Observed | `None`                | `None`         |
| `Callsign`         | Observed | Empty (name-only row) | `''`           |
| `City` … `Remarks` | Observed | Empty                 | `''`           |

**Needs elicitation:** non-`None` `Call Alert` strings; private contact with populated `Callsign` and address fields.

---

## `ScanList.CSV`

| Column                     | Status   | Values observed                   | Studio default        |
| -------------------------- | -------- | --------------------------------- | --------------------- |
| `Scan Mode`                | Observed | `Off`                             | `Off`                 |
| `Priority Channel Select`  | Observed | `Off`                             | `Off`                 |
| `Priority Channel 1` / `2` | Observed | `Off`                             | `Off`                 |
| `Revert Channel`           | Observed | `Selected + TalkBack`, `Selected` | `Selected + TalkBack` |
| `Look Back Time A[s]`      | Observed | `2.0`                             | `2.0`                 |
| `Look Back Time B[s]`      | Observed | `3.0`                             | `3.0`                 |
| `Dropout Delay Time[s]`    | Observed | `3.1`                             | `3.1`                 |
| `Dwell Time[s]`            | Observed | `3.1`                             | `1.0`                 |

**Needs elicitation:** `Scan Mode` ≠ `Off`; priority channel select enabled; non-`Off` priority channel names.

---

## `FM.CSV`

| Column | Status   | Values observed | Studio default |
| ------ | -------- | --------------- | -------------- |
| `Scan` | Observed | `Add`, `Del`    | TBD at export  |

---

## `AMZone.CSV`

No enum columns — name/FK columns only. Confirms need for **airband zone export** separate from `DMRZone.CSV`.

---

## Deferred files (inventory only)

Elicit when those features are scheduled — not required for DMR MVP reconciliation:

| File                           | Notes                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `OptionalSetting.CSV`          | ~199 columns; numeric/bit enums — candidate for build-scoped radio settings model |
| `APRS.CSV`                     | ~184 columns — separate APRS initiative                                           |
| `NXSetting.CSV`                | NXDN global row                                                                   |
| `RoamingChannel.CSV`           | `Color Code` / `Slot` = `No Use` in sample                                        |
| `HotKey_*.CSV`                 | `Mode`: `Call`, `Menu`; …                                                         |
| `AlertTone.CSV`                | Frequency/time grids — not enums                                                  |
| Encryption / DTMF / MDC tables | Skip tier for MVP                                                                 |

---

## How to update this doc

1. Change setting in official CPS; export-all.
2. Diff new value against **Values observed** column.
3. Update this file + entity wire doc (`channels.md`, …) + Studio mapper or document as **export default**.

## Related

- [file-format.md](file-format.md) — fidelity tiers
- [channels.md](channels.md) — DMR column mapping
