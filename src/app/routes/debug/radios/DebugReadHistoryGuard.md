# DebugReadHistoryGuard

## Purpose

Warn before leaving a radio debug page with undownloaded reads in that radio’s shared tab history, and before reloading or closing a tab that still has any undownloaded reads.

## Props

None. Mount once inside a data router under AppLayout.

## Behaviour

One guarded entry per descriptor with `readHistory`: the store is `getDebugReadHistory(descriptor)` and coverage is every path under `/debug/radios/<radio>/…`, the bare `/debug/radios/<radio>` redirect path, and any path listed in `alsoGuards` on the descriptor (for example the legacy Mini page). Leaving the radio means the next path is not covered by any entry for that hardware key; switching between firmwares of the same radio is not blocked. `NavigationGuard` blocks only when the current path is covered by an entry that still has undownloaded reads and the next path is not. Stay cancels navigation; Leave retains all entries and their download state in tab memory. Browser reload and close use the native warning. History is not persisted. The guard names no radio literals; matchers come from descriptors only.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md)
