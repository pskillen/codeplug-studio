# DebugReadHistoryGuard

## Purpose

Warn before leaving RT95 or Mini with undownloaded reads, and before reloading or closing a tab containing any undownloaded shared history.

## Props

None. Mount once inside a data router under AppLayout.

## Behaviour

Stay cancels navigation; Leave retains all entries and their download state in tab memory. Browser reload and close use the native warning. History is not persisted.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
