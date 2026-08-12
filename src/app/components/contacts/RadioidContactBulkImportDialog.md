# RadioidContactBulkImportDialog

## Purpose

Confirmation and progress modal for bulk RadioID.net import into the **digital ID directory shadow store** — page, selection, or all paginated results.

## Props

| Prop                          | Type                            | Description                                                |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `opened`                      | `boolean`                       | Modal visibility                                           |
| `onClose`                     | `() => void`                    | Dismiss handler                                            |
| `onComplete`                  | `() => void`                    | Called after successful add/update (refresh directory IDs) |
| `scope`                       | `'page' \| 'selected' \| 'all'` | Import scope                                               |
| `listings`                    | `RadioidDmrUserListing[]`       | Rows for page/selected; current page hint for `all`        |
| `filters`                     | `RadioidSearchFilters`          | Active search filters (`all` re-fetches each page)         |
| `totalPages`                  | `number`                        | Result pagination                                          |
| `totalCount`                  | `number`                        | Total matches from RadioID.net                             |
| `projectId`                   | `string \| null`                | Active project                                             |
| `existingDirectoryDigitalIds` | `ReadonlySet<number>`           | Directory shadow IDs for duplicate detection               |

## Behaviour

1. **Confirm** — shows new vs existing directory counts; optional checkbox to update existing directory rows when RadioID.net metadata differs.
2. **Running** — progress bar, processed/total, add/update/skip counts, ETA; cancel stops after the current row.
3. **Done** — summary alert; partial save on cancel.

`scope: 'all'` fetches every results page via `runRadioidBulkImport` before saving to `digitalIdDirectory`. Library contacts are not written.

## Related

- [`radioidBulkImport.ts`](../../lib/radioidBulkImport.ts)
- [`RadioidContactSearch`](RadioidContactSearch.tsx)
