# Anytone — file format conventions

Cross-cutting rules for AT-D890UV CPS CSV exports. Per-entity columns live in sibling wire docs.

## Physical format

| Property        | Value (AT-D890UV sample)                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Delimiter       | Comma (`,`)                                                                                            |
| Quoting         | **All** fields double-quoted on every line, including the header row (e.g. `"No.","Channel Name","1"`) |
| Encoding        | UTF-8 assumed (verify BOM on import)                                                                   |
| Line endings    | **CRLF** on Studio export (official CPS bundles); normalise to LF in tests when comparing fixtures     |
| Filename casing | PascalCase with `.CSV` extension (e.g. `Channel.CSV`)                                                  |

### Quoting and embedded double quotes

Studio export wraps every field in double quotes. Embedded `"` characters in wire values are **stripped** on export (`Foo "bar"` → `"Foo bar"`) — not RFC 4180 `""` escaping. Anytone CPS does not reliably escape quotes on import or export; stripping avoids malformed cells. Library model values are unchanged; loss is documented at the export boundary only. Unlikely in practice for channel or list names.

## Frequencies

| Context                         | Wire format                                         | Internal                          |
| ------------------------------- | --------------------------------------------------- | --------------------------------- |
| `Channel.CSV` RX/TX             | MHz, five decimal places (`438.80000`)              | Hz (`rxFrequency`, `txFrequency`) |
| `AMAir.CSV` / `FM.CSV`          | MHz, four decimal places (`118.8000`, `99.500`)     | Hz                                |
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

## Row numbering (`No.`)

| File            | Programmed rows     | VFO / special rows       |
| --------------- | ------------------- | ------------------------ |
| `Channel.CSV`   | Low `No.` (1, 2, …) | VFO at `4001`, `4002`, … |
| `AMAir.CSV`     | Low `No.`           | VFO at `257` in sample   |
| `FM.CSV`        | Low `No.`           | VFO at `101` in sample   |
| Zones, scan, TG | Sequential from 1   | —                        |

Export adapters should preserve CPS slot semantics when round-tripping imported codeplugs.

## Fidelity tiers

| Tier               | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| **Bidirectional**  | Wire ↔ internal model field with documented mapping   |
| **Export default** | Constant or profile default on export when unmodelled |
| **Header-only**    | File exported with headers; body not modelled yet     |
| **Skip**           | File not imported or exported                         |

## Locale

Unlike OpenGD77 (OS-locale delimiter quirks), the AT-D890UV sample uses comma delimiter and `.` decimal separator throughout. Re-verify if operator reports locale-variant exports.

## Related

- [README — file inventory](README.md)
- [channels.md](channels.md)
