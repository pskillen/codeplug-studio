# SettingsTable

The whole Settings tab body for one read, on every radio.

## Purpose

One look for Settings: the DM-32 layout, striped, with the same columns and widths in every group. It draws a `SettingsView` (`@integrations/radio-io/debugView`) and knows no radio: every sentence (summary, intro, evidence, group blurbs) is supplied by the radio home.

## Props

| Prop             | Type           | Notes                                                                      |
| ---------------- | -------------- | -------------------------------------------------------------------------- |
| `view`           | `SettingsView` | Status, summary, intro, groups of `SettingRow`, optional folded `trailing` |
| `revealed`       | `boolean`      | Sensitive rows show their value and raw bytes only when true               |
| `onToggleReveal` | `() => void`   | The **Show password** button; shown only when some row has `sensitive`     |
| `defaultShowRaw` | `boolean`      | Start with Address and Raw on; the switch still works (default off)        |

## Usage

```tsx
<DesignSystemV2Provider>
  <SettingsTable view={view} revealed={reveal.revealed} onToggleReveal={reveal.toggle} />
</DesignSystemV2Provider>
```

## Behaviour

- Order: summary, dimmed intro, toolbar (search, **Show raw bytes + address**, **Show password**), one `DebugSection` per group, then the trailing sections, folded.
- Columns: Setting (label, help dimmed below) · Value · Default (only when some row has `firmwareDefault`) · Confidence (`ConfidenceBadge`, evidence dimmed). The raw toggle adds Address and Raw after Value. `table-layout: fixed` with one `colgroup` per mode, so widths are identical in every group.
- Stripes on every other row. Under a phone width the table scrolls inside its container.
- A present value with nothing to show in a column says so in words, never a dash: "No raw bytes", "No address" or "No default". A dash would read as a missing value.
- A present value with nothing for a column says so in words, never a dash: "No raw bytes", "No address" or "No default", because a dash reads as a missing value.
- A missing value reads "Not captured" in words, never a default. A hidden sensitive row reads "Hidden (password)" and `••` bytes, and matches no search until revealed. `rawValue` is appended as `(26)` only when the value is not already a number.
- Search covers label, id, help, group, shown value, shown raw bytes, confidence text, address and evidence. While searching, empty groups drop out and matching trailing sections open.
- Status `not-captured` or `ambiguous` shows the view's reason and "This does not mean the radio has default settings".
- Local state (search, raw toggle) belongs to the mounted table; `SettingsTab` remounts it per archive.
- Must render inside `DesignSystemV2Provider`.

## Related

- [DebugSection.md](./DebugSection.md), [ConfidenceBadge.md](./ConfidenceBadge.md)
- `SettingsTab` (`src/app/routes/debug/radios/SettingsTab.tsx`), the tab shell that calls `descriptor.settings(archive)`
- [docs/features/radio-debug/README.md](../../../../docs/features/radio-debug/README.md)
