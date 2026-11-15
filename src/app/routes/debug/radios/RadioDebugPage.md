# RadioDebugPage

## Purpose

Displays a selected radio profile and allows inspection of compatible offline backup archives.

## Props

None. The route supplies the profile slug.

## Usage

Mounted beneath the debug gate at `/debug/radios/:radio`.

## Behaviour

Shows a disconnected state and archive identity evidence when available; the selected family is not evidence of firmware. The Backup tab lists actual archive regions and unclassified numeric gaps, retains sidecars and downloads the original ZIP. Invalid or incompatible files leave the current archive intact. RT95 supports a live read through a frame allow-list and shows a channel summary when its programming image is complete. Other live captures and viewer tabs are unavailable. Unknown slugs show a not-found message.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
