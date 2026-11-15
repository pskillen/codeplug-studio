# RadioDebugPage

## Purpose

Displays a selected radio profile and allows inspection of compatible offline backup archives.

## Props

None. The route supplies the profile slug.

## Usage

Mounted beneath the debug gate at `/debug/radios/:radio`.

## Behaviour

Shows archive identity evidence without treating the selected family as proof of firmware. Backup lists captured ranges, SHA-256 hashes and known RT95 missing ranges; unknown spaces and maps are identified as such. Hex pages through bounded region bytes. A complete RT95 programming image supplies channel slots and settings to Memory. Compare refuses regions whose address space or representation cannot be established and shows RT95 byte and decoded changes. Other session hydration, memory relationships and trace are unavailable. Invalid files leave the current capture intact. RT95 and UV-5R Mini live reads use frame allow-lists. Mini coverage maps packed backup MEM offsets to clone addresses; live captures retain decoded and wire bytes and handshake replies. Only a validated live format-2 report supplies compatible firmware evidence. Unknown slugs show a not-found message.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)

The Mini profile also shows decoded span hashes, F/M replies, labelled wire and decoded hex, tab-local read history, calibration for complete reads, channel and zone inspection, and comparisons. History labels distinguish live and file reads. A successful live read becomes the calibration selection and the second comparison read. It accepts the legacy multi-read ZIP; the old route remains available while parity is verified.
