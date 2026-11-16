# MemoryCategories

## Purpose

The category picker of every radio's debug Memory view: one **Category** dropdown plus only the selected panel. It replaces the row of inner tabs, which did not fit on a phone for radios with six or seven categories.

## Props

| Prop         | Meaning                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `categories` | `{ value, label, count?, render }[]`. `render` is called only for the selected category. `count`, when given, shows as `Label (N)`                                                   |
| `notDecoded` | Category names the radio does not decode yet; one dimmed line under the dropdown: "Not decoded for this radio yet: scan lists, contacts." Nothing shown for an empty or missing list |
| `storageKey` | `localStorage` key suffix (the app prefix is added) under which the last choice is remembered; omit to remember nothing                                                              |

## Behaviour

- The first category shows by default; a remembered value that is no longer in the list falls back to the first.
- The choice is remembered per radio through the caller's `storageKey` (the keys start `debug-memory-category:`; the component adds the app's `mm9pdy-codeplug-studio.` prefix, so the stored key is `mm9pdy-codeplug-studio.debug-memory-category:<radio>`). Storage reads and writes are wrapped in try/catch, so the picker works with storage blocked.
- Switching category unmounts the previous panel, so search, sort and selection inside a panel reset, as the inner tabs did with `keepMounted={false}`.
- No radio knowledge lives here; each radio's Memory component supplies its categories and key.
- Tests choose a category with `chooseCategory` (`memoryCategoriesTestUtils.ts`); `src/test/setup.dom.ts` clears the remembered choice between tests.
- The component lives in the debug kit (`src/app/components/debug/`); per-category content is built with [MemoryCategoryPanel](./MemoryCategoryPanel.md).
- Radios name their undecoded categories on the descriptor (`memoryNotDecoded`); `RadioDebugPage` passes it to the radio's Memory component as `notDecoded`.
