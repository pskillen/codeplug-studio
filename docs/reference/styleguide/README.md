# UI interaction styleguide

Contributor and agent reference for **how we build UI** in Codeplug Studio — which shell to pick, how ordering and Sort… work, and the chrome conventions that keep library, builds, and import pickers coherent.

This is **not** user-facing help copy. For wording aimed at operators, use [help writing styleguide](../writing-styleguide/help-writing-styleguide.md). For value formatting (frequencies, pills, icons), use [display conventions](../display-conventions.md).

**Tracking:** [#465](https://github.com/pskillen/codeplug-studio/issues/465) · Parent [#52](https://github.com/pskillen/codeplug-studio/issues/52)  
**Interactive demos:** `/styleguide/*` (dev-only, unlinked) — visual catalogue; this doc is the written contract.

## When to read this

- Adding or reworking a **list**, **picker**, or **membership** UI
- Choosing between raw Mantine `Table` and kit shells
- Placing **Sort…**, reorder arrows, or drag handles
- Naming page titles, back links, or remove vs delete actions

## Doc map

| Doc | Contents |
| --- | --- |
| This README | UI categories, decision tree, chrome conventions, specialised outliers |
| [lists-and-ordering.md](lists-and-ordering.md) | Roles A/B/C/D, `reorderMode` / `storedOrder`, permanent Sort…, gold references |
| [list-kit-roles.md](../../features/app-shell/list-kit-roles.md) | Surface → role inventory (tier 1 feature deep dive) |
| [data-table.md](../../features/app-shell/data-table.md) | DataTable props, list prefs, virtualisation |
| [display-conventions.md](../display-conventions.md) | Frequencies, bands, modes, icon sizes |
| [help writing styleguide](../writing-styleguide/help-writing-styleguide.md) | Operator-facing prose |

## Common UI categories

Name the job first, then pick a shell.

| Category | Job | Typical shell | Gold reference |
| --- | --- | --- | --- |
| **Entity inventory** | Browse / filter / open library or build entities | **A** — `DataTable` `variant="list"` | Library → Channels |
| **Extreme inventory** | Same look as A; very large N | **D** — `DataTable` `scale="extreme"` | Library → Contacts (digital) |
| **Agreed-order inventory** | List’s job is export / model order | **A** + `reorderMode` (+ arrows / Sort…) | Library → Zones |
| **Membership pair** | Curate ordered members of a container | **B** + **C** — `AvailableItemPicker` + `SelectedItemList` | Zones → Edit members |
| **Embedded inventory** | Compact table inside a form / wizard | **A** — `DataTable` `variant="embedded"` | Channel set preview; repeater results |
| **Entity form** | Create / edit one entity | `FormPage` + `PageSection` | Channel / zone editors |
| **List page chrome** | Title + intro + table | `ListPage` | Entity list routes |
| **Specialised** | Diff matrices, CPS spreadsheets, config grids | Keep custom — document why | Field-diff; export resolution; CPS CSV |

Do **not** invent a fifth list look-and-feel for ordinary inventory. Prefer kit shells.

## Decision tree (lists)

```text
Is this a membership of a container (zone, scan list, …)?
  yes → B (pool) + C (ordered members). Role C = reorder mode only.
  no ↓

Is cardinality extreme (contacts-scale, 10k+)?
  yes → D (DataTable scale="extreme", cheap cells).
  no ↓

Does the list’s agreed order mutate the model (zone order, memory slots)?
  yes → A + reorderMode (+ consumer arrows / Sort…). Not temporary column sorts.
  no ↓

Ordinary browse inventory?
  → A with column sorts + persisted prefs.

Diff / wire spreadsheet / one-off matrix?
  → Specialised (link from list-kit surface map; do not force DataTable).
```

Details and prop names: [lists-and-ordering.md](lists-and-ordering.md).

## Chrome conventions

### Permanent Sort…

| Rule | Detail |
| --- | --- |
| **Control** | `MembershipSortMenu` — confirm dialog; **rewrites** model order |
| **Label** | Name the noun: **Sort zones…**, **Sort channels…** — not bare **Sort…** when the entity is clear |
| **Placement (list pages)** | Left-aligned `Group` **above** the `DataTable` (see Zones list) |
| **Placement (membership C)** | `SelectedItemList` `toolbar` — rendered **above** the scroll body (same visual band as Zones list Sort) |
| **Not** | Temporary browse sort; do not invent per-page sort chrome |

Permanent Sort… is distinct from DataTable column headers (browse) and from `storedOrder` restore (hybrid browse).

### Remove from list vs delete entity

| Action | Icon | Style | When |
| --- | --- | --- | --- |
| **Remove from membership** | `IconTrash` | `ActionIcon` `subtle` / `red` / `sm`, size `ICON_SIZE_NAV` | Zone / scan member rows — leaves the entity in the library |
| **Delete entity** | `IconTrash` | Same ActionIcon styling via `EntityListDeleteAction` | Library list rows — deletes the entity (confirm flow) |

Prefer trash over `IconX` for membership remove so chrome matches entity lists. Aria / tooltip should say **Remove from …**, not **Delete**, when the entity survives.

### Labelling dense controls

- Compact gradient segments and similar controls still need a **visible label** when the meaning is not obvious from context alone (e.g. zone member **Include in scan list** on the **right** of the row).
- Prefer tooltips for extra detail; do not rely on tooltip-only for the primary meaning.

### Page titles and back links

- **Sentence case** for ordinary headings and buttons ([help writing styleguide](../writing-styleguide/help-writing-styleguide.md)).
- Established product terms may keep conventional capitals in titles (e.g. **Receive Group Lists**, **Edit Receive Group List**, **Back to Receive Group Lists**).
- Introduce app jargon in plain language in list/editor subtitles aimed at operators — not contributor field names (`Zone.order`, “reorder mode”).

### List page intro copy

Operator-facing: what the page does and how to use Sort / arrows / filters. Avoid schema and kit jargon. Lead with the outcome (“Zones appear on your radio in this order”).

### Filters and reorder

When a find-in-list or name filter is active, **disable reorder** (drag, arrows, permanent Sort when it would confuse filtered order). Tell the operator why (orange hint on Zones list; C `reorderDisabled` + hint text).

## Page shells

| Shell | Use |
| --- | --- |
| `ListPage` | Top-level entity inventories |
| `FormPage` | Entity create/edit; description slot often holds **← Back to …** |
| `PageSection` | Grouped blocks inside forms |
| Section nav | Per-area secondary nav — registry titles should match list page titles |

New reusable pieces under `src/app/components/` need a sidecar `.md` and preferably a `/styleguide` demo ([#199](https://github.com/pskillen/codeplug-studio/issues/199) pattern).

## Specialised outliers (keep specialised)

Do not force the list kit onto:

- Export resolution / inclusion matrices
- CPS CSV spreadsheet preview
- Field-diff update dialogs
- BrandMeister RX sync review
- OpenAIP nested checklists
- Band plan / summary count grids

Call them out in [list-kit-roles.md](../../features/app-shell/list-kit-roles.md) surface map when adding new ones.

## Layers

UI conventions live in `src/app/` and this reference. Do not push vendor CPS column names or radio caps into library CRUD — [AGENTS.md — Vendor boundaries](../../../AGENTS.md#vendor-boundaries).

## Related

- Interactive kit: `/styleguide`, `/styleguide/data-table`, `/styleguide/membership`, `/styleguide/layout`, `/styleguide/controls`
- App shell hub: [docs/features/app-shell/README.md](../../features/app-shell/README.md)
- Alerts colours: [alerts.md](../../features/app-shell/alerts.md)
