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

- Filter form: DMR ID, callsign (begins-with), city, state, country.
- Results `DataTable` with row selection and per-row **Add** / **Open** (when `digitalId` already in library).
- Bulk **Add selected** in form footer when rows are checked.
- Duplicate gate matches on `digitalId` only.
- Session cache and rate-limit cooldown via `@integrations/radioid` client.

## Related

- [contact directories](../../../docs/features/contact-directories/README.md)
- [radioid reference](../../../docs/reference/radioid/README.md)
