# DataTable virtualization (#381) — progress

**Tracking:** [#381](https://github.com/pskillen/codeplug-studio/issues/381)  
**Branch:** `381/pskil/datatable-virtualization`

## Status

| Slice | Status | Notes |
| --- | --- | --- |
| Dependency + spike | Complete | `@tanstack/react-virtual`; Mantine `ScrollArea` viewport as scroll parent |
| Virtual `DataTable` body | Complete | `virtualize: 'auto'` threshold 75; unit tests + styleguide 250-row demo |
| Reference count index | Complete | `buildReferenceCountIndex` — contacts + RX group list tables |
| Contacts QA | Complete (automated) | Unit/build CI green; manual matrix below for operator verify on dev |
| Rollout smoke | Complete (automated) | Existing `WirePreviewDataTable.test.tsx` + list route tests pass |
| Documentation | Complete | `data-table.md`, `DataTable.md` sidecar, this file |

## Shipped code

| Symbol | Path |
| --- | --- |
| `DataTable` virtual props | `src/app/components/ui/DataTable.tsx` |
| `useVirtualDataTableRows` | `src/app/lib/dataTable/useVirtualDataTableRows.ts` |
| `VIRTUAL_ROW_THRESHOLD` (75) | `src/app/lib/dataTable/virtualization.ts` |
| `buildReferenceCountIndex` | `src/app/lib/listReferences.ts` |

## Manual verify (operator)

1. **Library → Contacts** — import or seed 500+ digital contacts; filter `dq`, sort by name/ID/channels-using; scroll; delete on a visible row.
2. **Build → Contacts** — build with 200+ contact selections; scroll, filter, row activate → override modal, persist, reload.
3. **Styleguide** — `/styleguide` → **DataTable — large virtual list** — scroll; sticky header stays visible.
4. **Library → Channels** — select all + bulk toolbar action still works below threshold and above (if enough channels).
5. **Build → Zones** — export scan list `Switch` on a visible row (wire preview controls).

## Rollout checklist (auto-inherit `virtualize: 'auto'`)

| Route | Verified |
| --- | --- |
| `/library/channels` | Unit tests; manual bulk select on dev |
| `/library/zones` | Auto virtual when ≥75 zones |
| `/library/talk-groups`, `/library/rx-group-lists`, `/library/scan-lists` | Auto virtual |
| `/builds/:id/*` wire lists | `WirePreviewDataTable` tests |
| `/library/contacts/add-from-radioid` | Embedded variant; virtual off below threshold |
| Debug list pages | Small N — full render |

## Next

Open PR `Closes #381`; push to `dev` for operator QA on deployed build.
