# Radio debug

**Status:** In progress · **Tracking:** https://github.com/pskillen/codeplug-studio/issues/1692

The Debug hierarchy groups radio profiles, browser storage and serial transport tools. Debug pages are gated on production by developer mode. The selected radio profile is an expectation; it does not identify the connected radio or its firmware.

## Documentation map

- [Radio shell](../../../src/app/routes/debug/radios/RadioDebugPage.md)
- [Archive viewers](../../../src/app/routes/debug/radios/ArchiveViewers.md)
- [Debug index and routes](../../../src/app/routes/debug/debugRoutes.tsx)

## Behaviour

The radio profile shells can open compatible radio-backup ZIPs without a library or build. The Backup tab lists the archive’s named ranges and sidecars and can download the original archive. Gaps between listed numeric ranges are unclassified because entries may use different address spaces; the archive does not establish completeness outside its entries. An invalid or incompatible file leaves the current archive in place. Archive identity fields are reported as archive evidence, not live radio identity. The RT95 profile can make a live read using the existing Backup reader behind a read-only frame allow-list; the resulting archive stays in the tab until downloaded. The RT95 programming-image range is classified against its known clone map and a complete image has a channel summary. Coverage shows SHA-256 hashes for captured regions and classifies the RT95 programming image against its known map. Other address spaces remain unclassified. The Hex tab pages through captured regions. Memory shows RT95 channel slots and settings when a complete programming image is available. Compare opens a second archive and compares RT95 programming image bytes and decoded channel names and settings; regions with unknown address space or representation are incomparable, as are missing bytes. Trace export, other live capture adapters and calibration remain unavailable. The existing UV-5R Mini read and AT-D890UV erase-unit probe remain separate tools; the latter can write during erase passes. IndexedDB inspection is read-only; local storage permits deleting individual keys. Serial reopen sends test bytes and requires a cable without a radio attached. Legacy storage and transport links redirect to the new hierarchy, retaining path parameters, query and hash.

## Known gaps

- Live capture for AT-D890UV awaits guarded session termination; other profiles await read-only adapter verification. Coverage classifications and decoded inventories for other radios await their capture and hydration adapters. The current clone summary does not provide callsigns or zone membership relationships.

The UV-5R Mini profile can also capture the clone address space through the guarded read-only session. Its archive stores decoded clone bytes and preserves wire bytes and F/M replies as sidecars. The clone address space is not a physical flash or firmware dump. Ordinary Mini backup MEM entries use packed offsets; coverage maps these to their radio addresses and preserves a separate zones entry. Calibration is only captured when its actual range is present. A validated live format-2 MM9R report is compatible report evidence; an absent, invalid or unsupported report, and an archive without live provenance, leave firmware identity unknown. The legacy Mini debug page remains available for its existing viewers.
