# RadioidContactSearch

## Purpose

Search UI for importing DMR IDs from RadioID.net into the local **digital ID directory shadow store**.

## Props

None — reads active project and library from app state.

## Usage

```tsx
import RadioidContactSearch from '@app/components/contacts/RadioidContactSearch.tsx';

export default function AddFromRadioidPage() {
  return <RadioidContactSearch />;
}
```

## Behaviour

- Filter form (broad → narrow): country autocomplete (RepeaterBook country list), state, city, callsign, DMR ID.
- **Entire database** — streams RadioID.net daily `user.csv` dump into the directory shadow (~300,000+ rows; checkbox confirm, progress, cancel). Does not use paginated JSON search.
- Results `DataTable` with row selection; bulk actions above the table open `RadioidContactBulkImportDialog`:
  - **Import all results** — fetches every paginated page from RadioID.net into the directory shadow
  - **Import this page** — current page only
  - **Import selected** — checked rows only
- Bulk modal: confirm directory counts, optional **update existing** checkbox, progress bar with ETA, cancel mid-run.
- Per row: **Add** saves a new directory row; **In directory** when the ID is already staged; **Update** opens `RadioidContactUpdateDialog` when the ID exists as a **library** contact.
- Duplicate dimming looks up **only the current result-page IDs** (`getDigitalIdDirectoryEntriesByIds`). It must not hydrate the full shadow store.
- Callsign and DMR ID links open `RadioidContactPreviewDialog` (view-only library record) so search results are preserved.
- Preview modal: **Update from RadioID.net**, **Open in editor** (warns that search will be lost).
- Bulk duplicate gate matches on directory `digitalId`; library preview/update still uses library contacts.
- Session cache and rate-limit cooldown via `@integrations/radioid` client.

## Related

- [contact directories](../../../docs/features/contact-directories/README.md)
- [radioid reference](../../../docs/reference/remote-directories/radioid/README.md)
- [`RadioidContactBulkImportDialog`](RadioidContactBulkImportDialog.tsx)
- [`RadioidEntireDatabaseImportDialog`](RadioidEntireDatabaseImportDialog.tsx)
- [`RadioidContactPreviewDialog`](RadioidContactPreviewDialog.tsx)
- [`RadioidContactUpdateDialog`](RadioidContactUpdateDialog.tsx)
- [`RadioidContactVerifyPanel`](RadioidContactVerifyPanel.tsx) — digital contact editor
