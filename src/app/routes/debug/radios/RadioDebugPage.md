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

A fresh LocalInfo flag read precedes END; a flag, failed read or cancellation refuses END and directs the operator to power-cycle. The check and END are not atomic, and firmware can divert vital reads. The current archive survives a failed or cancelled replacement. Captured ident model, band and protocol version and the full LocalInfo serial are shown without treating manifest claims as radio identity; firmware and mod remain unknown. The D890 Memory tab shows the read-only channel and zone viewer ([AtD890Memory](AtD890Memory.md)); its other sections are deferred.

The D890 Calibration tab renders `AtD890Calibration` over the current archive, keyed so a replaced archive re-renders from its own bytes. It selects only the live tune unit (`vital-tune-a` at `0x04F00000`, inspect-only, matching length, at most one unit), refuses malformed provenance, never falls back to tune B, and opens no transport. It shows provenance, traced fields with sources and confidence, index-axis charts with numeric tables, unknown ranges and paged raw hex. Other profiles without a decoder keep the unavailable state; the Mini keeps its own viewer. Field reference: [calibration.md](../../../../../docs/reference/radios/anytone/at-d890uv/calibration.md).

The DM-32UV profile (`dm-32uv` only; the RadioFoundry profile is unchanged) has a Backup Read radio control that runs the guarded read-only DM-32UV session and shows recovery copy: there is no END on this radio, a failed or cancelled read stops with no retry, and the radio leaves PROGRAM after about 2 seconds of silence. The archive keeps every read block (one `sparse-<address>` entry per contiguous run), the factory sector when both reads matched, the Backup calibration sidecars and the V-frame and discovery sidecars. Coverage lists every 4 KiB block of the stated configuration window as captured, discovered but not read, or not discovered, with its tag and live or duplicate calibration role, and the factory sector as a separate address space with no gap lines between spaces; a build Backup archive classifies the same way, with discovery shown as not recorded. Overview shows the captured PSEARCH model and V-frame replies as returned, the V01 base version labelled as not a mod discriminator, "None observed" for serial, the V02 chip UID labelled as not a serial, and "MM9PDY-compatible data present" only for a decodable location page. Running firmware and mod stay unknown. Calibration and Memory stay unavailable for this profile.

The RT95 Overview retains expected family, full archive serial, archive firmware, evidence and connection alongside PC ident [head] and clone channels/settings [unknown], whose status reflects programming-image coverage (missing, partial or captured). Its Calibration tab displays printable text alongside raw bytes for established text fields and the inspect-only EEPROM prefix [body], or Not captured for old archives; malformed calibration regions are refused. The head may return stale or zero bytes without a main-board reply.

RT95 and Mini retain live and opened captures in per-profile tab memory. The selected history entry drives the viewers; download all produces a reopenable history ZIP and clear removes the entries after confirmation. Navigation warns about undownloaded captures, which remain in the tab on Leave. Reload, close or process termination loses them. Both retention and ZIP generation consume memory.

D890 captures and opened archives use the shared tab-only history, including download-all and the navigation/reload guard. The selected capture drives all viewers; a second retained capture can be selected for comparison or calibration overlay. Clear removes the selections. The D890 comparison checks the acquisition sidecar against the stored regions, compares intersections across sparse boundaries, and keeps requested vital units separate. Missing or invalid claims refuse byte comparison; responding-unit verdicts are Same or Different only from explicit evidence in both archives, otherwise Unknown. Decoded field differences (slot-matched records, field-matched settings and calibration) are shown separately from byte and provenance divergence.

DM-32 stock/MM9PDY uses the shared in-tab history, including selection, download, ZIP reopening, confirmed clear and undownloaded-read warnings. History is lost on reload or tab/process termination and consumes memory. Sparse runs partitioned differently may be incomparable; calibration overlay and channel, zone and settings viewers and diffs remain unavailable.
