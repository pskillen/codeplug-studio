# Contributing a public-service country dataset

Research agents and human contributors add a country by submitting a cited CSV, not by editing TypeScript. Read this whole file before searching.

Accuracy beats coverage. A short, well-cited file is far more valuable than a long one padded with guesses. A blank cell is a valid answer — never invent a value.

Schema detail: [dataset-schema.md](dataset-schema.md). Template and worked example: `scripts/public-services/template.csv`, `scripts/public-services/example.csv`.

## What the data is for

Studio generates **receive-only** memories. You never record anything about transmitting. Every shipped channel has transmit forbidden at creation.

## Include / exclude

| Include | Exclude |
| --- | --- |
| Unencrypted analogue FM and unencrypted DMR | Encrypted systems (TETRA, ESN, P25 with encryption, DMR privacy) |
| Fireground / incident-ground simplex | Trunked talkgroup/tactical detail |
| Maritime, coastguard, SAR common channels | Military; covert/surveillance |
| Ambulance / HEMS air-ground where published and unencrypted | Leaked documents, hacked data, uncited forum hearsay |
| Utility/transport where published and easy | Event-specific assignments; scanner-wiki frequencies with no upstream citation |

If a service is **fully encrypted**, that is a valuable finding — record it in `findings.md` rather than omitting it silently.

Cover one country nationally. Where services are regional, cover what you can cite and say in `findings.md` which regions you could not.

## Output files

Create `scripts/public-services/research/<iso2>/` (`gb`, `ie`, …) with:

| File | Contents |
| --- | --- |
| `channels.csv` | Data. Header exactly as `scripts/public-services/template.csv` |
| `findings.md` | Coverage, encrypted dead ends, conflicts, legal pointers (facts, not advice), open questions |
| `sources.md` | Every source consulted, including dead ends |
| `known-gaps.json` | Optional. `countryLabel`, `datasetVersion`, and operator-facing `knownGaps` |

UTF-8, no BOM, LF only, trailing newline. Quote a field only if it contains a comma, quote, or newline.

## Sourcing

| Tier | `source_type` |
| --- | --- |
| Best | `regulator` |
| Good | `official`, `foi` |
| Acceptable with care | `industry` |
| Last resort | `community` — only when they cite a primary source; prefer citing that source |

1. Every row needs `source_url` and `source_type`.
2. Prefer primary sources. If a wiki cites a regulator PDF, read the PDF and cite that.
3. `confidence=high` needs regulator/official/foi **or** `source_url_2`.
4. Record disagreement; do not silently pick a frequency.
5. Prefer sources under five years old; flag anything ~10 years old in `notes`.
6. Verify the URL resolves. Cite the document's own URL, not a search result.

Do not interpolate a channel plan. Do not carry a frequency across a border. Do not fill `colour_code` or `timeslot` with a common default.

## Dual-mode and duplex

See [dataset-schema.md](dataset-schema.md). Dual-mode = two rows sharing `group_id`+`channel_id`. Duplex legs are from the **monitoring radio's** point of view (`rx` = what you hear).

## Validate, then convert

```bash
node scripts/public-services/validate-dataset.mjs scripts/public-services/research/<iso2>/channels.csv
```

Fix everything it reports. It cannot check whether your sources are real — that stays with you and review.

A maintainer then:

```bash
node scripts/public-services/csv-to-dataset.mjs <iso2>
```

and adds one loader line in `src/app/lib/publicServiceCountries.ts`. Country modules are generated — never hand-edited.

## Report back

Row count by category and confidence; what you covered and could not; encrypted dead ends; anything a human must decide before the data ships.
