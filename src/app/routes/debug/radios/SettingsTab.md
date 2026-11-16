# SettingsTab

The shared Settings tab shell for a radio debug page.

## Purpose

Calls the descriptor's `settings(archive)` and draws the result with `SettingsTable`. It holds no radio text; the `SettingsView` carries every sentence. Radios not yet on `settings` keep their own `Settings` component, which the page uses when the descriptor has no `settings`.

## Props

| Prop       | Type                                      | Notes                               |
| ---------- | ----------------------------------------- | ----------------------------------- |
| `archive`  | `DebugArchive \| undefined`               | The page's selected read            |
| `settings` | `(archive: DebugArchive) => SettingsView` | The descriptor's radio-home builder |

## Behaviour

- No archive: "Open or read a capture to inspect its settings."
- Remounts per archive (`archiveKey`), so search, the raw toggle and **Show password** reset when another read or file is shown.
- The view is built once per archive (`useMemo`).
- Wraps `SettingsTable` in `DesignSystemV2Provider` (the page itself is not inside it), so the table block renders in the v2 dark scheme.

## Related

- [SettingsTable.md](../../../components/debug/SettingsTable.md)
- [RadioDebugPage.md](./RadioDebugPage.md)
- DM-32UV view: `src/integrations/radio-io/radios/dm32uv/debugSettingsView.ts`
