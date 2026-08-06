# StickyFooter

Sticky editor save bar with Cancel + Save and dirty/saved status.

## Purpose

Batch 3 E1–E8 chrome. Sits at the bottom of scrollable editor content; parent should add bottom padding so fields are not obscured.

## Props

| Prop          | Type           | Notes                                           |
| ------------- | -------------- | ----------------------------------------------- |
| `saveLabel`   | `string`       | Primary button label (e.g. `"Save channel"`)    |
| `dirty`       | `boolean`      | Shows "Unsaved changes" when true               |
| `onCancel`    | `() => void`   | Secondary button handler                        |
| `onSave`      | `() => void`   | Primary button handler                          |
| `compact`     | `boolean`      | Tighter padding on narrow viewports             |
| `saving`      | `boolean`      | Loading state on Save                           |
| `statusText`  | `string`       | Override default status line                    |
| `cancelLabel` | `string`       | Default `"Cancel"`                              |

## Usage

```tsx
<div style={{ paddingBottom: compact ? 76 : 84 }}>
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

## Related

- [EditorHeader.md](./EditorHeader.md)
- [ConfirmModal.md](./ConfirmModal.md) — unsaved navigation guard
