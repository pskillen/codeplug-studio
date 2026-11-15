# Archive viewers

## Purpose

Inspect captured archive regions in bounded pages and compare two local archives without sending radio commands.

## Props

| Component       | Props                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| `HexViewer`     | Optional `archive` capture.                                                                  |
| `MemoryViewer`  | Optional `archive` capture.                                                                  |
| `CompareViewer` | Optional capture A as `archive`, and the selected profile's `modelId` for opening capture B. |

## Usage

The gated radio debug page mounts these panels within its tabs.

## Behaviour

Hex displays at most 256 bytes of one captured region per page. Memory uses the RT95 clone summary for channel slots and settings when the complete programming image is present. The summary does not expose callsigns or relationships. Compare refuses regions whose address space or representation is not known; the RT95 programming image is defined by the existing radio adapter. It reports missing bytes as incomparable and shows decoded channel name and setting changes when both summaries exist. Archives can contain sensitive data and remain in the browser. Coverage computes SHA-256 per region and reports known RT95 missing ranges; other maps are unknown.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
