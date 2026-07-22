# Digital contacts (internal model)

Tier-2 reference for the vendor-neutral **`DigitalContact`** library entity — private digital-mode contacts (DMR, D-STAR, etc.), not talk groups or analog DTMF contacts.

Format-specific wire mapping lives in per-format references under `docs/reference/export-formats/<format>/` (e.g. Anytone: [anytone/talk-groups.md](formats/anytone/talk-groups.md)).

## Fields

| Field       | Type                 | Semantics                                                                 |
| ----------- | -------------------- | ------------------------------------------------------------------------- |
| `id`        | UUID                 | Internal FK — relationships use `id`, not `name` or callsign              |
| `mode`      | `DigitalChannelMode` | Protocol family (`dmr`, `dstar`, `ysf`, …)                                |
| `name`      | string               | Display / export label (may mirror operator alias or directory full name) |
| `digitalId` | number               | Numeric radio ID on the wire                                              |
| `callsign`  | string               | Amateur callsign when known; may differ from `name`                       |
| `city`      | string               | City or locality                                                          |
| `state`     | string               | State, province, or region                                                |
| `country`   | string               | Country name                                                              |
| `remarks`   | string               | Wire-oriented remarks (CPS Remarks column on some formats)                |
| `comment`   | string               | Internal operator notes — not exported on all formats                     |

All string metadata fields default to `''` when unset. Legacy library rows without address fields round-trip as empty strings.

## Boundaries

- **Library CRUD** — no format cardinality caps; unlimited contacts per project.
- **Export** — format adapters may truncate or warn on wire length; project from model fields, not stashed CPS cells.
- **Import** — remote directory data (e.g. RadioID.net) maps at the integration boundary; see [contact directories](../features/contact-directories/README.md).

## Related

- [library feature hub](../features/library/README.md)
- [callsigns.md](callsigns.md) — channel/repeater callsign conventions (separate from contact `callsign`)
