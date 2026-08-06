# StickyFooter

Sticky editor save bar with Cancel + Save and dirty/saved status.

## Purpose

Batch 3 E1–E8 chrome. On desktop, sticks to the bottom of the scrollable editor column. On mobile (≤48em) with `BottomTabBar`, `AppLayout` sets `--dsv2-bottom-tab-bar-height` and the footer is `position: fixed` flush above the tab bar; editor scroll bodies use `--dsv2-sticky-footer-height` for bottom padding.

## Props

| Prop          | Type         | Notes                                        |
| ------------- | ------------ | -------------------------------------------- |
| `saveLabel`   | `string`     | Primary button label (e.g. `"Save channel"`) |
| `dirty`       | `boolean`    | Shows "Unsaved changes" when true            |
| `onCancel`    | `() => void` | Secondary button handler                     |
| `onSave`      | `() => void` | Primary button handler                       |
| `compact`     | `boolean`    | Tighter padding on narrow viewports          |
| `saving`      | `boolean`    | Loading state on Save                        |
| `statusText`  | `string`     | Override default status line                 |
| `cancelLabel` | `string`     | Default `"Cancel"`                           |

## Usage

```tsx
<div className={isMobile ? styles.scrollBodyCompact : styles.scrollBody}>
  {/* panels */}
  <StickyFooter
    saveLabel="Save channel"
    dirty={isDirty}
    onCancel={() => navigate('/library/channels')}
    onSave={handleSave}
    saving={saving}
    compact={isMobile}
  />
</div>
```

`scrollBodyCompact` should use `padding-bottom: var(--dsv2-sticky-footer-height, 3.25rem)` so content clears the fixed footer on mobile.

## Related

- [EditorHeader.md](./EditorHeader.md)
- [ConfirmModal.md](./ConfirmModal.md) — unsaved navigation guard
