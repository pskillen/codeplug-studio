# Radio debug

**Status:** In progress · **Tracking:** https://github.com/pskillen/codeplug-studio/issues/1692

The Debug hierarchy groups radio profiles, browser storage and serial transport tools. Debug pages are gated on production by developer mode. The selected radio profile is an expectation; it does not identify the connected radio or its firmware.

## Documentation map

- [Radio shell](../../../src/app/routes/debug/radios/RadioDebugPage.md)
- [Debug index and routes](../../../src/app/routes/debug/debugRoutes.tsx)

## Behaviour

The radio profile shells do not connect or read radios yet. Backup, calibration, memory and other tabs are unavailable placeholders. The existing UV-5R Mini read and AT-D890UV erase-unit probe remain separate tools; the latter can write during erase passes. IndexedDB inspection is read-only; local storage permits deleting individual keys. Serial reopen sends test bytes and requires a cable without a radio attached. Legacy storage and transport links redirect to the new hierarchy, retaining path parameters, query and hash.

## Known gaps

- Radio debug adapters, captures and viewers are not yet available in the new shells.
