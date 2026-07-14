# RadioidContactSearch

## Purpose

Search UI for importing DMR private contacts from RadioID.net into the vendor-neutral library.

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
- Results `DataTable` with row selection; bulk actions above the table open `RadioidContactBulkImportDialog`:
  - **Add all results** — fetches every paginated page from RadioID.net
  - **Add this page** — current page only
  - **Add selected** — checked rows only
- Bulk modal: confirm counts, optional **update existing** checkbox, progress bar with ETA, cancel mid-run.
- Per row: **Add** for new contacts; **Update** opens `RadioidContactUpdateDialog` when `digitalId` already exists.
- Callsign and DMR ID links open `RadioidContactPreviewDialog` (view-only library record) so search results are preserved.
- Preview modal: **Update from RadioID.net**, **Open in editor** (warns that search will be lost).
- Duplicate gate matches on `digitalId` only.
- Session cache and rate-limit cooldown via `@integrations/radioid` client.

## Related

- [contact directories](../../../docs/features/contact-directories/README.md)
- [radioid reference](../../../docs/reference/radioid/README.md)
- [`RadioidContactBulkImportDialog`](RadioidContactBulkImportDialog.tsx)
- [`RadioidContactPreviewDialog`](RadioidContactPreviewDialog.tsx)
- [`RadioidContactUpdateDialog`](RadioidContactUpdateDialog.tsx)
- [`RadioidContactVerifyPanel`](RadioidContactVerifyPanel.tsx) — digital contact editor
