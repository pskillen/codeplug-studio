# RadioDebugPage

## Purpose

Displays a selected radio profile and its currently unavailable diagnostic capabilities.

## Props

None. The route supplies the profile slug.

## Usage

Mounted beneath the debug gate at `/debug/radios/:radio`.

## Behaviour

Shows unknown observed identity and a disconnected state; the selected family is not evidence of firmware. Tabs explain unavailable capabilities. Unknown slugs show a not-found message.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
