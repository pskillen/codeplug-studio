# SettingsTab

The shared Settings tab shell for a radio debug page.

## Purpose

Calls the descriptor's `settings(archive)` and draws the result with `SettingsTable`. It holds no radio text; the `SettingsView` carries every sentence. Every radio with a Settings tab is on `settings`; the old per-radio `Settings` component field is gone.

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
- Views: `opengd77/debugSettingsView.ts`, `uv5r-mini/debugRead/settingsView.ts`, `rt95/` and `at-d890uv/debugSettingsView.ts`
- DM-32UV view: `src/integrations/radio-io/radios/dm32uv/debugSettingsView.ts`
