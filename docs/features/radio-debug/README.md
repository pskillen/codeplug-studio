# Radio debug

**Status:** In progress · **Tracking:** https://github.com/pskillen/codeplug-studio/issues/1692

The Debug hierarchy groups radio profiles, browser storage and serial transport tools. Debug pages are gated on production by developer mode. The selected radio profile is an expectation; it does not identify the connected radio or its firmware.

## Documentation map

- [Radio shell](../../../src/app/routes/debug/radios/RadioDebugPage.md)
- [Debug index and routes](../../../src/app/routes/debug/debugRoutes.tsx)

## Behaviour

The radio profile shells can open compatible radio-backup ZIPs without a library or build. The Backup tab lists the archive’s named ranges and sidecars and can download the original archive. Gaps between listed numeric ranges are unclassified because entries may use different address spaces; the archive does not establish completeness outside its entries. An invalid or incompatible file leaves the current archive in place. Archive identity fields are reported as archive evidence, not live radio identity. The RT95 profile can make a live read using the existing Backup reader behind a read-only frame allow-list; the resulting archive stays in the tab until downloaded. The RT95 programming-image range is classified against its known clone map and a complete image has a channel summary. Other live capture adapters, calibration, memory and other viewer tabs remain unavailable. The existing UV-5R Mini read and AT-D890UV erase-unit probe remain separate tools; the latter can write during erase passes. IndexedDB inspection is read-only; local storage permits deleting individual keys. Serial reopen sends test bytes and requires a cable without a radio attached. Legacy storage and transport links redirect to the new hierarchy, retaining path parameters, query and hash.

## Known gaps

- Live capture for AT-D890UV awaits guarded session termination; other profiles await read-only adapter verification. Coverage classifications and decoded summaries are incomplete; viewers remain unavailable.
