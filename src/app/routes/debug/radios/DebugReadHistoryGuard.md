# DebugReadHistoryGuard

## Purpose

Warn before leaving the RT95, Mini, AT-D890UV, DM-32UV, DM-1701 (OpenGD77) or MD-9600 (OpenGD77) page with undownloaded reads, and before reloading or closing a tab containing any undownloaded shared history.

## Props

None. Mount once inside a data router under AppLayout.

## Behaviour

Stay cancels navigation; Leave retains all entries and their download state in tab memory. Browser reload and close use the native warning. History is not persisted. The guarded routes are a constant list of store and route matcher pairs; the OpenGD77 entries come from the descriptors that set `readHistory`.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
