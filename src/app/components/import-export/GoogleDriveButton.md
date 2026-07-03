# GoogleDriveButton

White bordered CTA with the multicolor Google Drive icon.

For import/export and CPS export file actions, use `GoogleDriveActionButton`, which handles inline OAuth connect when needed.

## Usage

```tsx
<GoogleDriveButton loading={saving} onClick={handleSave}>
  Save to Drive
</GoogleDriveButton>
```

Accepts standard Mantine `Button` props except `variant`, `color`, and `leftSection` (icon is fixed).

## Related

- `GoogleDriveActionButton.tsx` — open/save CTAs with inline connect
- `GoogleDriveIcon.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
