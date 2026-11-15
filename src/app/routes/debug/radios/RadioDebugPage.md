# RadioDebugPage

## Purpose

Displays a selected radio profile and allows inspection of compatible offline backup archives.

## Props

None. The route supplies the profile slug.

## Usage

Mounted beneath the debug gate at `/debug/radios/:radio`.

## Behaviour

Shows archive identity evidence without treating the selected family as proof of firmware. Backup lists captured ranges, SHA-256 hashes and known RT95 missing ranges; unknown spaces and maps are identified as such. Hex pages through bounded region bytes. A complete RT95 programming image supplies channel slots and settings to Memory. Compare refuses regions whose address space or representation cannot be established and shows RT95 byte and decoded changes. Other session hydration, memory relationships and trace are unavailable. Invalid files leave the current capture intact. RT95 live read uses a frame allow-list. Unknown slugs show a not-found message.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
