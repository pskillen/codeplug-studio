# RadioidContactBulkImportDialog

## Purpose

Confirmation and progress modal for bulk RadioID.net contact import — page, selection, or all paginated results.

## Props

| Prop         | Type                            | Description                                         |
| ------------ | ------------------------------- | --------------------------------------------------- |
| `opened`     | `boolean`                       | Modal visibility                                    |
| `onClose`    | `() => void`                    | Dismiss handler                                     |
| `onComplete` | `() => void`                    | Called after successful add/update (reload library) |
| `scope`      | `'page' \| 'selected' \| 'all'` | Import scope                                        |
| `listings`   | `RadioidDmrUserListing[]`       | Rows for page/selected; current page hint for `all` |
| `filters`    | `RadioidSearchFilters`          | Active search filters (`all` re-fetches each page)  |
| `totalPages` | `number`                        | Result pagination                                   |
| `totalCount` | `number`                        | Total matches from RadioID.net                      |
| `projectId`  | `string \| null`                | Active project                                      |
| `contacts`   | `DigitalContact[]`              | Library contacts for duplicate detection            |

## Behaviour

1. **Confirm** — shows new vs existing counts; optional checkbox to update existing library contacts (all changed metadata fields).
2. **Running** — progress bar, processed/total, add/update/skip counts, ETA; cancel stops after the current row.
3. **Done** — summary alert; partial save on cancel.

`scope: 'all'` fetches every results page via `runRadioidBulkImport` before saving.

## Related

- [`radioidBulkImport.ts`](../../lib/radioidBulkImport.ts)
- [`RadioidContactSearch`](RadioidContactSearch.tsx)
