# List kit roles

Deep dive for the four-role list kit: entity inventory, member picker, membership list, and extreme-scale inventory. Kit + styleguide land under [#460](https://github.com/pskillen/codeplug-studio/issues/460); production adoption is a follow-up on the same ticket.

**Parent:** [#52](https://github.com/pskillen/codeplug-studio/issues/52) Phase 2b UI improvements  
**Related:** [#199](https://github.com/pskillen/codeplug-studio/issues/199) styleguide kit · [#381](https://github.com/pskillen/codeplug-studio/issues/381) virtualisation · superseded sketch [#459](https://github.com/pskillen/codeplug-studio/issues/459)

**Progress:** [list-kit-460-progress.md](list-kit-460-progress.md) · [list-kit-460-outstanding.md](list-kit-460-outstanding.md)

## Purpose

Not one mega-table. Specialised shells share filter / selection / reorder vocabulary but optimise for job and cardinality.

| Role | Working name | Shell | Cardinality | Job |
| --- | --- | --- | --- | --- |
| **A** | Entity list | [`DataTable`](../../src/app/components/ui/DataTable.md) | High (hundreds–thousands) | First-class entity inventory — filter, sort, persist prefs, multi-select, row/bulk actions, rich columns, virtualise |
| **B** | Member picker | [`AvailableItemPicker`](../../src/app/components/ui/AvailableItemPicker.md) | High (pool minus members) | Stage candidates to add — sparse rows, filter, multi-select → add; no edit/delete/reorder of candidates |
| **C** | Membership list | [`SelectedItemList`](../../src/app/components/ui/SelectedItemList.md) | Low (typically &lt;100) | Curate ordered members — reorder, remove, membership props, bulk ops; find-in-list filter |
| **D** | Extreme inventory | `DataTable` with `scale="extreme"` | Very high (up to ~200k contacts) | Same **look** as A; harder **perf contract** (always-on virtualise, cheap cells) |

```text
B  Member picker  ──add──►  C  Membership list
     high · sparse                 low · order + props

A  Entity list          (standalone library / build lists)
D  Extreme inventory    (A’s face, harder guts — contacts)
```

## Gold references

| Role | Reference surface |
| --- | --- |
| **A** | Library → Channels list |
| **B+C pair** | Zones → Edit → Pick members (`ZoneMemberEditor`) |
| **D** | Library → Contacts (digital) — scale path |

Also fold charms from Zones list (order-mode honesty) and wire-preview lists (dense custom / inline cells) into **A** where appropriate.

## Surface → role map

| ID | Surface | Role |
| --- | --- | --- |
| L1 | Channels list | **A** |
| L2 | Zones list | **A** (+ order mode) |
| L3 | Talk groups list | **A** |
| L4 | Contacts — digital | **D** |
| L5 | Contacts — analog | **A** |
| L6 | RX group lists | **A** |
| L7 | Scan lists | **A** |
| L8 | Zone from location preview | **A** (embedded) |
| L9 | APRS channel slots | **C**-ish / embedded **A** |
| L10 | APRS channel assignment | **A** (external filter) |
| B1 | Builds list | **A** |
| B2–B3 | Wire preview / flat memory | **A** (specialised columns) |
| B4 | Channels bulk wire edit | **A** candidate (today raw Mantine) |
| B5 | Export resolution | **Specialised** (config matrix) |
| B6 | CPS CSV preview | **Specialised** (wire spreadsheet) |
| I1 | RadioID contact search | **A** (+ API pagination sibling) |
| I2 / I4 | Field-diff update dialogs | **Specialised** (diff table) |
| I3 | Repeater directory search | **A** candidate (today raw Mantine) |
| I5 | BrandMeister RX sync | **Specialised** (review dialog) |
| I6 | Channel set picker | **A** candidate |
| I7 | OpenAIP airport search | Out of kit (nested custom lists) |
| R1 | Band plan | **Specialised** (static reference) |
| R2 | Summary counts | Ignore |
| E1 | Scan / RX summaries | Low priority read-only |
| E2 | Zone / scan pick + members | **B** + **C** |
| D1 | Debug storage tables | **A** consumers |
| S1 | Styleguide | Demos for A/B/C/D |

## Code anchors

| Symbol | Path | Role |
| --- | --- | --- |
| `DataTable` | `src/app/components/ui/DataTable.tsx` | A / D |
| `AvailableItemPicker` | `src/app/components/ui/AvailableItemPicker.tsx` | B |
| `SelectedItemList` | `src/app/components/ui/SelectedItemList.tsx` | C |
| List prefs / virtualisation | `src/app/lib/dataTable/`, `src/app/hooks/useListNameQuery.ts`, … | A support |
| Styleguide | `/styleguide`, `/styleguide/data-table`, `/styleguide/membership`, … | Dev demos |

See also [data-table.md](data-table.md) for list prefs and virtualisation detail.

## Styleguide

Dev-only (unlinked from product nav):

| Path | Contents |
| --- | --- |
| `/styleguide` | Index — role legend + links |
| `/styleguide/layout` | Page / ListPage / FormPage shells |
| `/styleguide/data-table` | Role A + D demos |
| `/styleguide/membership` | Role B + C (+ paired demo) |
| `/styleguide/controls` | Other UI kit controls |

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Role map doc | Shipped (this page) | |
| Styleguide split | In progress | [#460](https://github.com/pskillen/codeplug-studio/issues/460) |
| Kit API A/B/C/D | In progress | |
| Production adoption | Deferred | See outstanding |
