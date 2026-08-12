# Lists and ordering

Deep dive for list kit roles and export / membership ordering. Hub: [README.md](README.md). Surface inventory: [list-kit-roles.md](../../features/app-shell/list-kit-roles.md). Props detail: [data-table.md](../../features/app-shell/data-table.md).

## Roles at a glance

| Role  | Name              | Shell                         | Cardinality        | Mutates agreed order?                     |
| ----- | ----------------- | ----------------------------- | ------------------ | ----------------------------------------- |
| **A** | Entity list       | `DataTable`                   | Hundreds–thousands | Only if `reorderMode` + consumer controls |
| **B** | Member picker     | `AddMembersScreen` / pool rows | High (pool)        | No — stages adds only                     |
| **C** | Membership list   | `MembershipPanel` + `MembershipRow` | Typically &lt;100  | Yes — drag / move / permanent Sort…       |
| **D** | Extreme inventory | `DataTable` `scale="extreme"` | Up to ~200k        | Same as A; prefer cheap cells             |

```text
B  Member picker  ──add──►  C  Membership list
A  Entity list
D  Extreme inventory (A’s face, harder guts)
```

Gold references: Channels (A), Zone member editor (Membership B+C), digital Contacts (D), Zones list (A + `reorderMode`), Build → Zones → Members tab (C with per-row arrows).

