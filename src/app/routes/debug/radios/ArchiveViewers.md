# Archive viewers

## Purpose

Inspect captured archive regions in bounded pages and compare two local archives without sending radio commands.

## Props

| Component       | Props                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HexViewer`     | Optional `archive` capture.                                                                                                                              |
| `MemoryViewer`  | Optional `archive` capture.                                                                                                                              |
| `CompareViewer` | Optional capture A as `archive`, optional controlled capture B as `other`, and the selected profile's `modelId` for opening capture B when uncontrolled. |

## Usage

The gated radio debug page mounts these panels within its tabs.

## Behaviour

Hex displays at most 256 bytes of one captured region per page. Memory uses the RT95 viewer for clone slots and all registered settings from captured bytes. It does not infer callsigns or library relationships. Compare refuses regions whose address space or representation is not known; the RT95 programming image is defined by the existing radio adapter. It reports missing bytes as incomparable and shows decoded channel name and setting changes when both summaries exist. Archives can contain sensitive data and remain in the browser. Hex and Compare mask password bytes the radio's integration module marks (RT95: `debugSensitive.ts`) as `••` until **Show password** (`SensitiveRevealButton`, `aria-pressed`) is pressed; `useSensitiveReveal` resets to hidden when the archive changes. Coverage computes SHA-256 per region and reports known RT95 missing ranges; other maps are unknown.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)

RT95 calibration is shown in the Calibration tab as main-body [body] evidence relayed through the head; PC ident is [head] and clone data [unknown]. Coverage lists captured prefix and missing tail separately. Hex rows and Compare summaries and byte rows label each RT95 region with its provenance; decoded changes are [unknown]. Missing bytes are incomparable. Overview reports programming-image coverage as missing, partial or captured, and retains archive identity, evidence and connection rows. Established calibration text fields show printable ASCII beside their raw bytes, with non-printable bytes represented by dots.

The shared RT95 history supplies the selected capture and a second entry to Compare; unknown representations and missing bytes remain incomparable. Optional calibration and decoded-difference components use captured fields only; RT95 correction charts draw the selected read solid and the overlay dashed.

RT95 Memory also mounts [Rt95Memory](Rt95Memory.md) for guarded MMD1 zones, state and P-key inspection. MMD1 is a separate inspect-only body region; guard probes and outcome are checked on reopening. Hex and comparison recognise its validated region metadata.

The [D890 comparison](AtD890Compare.md) checks its acquisition sidecar and keeps sparse and requested vital address spaces separate.

DM-32 comparison classifies configuration and factory-sector address spaces independently. It compares matching region IDs and offsets only; missing bytes and differently partitioned sparse runs remain incomparable. Decoded evidence comes from captured bytes, with unavailable values kept distinct from unchanged values.
