# Public service dataset schema

**Purpose:** interchange columns and conventions for `scripts/public-services/research/<iso2>/channels.csv`. This describes **Studio's** dataset, not a vendor CPS wire format.

**Code:** `scripts/public-services/template.csv`, `scripts/public-services/validate-dataset.mjs`, `scripts/public-services/csv-to-dataset.mjs`.

Copy the header from the template. A worked **fictional** example is `scripts/public-services/example.csv` (country `ZZ`, `example.org` URLs) — copy its _shape_, never its rows.

## Columns

| Column                | Required | Format                                                      | Notes                                                                            |
| --------------------- | -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `country_code`        | yes      | ISO 3166-1 alpha-2, uppercase                               | `GB`, `IE`                                                                       |
| `region`              |          | Free text                                                   | Sub-national area; blank for national                                            |
| `service_org`         |          | Free text                                                   | Operating body; blank if shared with no single owner                             |
| `category`            | yes      | Enum                                                        | `fire`, `maritime`, `sar`, `ambulance`, `utility`, `transport`, `event`, `other` |
| `group_id`            | yes      | kebab-case, prefixed with lowercase country                 | `gb-ukfrs-fireground`                                                            |
| `group_label`         | yes      | ≤ 60 chars                                                  | Shown in the picker                                                              |
| `channel_id`          | yes      | kebab-case                                                  | Unique within the group                                                          |
| `name`                | yes      | ≤ 16 ASCII chars                                            | Radio display name — author it, do not auto-truncate                             |
| `label`               | yes      | Free text                                                   | Unabbreviated name                                                               |
| `rx_frequency_hz`     | yes      | Integer Hz                                                  | What the **monitoring radio hears**                                              |
| `tx_frequency_hz`     | yes      | Integer Hz                                                  | What it would transmit on. Simplex repeats RX                                    |
| `mode`                | yes      | `fm` or `dmr`                                               |                                                                                  |
| `is_primary_mode`     | yes      | `true` / `false`                                            | Exactly one `true` per `group_id`+`channel_id`                                   |
| `bandwidth_khz`       |          | `12.5` or `25`                                              | FM only                                                                          |
| `rx_tone` / `tx_tone` |          | CTCSS `77.0` or DCS `D023N`                                 | FM only; blank if unknown                                                        |
| `colour_code`         |          | `0`–`15`                                                    | DMR only; **blank if not documented**                                            |
| `timeslot`            |          | `1` or `2`                                                  | DMR only                                                                         |
| `talkgroup_id`        |          | Integer                                                     | Usually blank — monitoring is promiscuous                                        |
| `encryption`          | yes      | `none` / `unknown`                                          | Only `none` rows convert into the shipped dataset                                |
| `status`              | yes      | `active` / `historic` / `planned` / `unknown`               | v1 generates `active` only                                                       |
| `confidence`          | yes      | `high` / `medium` / `low`                                   | `high` needs regulator/official/foi or `source_url_2`                            |
| `source_type`         | yes      | `regulator` / `official` / `foi` / `industry` / `community` |                                                                                  |
| `source_url`          | yes      | URL                                                         | Must resolve                                                                     |
| `source_title`        | yes      | Free text                                                   |                                                                                  |
| `source_date`         |          | `YYYY-MM-DD` / `YYYY-MM` / `YYYY`                           | Publication date                                                                 |
| `source_url_2`        |          | URL                                                         | Corroboration                                                                    |
| `notes`               |          | Free text                                                   | Conflicts, caveats, whose-Tx convention                                          |

## Dual-mode channels

A frequency that carries both analogue and DMR is **two CSV rows** sharing `country_code` + `group_id` + `channel_id`, differing only in the mode columns. Exactly one row has `is_primary_mode=true`. The converter merges them into one `PublicServiceEntry` with two `modes`.

## Duplex convention — radio's point of view

Every row is written from the **monitoring handheld**, never from the base station or licence schedule:

| Column            | Meaning                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `rx_frequency_hz` | Repeater output / coast-station transmit / simplex — the leg you hear |
| `tx_frequency_hz` | Repeater input / mobile transmit. Equal to RX when simplex            |

Regulator tables often list the licensee's transmitter as "Tx". That may be our `rx_frequency_hz`. Say in `notes` which way round the source had it.

Forced `forbidTransmit` is what prevents transmission. Recording a real split does not authorise it.

## Conversion

```bash
node scripts/public-services/validate-dataset.mjs scripts/public-services/research/ie/channels.csv
node scripts/public-services/csv-to-dataset.mjs ie
```

Optional fields that are blank in the CSV become **absent keys** in TypeScript, never zeroes. `known-gaps.json` beside the CSV populates `PublicServiceCountry.knownGaps`.
