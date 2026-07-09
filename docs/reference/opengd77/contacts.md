# OpenGD77 — Contacts.csv

Generic column reference for `Contacts.csv`. One file holds both **group talk groups** and **private contacts**; the app splits rows by `ID Type` at import and merges back on export.

**Code:** [`columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts) · [`parse.ts`](../../../src/core/import-export/formats/opengd77/parse.ts) · [`serialise.ts`](../../../src/core/import-export/formats/opengd77/serialise.ts)

## Required headers (app import)

| Header         | Reason                                         |
| -------------- | ---------------------------------------------- |
| `Contact Name` | Identity; rows without a name are skipped      |
| `ID`           | DMR ID                                         |
| `ID Type`      | Determines talk group vs private contact split |

`TS Override` is optional — empty if absent.

## Column reference

| Vendor header  | Internal field                     | Required (import) | Import rule                                                | Export rule                                                                                                                                                                                                   | Bidirectional mapping | Notes                                   |
| -------------- | ---------------------------------- | ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| `Contact Name` | `TalkGroup.name` or `Contact.name` | **Yes**           | Trim; skip row if empty                                    | Talk groups: shortened when over profile `nameLimit` when export shortening is on — `TalkGroup.abbreviation` first, then dictionary; private contacts: shortened when over limit when export shortening is on | String pass-through   | FK target for Channels and TG_Lists     |
| `ID`           | `.number`                          | **Yes**           | Trim                                                       | As stored                                                                                                                                                                                                     | String pass-through   | DMR ID integer as string                |
| `ID Type`      | (entity kind)                      | **Yes**           | `Group` (case-insensitive) → `TalkGroup`; else → `Contact` | `Group` / `Private`                                                                                                                                                                                           | Lossless split        | CPS values: `Group`, `Private`          |
| `TS Override`  | `.timeslotOverride`                | No                | Trim                                                       | As stored                                                                                                                                                                                                     | String pass-through   | `1`, `2`, or `Disabled` — CPS slot hint |

## Split semantics

| `ID Type` | Internal model | Typical use                                                            |
| --------- | -------------- | ---------------------------------------------------------------------- |
| `Group`   | `TalkGroup`    | TX/RX talk groups referenced by `Channels.Contact` and TG list members |
| `Private` | `Contact`      | Individual DMR IDs                                                     |

Export order: all talk groups first, then private contacts (order within each group follows codeplug array order).

## Naming conventions

One TG ID may appear as **two contacts** with timeslot suffixes in the name (e.g. `Scotland TS1`, `Scotland TS2`) — CPS uses separate names per slot.

Member names in `TG_Lists.csv` reference `Contact Name` here — group and private names both resolve.

## Related

- [Channels](channels.md) · [TG lists](tg-lists.md)
- [File format rules](file-format.md)
- [Data model — TalkGroup / Contact](../../features/data-model/README.md)