**Holdout:** `ZoneMemberOrderSection` still uses v1 `SelectedItemList` for wire-order override reorder ([#1097](https://github.com/pskillen/codeplug-studio/issues/1097)).

## Ordering toolkit

Prefer these names in code and docs.

| Tool                                  | Where                                                                                   | Mutates model?  | Use when                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| **`reorderMode`** (alias `orderMode`) | `DataTable`                                                                             | No by itself    | List’s **only** job is agreed/export order (Zones; wire preview when order arrows present)        |
| **Arrows / Move**                     | Consumer column or C builtins                                                           | Yes             | Reorder one step; disable while filter active                                                     |
| **Per-row arrows (C)**                | `onMoveItem` + `SelectedItemRowMoveButtons`                                             | Yes             | Role C when selection Move alone is easy to miss (e.g. build zone Members)                        |
| **Drag**                              | C `MembershipRow` drag handle (`SelectedItemDragHandle`); A `bulkReorder` + drag handle in Order column | Yes             | Membership lists; large export-order DataTables (`bulkReorder`); `reorderDisabled` while filtered |
| **`MembershipSortMenu`**              | Above list / C toolbar                                                                  | Yes (confirm)   | Permanent rewrite by name / callsign / …; flat-memory also **Sort selection…** (selected only)    |
| **`ExportOrderSelectMenu`**           | Flat-memory Channels toolbar (beside Sort…)                                             | No              | Toggle-select by band / FM·AM / simplex·split before drag, Move, or Sort selection…               |
| **`CopyOrderFromBuildMenu`**          | Flat-memory Channels toolbar (beside Select…)                                           | Yes (confirm)   | Copy memory order from another same-project `FlatMemoryList` build by library channel UUID        |
| **`bulkReorder`**                     | `DataTable`                                                                             | Yes             | Multi-select + drag + toolbar Move for large `reorderMode` lists                                  |
| **`storedOrder`**                     | `DataTable`                                                                             | No — display    | Hybrid: temporary natural sorts + **Return to export order**                                      |
| **Reset to library order**            | Wire preview banner                                                                     | Yes (confirm)   | Clear build `orderOrSlot` / zone member layout hint — **not** `storedOrder` restore               |
| **Column sorts**                      | `DataTable` browse                                                                      | No — prefs only | Ordinary A lists without agreed order                                                             |

### Rules

1. **Agreed-order lists stay in reorder mode.** Zones, role C membership, wire member order → not temporary column sorts as the primary UX.
2. **Role C has no temporary display sort.** Only reorder + permanent Sort….
3. **Do not invent per-page sort chrome.** Use kit props and `MembershipSortMenu`.
4. **Filter disables reorder.** Clear messaging when arrows / drag / Sort / Copy order from… are blocked.
5. **Role A bulk reorder** — `DataTable` `bulkReorder` for large export-order lists (~100+ rows): checkboxes, drag handles in the Order column, toolbar **Move up/down** (Alt+↑/↓). Disables virtual tbody. Gold: flat-memory Channels; also build Zones.
6. **Sort selection…** — With ≥2 rows selected on flat-memory Channels, sort only the selection. Split islands **collate** into one contiguous block at the **earliest selected** index; unselected rows between islands close up (relative order preserved); then the chosen Sort criteria apply within the block. Full-list **Sort channels…** remains available.
7. **Copy order from…** — Flat-memory Channels only (label provisional). Pick another same-project `FlatMemoryList` build; matched library channels follow that build’s memory order; unmatched channels on this build append in prior relative order; confirm shows match/unmatch counts; densifies `orderOrSlot` to `1…n` ([#739](https://github.com/pskillen/codeplug-studio/issues/739)).
8. **Build order reset ≠ browse restore.** Clearing `orderOrSlot` / member layout hints is permanent (confirm). DataTable **Return to export order** only undoes temporary column sorts.
9. **Nested projection chrome** (Channels wire preview) uses `getRowClassName` + indented name cells — not card Accordion lists.
10. **Role C may combine** drag, toolbar **Move up/down** (selection), and **per-row arrows** (`onMoveItem`). Gold: Build → Zones → Members export order.

### Mental model

```text
reorderMode / C drag / Sort… / Sort selection… / Copy order from…  →  mutate Zone.order / membership arrays / orderOrSlot
Reset to library order        →  clear build order overrides (confirm; permanent)
storedOrder + restore         →  UI-only browse, then return to export order
column sorts                  →  persisted prefs, no model rewrite
```

## DataTable variants (role A / D)

| Prop / pattern       | When                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `variant="list"`     | Full library / build list pages                                                                                                         |
| `variant="embedded"` | Inside forms, wizards, import pickers                                                                                                   |
| `scale="extreme"`    | Digital contacts (D) — virtualise-first, cheap cells                                                                                    |
| `selectable`         | Multi-select when every row is eligible; implied by `bulkReorder` (reorderable rows only)                                               |
| Custom select column | When some rows must not be selectable (e.g. existing repeater matches)                                                                  |
| `toolbar`            | Actions **below** the table (bulk footers). Permanent Sort… on list pages is usually a **sibling Group above** the table, not this slot |

Name column: linked identity. Trailing actions: delete via `EntityListDeleteAction` / channel cascade delete.

## Membership (B + C)

| Piece                     | Pattern                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **C title / description** | “In this zone”, count + “export order”                                                                              |
| **C filter**              | Find-in-list only; disables drag when non-empty                                                                     |
| **C toolbar**             | **Sort channels…** (or equivalent) above the list body                                                              |
| **C builtins**            | `onMoveSelected`, `onRemoveSelected`, `canMove*`, Alt+↑/↓                                                           |
| **C per-row arrows**      | `onMoveItem` + `SelectedItemRowMoveButtons` in `renderItem` (optional; gold: build zone Members)                    |
| **C drag**                | `onReorder` + `SelectedItemDragHandle` in `renderItem`                                                              |
| **B**                     | Sparse rows; multi-select → add; no reorder of candidates                                                           |
| **Pair layout**           | Vertical stack: C then B (Zones / Scan / Receive Group Lists) — preferred over side-by-side dual lists for new work |

Gold: Zones → Edit, Scan list edit, Receive Group List edit (`RxGroupListMemberPicker`); Build → Zones → Members for per-row arrows.

## Naming catalogue

| Control / concept              | Canonical label / name                                   | Notes                                     |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| Permanent membership sort      | **Sort channels…** / **Sort zones…** / **Sort members…** | Ellipsis; confirm overwrites order        |
| Copy flat-memory order         | **Copy order from…** (provisional)                       | Flat-memory Channels; confirm; UUID match |
| Zones list intro               | Operator-facing order explanation                        | No `Zone.order` in UI copy                |
| Include-in-scan on zone member | **Include in scan list**                                 | Labelled; prefer RHS of row               |
| Membership remove              | Tooltip **Remove from zone** (etc.)                      | Trash icon                                |
| Entity delete                  | **Delete …** via list action                             | Same trash chrome; different semantics    |
| Receive Group Lists            | Full phrase in titles / nav                              | Not “RX group lists” in page chrome       |
| Reorder disabled hint          | Plain language                                           | “Clear filter to drag-reorder”            |

## Checklist for a new list surface

1. Map the surface in [list-kit-roles.md](../../features/app-shell/list-kit-roles.md) (A/B/C/D/specialised).
2. Pick shell from the [decision tree](README.md#decision-tree-lists).
3. If agreed order: `reorderMode` or C reorder — not browse sorts as primary.
4. If permanent Sort…: named label + placement above the list; confirm dialog.
5. Operator intro copy per [help writing styleguide](../writing-styleguide/help-writing-styleguide.md).
6. Prefer kit over raw Mantine `Table` unless specialised.
7. Sidecar + `/styleguide` demo when adding reusable chrome.

## Related code

| Symbol                       | Path                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `DataTable`                  | `src/app/components/v2/DataTable.tsx`                  |
| `AddMembersScreen`           | `src/app/components/v2/AddMembersScreen.tsx`           |
| `MembershipPanel`            | `src/app/components/v2/MembershipPanel.tsx`            |
| `MembershipRow`              | `src/app/components/v2/MembershipRow.tsx`              |
| `SelectedItemList`           | `src/app/components/ui/SelectedItemList.tsx` (holdout) |
| `SelectedItemDragHandle`     | `src/app/components/v2/SelectedItemDragHandle.tsx`     |
| `SelectedItemRowMoveButtons` | `src/app/components/ui/SelectedItemRowMoveButtons.tsx` |
| `MembershipSortMenu`         | `src/app/components/library/MembershipSortMenu.tsx`    |
| List prefs                   | `src/integrations/listPrefs/`                          |
