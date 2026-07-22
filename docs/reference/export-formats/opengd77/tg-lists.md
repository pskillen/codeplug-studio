# OpenGD77 — TG_Lists.csv

Generic column reference for `TG_Lists.csv` (promiscuous RX group lists). Member column count is radio-profile-specific — see [profiles.md](profiles.md) / [dm-1701](../../radios/baofeng/dm-1701/README.md).

**Code:** [`columns.ts`](../../../../src/core/import-export/formats/opengd77/columns.ts) (`rxGroupListMemberHeaders`) · [`parse.ts`](../../../../src/core/import-export/formats/opengd77/parse.ts) · [`serialise.ts`](../../../../src/core/import-export/formats/opengd77/serialise.ts)

## Wire pattern

| Pattern                 | Role                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `TG List Name`          | List display name; referenced by `Channels.TG List`              |
| `Contact1` … `ContactN` | Member contact names (group talk groups and/or private contacts) |

Empty trailing member cells are allowed.

## Column reference

| Vendor header         | Internal field                                | Required (import) | Import rule                                                      | Export rule                                      | Bidirectional mapping | Notes                                          |
| --------------------- | --------------------------------------------- | ----------------- | ---------------------------------------------------------------- | ------------------------------------------------ | --------------------- | ---------------------------------------------- |
| `TG List Name`        | `RxGroupList.name`                            | **Yes**           | Trim; skip row if empty                                          | As stored                                        | String pass-through   | FK from `Channels.TG List`                     |
| `Contact1`…`ContactN` | `RxGroupList.meta.imported.memberWireNames[]` | No                | Collect non-empty cells in column order; any `Contact\d+` header | Pad into `Contact1`…`ContactN` up to profile cap | Lossless names        | Members are **vendor names** from Contacts.csv |

## Promiscuous RX semantics

OpenGD77 uses TG lists for **promiscuous receive** on digital channels:

- **TX talk group:** set `Channels.Contact` to the desired TX contact name.
- **Promiscuous RX:** set `Channels.TG List` to a list name; list members define which talk groups the radio listens for on that channel.
- Typical pattern: set `Contact` **or** use `TG List` for RX-heavy repeater channels — see [channels.md](channels.md) examples.

The app exports one channel row per repeater/site with a TG list reference — the lean model. Formats without native RGL support use shared [multi-talkgroup expansion](../../multi-talkgroup-expansion.md) instead (archive reference #36).

## Import / export notes

- Member names are stored as `sourceMemberNames` — not resolved to internal contact/talk-group ids (name-based FK at vendor boundary).
- Export writes members in array order into numbered contact columns.
- Names beyond the radio profile member cap are truncated at export (today: hard-coded profile cap in code).

## Related

- [Contacts](contacts.md) · [Channels](channels.md)
- [File format rules](file-format.md)
- [Multi-talkgroup expansion](../../reference/multi-talkgroup-expansion.md) — domain rules for formats without native RGL (N/A for OpenGD77)
