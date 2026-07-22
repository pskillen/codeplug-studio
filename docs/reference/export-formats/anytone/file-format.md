# Anytone — file format conventions

Cross-cutting rules for AT-D890UV CPS CSV exports. Per-entity columns live in sibling wire docs.

## Physical format

| Property        | Value (AT-D890UV sample)                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Delimiter       | Comma (`,`)                                                                                                 |
| Quoting         | **All** fields double-quoted on every line, including the header row (e.g. `"No.","Channel Name","1"`)      |
| Encoding        | UTF-8 assumed (verify BOM on import)                                                                        |
| Line endings    | **CRLF** on Studio export for `.CSV` and `.LST` manifests; normalise to LF in tests when comparing fixtures |
| Filename casing | PascalCase with `.CSV` extension (e.g. `Channel.CSV`)                                                       |

### Quoting and embedded double quotes

Studio export wraps every field in double quotes. Embedded `"` characters in wire values are **stripped** on export (`Foo "bar"` → `"Foo bar"`) — not RFC 4180 `""` escaping. Anytone CPS does not reliably escape quotes on import or export; stripping avoids malformed cells. Library model values are unchanged; loss is documented at the export boundary only. Unlikely in practice for channel or list names.

**Wire verification:** External verifier (`cps-verify`, [#480](https://github.com/pskillen/codeplug-studio/issues/480)) requires universal double-quoting on every `.CSV` field and rejects embedded `"` inside field bodies. Committed mapping fixtures under `test-data/` may use LF; verifier good samples under `cps-verify/fixtures/` must use **CRLF**.

## Frequencies

| Context                         | Wire format                                         | Internal                          |
| ------------------------------- | --------------------------------------------------- | --------------------------------- |
| `Channel.CSV` RX/TX             | MHz, five decimal places (`438.80000`)              | Hz (`rxFrequency`, `txFrequency`) |
| `AMAir.CSV`                     | MHz, four decimal places (`118.8000`)               | Hz                                |
| `FM.CSV`                        | MHz, three decimal places (`99.500`)                | Hz                                |
| Zone / scan member freq columns | MHz, five decimal places, pipe-aligned with members | Hz (export denormalisation)       |

## Foreign keys

Lists cross-reference each other by **exact name match** (case-sensitive) at the wire edge:

| Pattern              | Example                                            |
| -------------------- | -------------------------------------------------- |
| Single name          | `Scan List` → `Zone A SCL`                         |
| Pipe-separated names | `Zone Channel Member` → `Channel 1\|Channel 2`     |
| Pipe-separated IDs   | `Contact TG/DMR ID` → `23551\|2355`                |
| Sentinels            | `None`, `Off` — document per column in entity docs |

Internal model uses UUID `id` FKs; name resolution belongs in import/export adapters only.

When **Shorten long names** is enabled on a build (default), Studio shortens CPS name columns to the radio profile limit at export. Anytone requires one canonical string per entity across all CSV files in a single export pass ([#292](https://github.com/pskillen/codeplug-studio/issues/292)).

**Wire verification:** Name FKs must resolve to a row in the target table (or a documented sentinel). Pipe-separated member lists must not exceed radio profile caps — see [profiles.md](profiles.md) / [at-d890uv](../../radios/anytone/at-d890uv/README.md).

## Headers

Modelled export files use an **exact** header set and column order (as in `columns.ts` / entity docs). CPS is strict about column identity; reordering or dropping modelled headers is a wire defect.

## Row numbering (`No.`)

| File            | Programmed rows     | VFO / special rows                                                                                                                                            |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Channel.CSV`   | Low `No.` (1, 2, …) | Official CPS may append VFO at `4001`, `4002` — **Studio need not emit**; CPS adds on import ([#357](https://github.com/pskillen/codeplug-studio/issues/357)) |
| `AMAir.CSV`     | Low `No.`           | VFO at `257` in sample (optional; CPS may correct)                                                                                                            |
| `FM.CSV`        | Low `No.`           | VFO at `101` in sample (optional; CPS may correct)                                                                                                            |
| Zones, scan, TG | Sequential from 1   | —                                                                                                                                                             |

Scan list timing enums and AnyTone terminology: [scan-lists.md](scan-lists.md).

## Fidelity tiers

| Tier               | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| **Bidirectional**  | Wire ↔ internal model field with documented mapping   |
| **Export default** | Constant or profile default on export when unmodelled |
| **Header-only**    | File exported with headers; body not modelled yet     |
| **Skip**           | File not imported or exported                         |

## Locale

Unlike OpenGD77 (OS-locale delimiter quirks), the AT-D890UV sample uses comma delimiter and `.` decimal separator throughout. Re-verify if operator reports locale-variant exports.

## Wire verification

Structural / mechanical rules enforced by the external verifier ([docs/build/testing/wire-verification.md](../../../build/testing/wire-verification.md)):

| Rule           | Expectation                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Line endings   | CRLF on `.CSV` and `.LST`                                                                                          |
| Quoting        | Every CSV field double-quoted                                                                                      |
| Escaping       | No embedded `"` inside field bodies                                                                                |
| Headers        | Exact modelled column set + order when the file is present                                                         |
| Foreign keys   | Cross-file name refs resolve; `None` / `Off` / empty are sentinels where documented                                |
| Cardinality    | Zone / scan / RGL member counts and name lengths within [AT-D890UV caps](../../radios/anytone/at-d890uv/limits.md) |
| Required files | Core DMR tables + `.LST` when validating a full bundle that includes `Channel.CSV`                                 |

## Related

- [README — file inventory](README.md)
- [channels.md](channels.md)
- [lst-manifest.md](lst-manifest.md)
