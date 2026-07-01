# Component tests

**Status: planned** — React Testing Library patterns documented here for when `src/app/**/*.test.tsx` coverage grows beyond the current thin state layer tests.

**Purpose:** Prove UI wiring — form validation messages, modal confirm/cancel, mode-specific field visibility, navigation badges — without asserting CPS byte equality (that belongs in [mapping-tests.md](mapping-tests.md)).

## Convention (target)

- File name: `<Component>.test.tsx` beside the component or under `src/app/`.
- Runner: Vitest + `@testing-library/react`.
- Environment: `jsdom` via [`vite.config.ts`](../../../vite.config.ts).

## Provider wrapping

App components typically need:

- Mantine `MantineProvider`
- Project/library context from `src/app/state/`
- `MemoryRouter` with `basename: '/codeplug-studio/'` when routes matter

Extract a shared `renderWithProviders()` helper when the second component test lands.

## What to test

| Area                 | Example                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| Library CRUD forms   | Analog vs DMR field visibility per [channel-modes.md](../../reference/channel-modes.md) |
| Import preview panel | Warning list, merge vs replace copy                                                     |
| Summary page         | Counts render from mocked `summariseLibrary` result                                     |
| Repeater search      | Mode pills, add-to-library disabled states                                              |

## What not to test here

- CSV parse edge cases → [unit.md](unit.md) beside parsers
- Full import → export file diff → [mapping-tests.md](mapping-tests.md)
- Real file picker / download → [e2e.md](e2e.md)

## Related

- [Testing hub](README.md)
- [System tests](system.md)
- [app-shell feature](../../features/app-shell/README.md)
