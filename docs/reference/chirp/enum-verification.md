# CHIRP CSV — enum / column verification

Human + source-backed checklist for Studio CHIRP CSV vs [CHIRP](https://chirp.danplanet.com/) Generic CSV / `Memory.CSV_FORMAT`.

**Tracking:** [#598](https://github.com/pskillen/codeplug-studio/issues/598) · [#405](https://github.com/pskillen/codeplug-studio/issues/405) · profiles [#602](https://github.com/pskillen/codeplug-studio/issues/602) / [#600](https://github.com/pskillen/codeplug-studio/issues/600) / [#601](https://github.com/pskillen/codeplug-studio/issues/601)

**CHIRP ground truth (workspace):** `chirp/chirp_common.py` (`Memory.CSV_FORMAT`, `to_csv`), `chirp/drivers/generic_csv.py` (`ATTR_MAP`), radio drivers under `chirp/drivers/`.

Fill **Observed** when re-checking against a live CHIRP build; **Source** is from the Python tree.

## Header row

| Column                      | CHIRP `CSV_FORMAT`                | Studio `CHIRP_HEADERS` | Status              |
| --------------------------- | --------------------------------- | ---------------------- | ------------------- |
| Location … DVCODE (21 cols) | Exact list in `Memory.CSV_FORMAT` | Exact match            | **Match** (2026-07) |

## Shared memory columns

| Column                       | Source behaviour                                                                                                             | Studio export                                     | Status                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Location                     | 1-based memory number                                                                                                        | 1-based slot                                      | Match                                                                                     |
| Name                         | driver `valid_name_length`                                                                                                   | profile `nameLimit`                               | Per-radio                                                                                 |
| Frequency                    | MHz string via `format_freq`                                                                                                 | 6 dp MHz                                          | Match intent                                                                              |
| Duplex                       | `""`, `+`, `-`, `off`, …                                                                                                     | `deriveChirpDuplexAndOffset`                      | Match intent; `split` N/A                                                                 |
| Offset                       | MHz                                                                                                                          | MHz 6 dp                                          | Match                                                                                     |
| Tone / rToneFreq / cToneFreq | tmode + tones                                                                                                                | Tone/TSQL/DTCS/Cross via `formatChirpToneColumns` | Match intent (`split_tone_decode`)                                                        |
| Dtcs\* / CrossMode           | full DCS model                                                                                                               | model-driven from `rxTone`/`txTone`               | **Match intent** (export; [#527](https://github.com/pskillen/codeplug-studio/issues/527)) |
| Mode                         | radio `valid_modes`                                                                                                          | NFM/FM/AM                                         | Match subset                                                                              |
| TStep                        | memory tuning_step                                                                                                           | constant `5.00`                                   | Accepted constant                                                                         |
| Skip                         | `""` / `S` (and sometimes `P`)                                                                                               | `S` or empty                                      | Match; `P` unsupported                                                                    |
| Power                        | `str(power)` — often **labels** from radio drivers; Generic CSV / `parse_power` also accept **watt** strings (`5.0W`, `10W`) | Watt strings from profile ladder                  | **Documented divergence** — see below                                                     |
| Comment                      | memory comment                                                                                                               | not exported (empty)                              | Documented loss                                                                           |
| URCALL…                      | D-STAR                                                                                                                       | empty                                             | Documented loss                                                                           |

### Power wire strings

| Path                                    | Typical `Power` cell                                                      |
| --------------------------------------- | ------------------------------------------------------------------------- |
| CHIRP **radio driver** → CSV (`to_csv`) | Level **label** (`High`, `Low`, `Medium`, …)                              |
| CHIRP **Generic CSV** / `parse_power`   | Watt string (`5.0W`, `10W`, `25W`, …) via `AutoNamedPowerLevel`           |
| Studio export                           | Watt strings from `profiles.ts` ladders (fixtures + Generic CSV friendly) |

Studio keeps watt strings for interchange with Generic CSV and existing goldens. Radio-label export is out of scope until a follow-up needs CHIRP radio-native CSV labels.

## Per-radio caps (CHIRP drivers vs Studio)

| Profile      | CHIRP class                          | Driver caps (source)                                               | Studio (after 2026-07 RE)                                             |
| ------------ | ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `chirp-uv5r` | `UV5RMini` (`baofeng_uv17Pro.py`)    | `CHANNELS=999`, `LENGTH_NAME=12` (UV17Pro), High 5 W / Low 1 W     | 999 / 12 / `5.0W`·`1.0W` — **Match**                                  |
| `chirp-uv21` | `UV21ProV2` (inherits UV17Pro)       | `CHANNELS=1000`, `LENGTH_NAME=12`, High 5 W / Low 1 W              | Was 128/16/6 W ladder — **corrected** to 1000 / 12 / `5.0W`·`1.0W`    |
| `chirp-rt95` | `RetevisRT95vox` (`anytone778uv.py`) | `memory_bounds=(1,200)`, `NAME_LENGTH=6`, Low/Med/High ≈ 5/10/25 W | Was 128/16 — **corrected** to 200 / 6; watt ladder `25W`/`10W`/`5.0W` |

## Operator elicitation backlog

| Item                                                                   | Priority | Notes                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live CHIRP export of UV-21 / RT95 confirming watt vs label Power cells | Medium   | Optional if sticking to Generic CSV convention                                                                                                                                                                           |
| `P` priority skip                                                      | Low      | Unsupported                                                                                                                                                                                                              |
| DCS / CrossMode import (`DTCS` / `Cross` parse)                        | Medium   | Export done ([#527](https://github.com/pskillen/codeplug-studio/issues/527)); import under [#222](https://github.com/pskillen/codeplug-studio/issues/222)–[#226](https://github.com/pskillen/codeplug-studio/issues/226) |

## Related

- [channels.md](channels.md)
- [radios/](radios/README.md)
- Feature hub: [chirp/README.md](../../features/import-export/chirp/README.md)
