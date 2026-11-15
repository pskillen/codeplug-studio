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

The AT-D890UV Backup control starts a guarded read-only session. Sparse configuration runs and separately requested, twice-compared vital units are packed without filling gaps, together with raw ident and comparison metadata. Coverage distinguishes virtual-map gaps, expected spans, out-of-map and unclassified entries, and the four vital requests; overlapping vital reads retain separate provenance. Tune B is as returned, not an independent physical copy. Reopening the archive shows the same captured evidence and region hashes.

A fresh LocalInfo flag read precedes END; a flag, failed read or cancellation refuses END and directs the operator to power-cycle. The check and END are not atomic, and firmware can divert vital reads. The current archive survives a failed or cancelled replacement. Captured ident model, band and protocol version and the full LocalInfo serial are shown without treating manifest claims as radio identity; firmware and mod remain unknown. D890 calibration and memory decoding are unavailable.
