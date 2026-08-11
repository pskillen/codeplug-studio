---
name: debounced-inputs
description: >-
  Debounced text and number inputs in Codeplug Studio — committed+commit hooks,
  debounce intervals, blur flush, pending UI, and when to use filter-only or
  async debounce instead. Use when adding search fields, NumberInputs that
  persist to storage/URL, or fixing focus loss on per-keystroke save.
---

# Debounced inputs

## Default pattern (persisted values)

Use a **committed + commit hook** when input changes must **persist** (URL, `localStorage`, `putBuild`, IndexedDB) or trigger expensive work that must not run every keystroke.

| Input type | Hook | Path |
| --- | --- | --- |
| Text (name filter) | `useDebouncedNameFilter` | `src/app/hooks/useDebouncedNameFilter.ts` |
| Optional number (`NumberInput`) | `useDebouncedOptionalNumberField` | `src/app/hooks/useDebouncedOptionalNumberField.ts` |

Both share the same commit model:

1. **Local draft** updates immediately on `onChange` (`setNameFilter` / `setValue`).
2. **`useDebouncedValue`** (Mantine) settles after **`LIST_NAME_FILTER_DEBOUNCE_MS` (300)** from `src/integrations/listPrefs/constants.ts`.
3. **`isTypingRef` / `isEditingRef`** blocks external `committed` hydration while the user is editing.
4. **Commit** runs only when debounced draft ≠ committed and the user was editing.
5. **Number fields:** call **`flush()` on `onBlur`** so tab-away saves before debounce elapses.

### Wiring

```tsx
const { nameFilterInput, setNameFilter, nameFilterPending } = useDebouncedNameFilter(
  committedNameFilter,
  commitNameFilter,
);

<TextInput
  value={nameFilterInput}
  onChange={(e) => setNameFilter(e.currentTarget.value)}
  rightSection={nameFilterPending ? <Loader size={16} /> : undefined}
/>
```

```tsx
const field = useDebouncedOptionalNumberField(committedSeconds ?? undefined, onCommit);

<NumberInput value={field.value} onChange={field.setValue} onBlur={field.flush} />
```

### Do not

- Call `onPatch` / `putBuild` on every `onChange` for text or number fields.
- Set `disabled={saving}` on inputs that persist via debounce — it drops focus mid-edit.
- Sync local draft from `committed` when editing ends **before** `committed` updates (sync only when `!isTypingRef` and `committed` changes — the hooks handle this).
- Clear an `editingField` flag on blur and then `useEffect` reset from stale props (same bug class).

### Tests

Mirror `useDebouncedNameFilter.test.ts` / `useDebouncedOptionalNumberField.test.ts`: fake timers, assert no commit until debounce, assert `flush` before debounce, assert external hydrate does not clobber pending draft.

## When not to use the default

| Scenario | Approach | Example |
| --- | --- | --- |
| **Filter-only** (no persistence) | Inline `useDebouncedValue` on local state; debounced value drives filter | `WirePreviewDataTable`, Maidenhead channel autocomplete |
| **Debounced API fetch** | Inline debounce + `useEffect` with cancellation; custom ms per policy | `GeocodeCentreField` (400 ms), Nominatim (1/s) |

See [references/other-patterns.md](references/other-patterns.md) for file pointers.

## Consumers (default hooks)

- **Library list search:** `useChannelListQuery`, `useListNameQuery`, `ChannelsListPage` (Loader pending)
- **Build export settings:** `AtD890ScanListTimingFields`, `ExportAnytoneSettingsSections` (`maxNameLength`)

## Docs

Tier-1 data-table debounce note: `docs/features/app-shell/data-table.md` (300 ms, URL + localStorage commit schedule).
