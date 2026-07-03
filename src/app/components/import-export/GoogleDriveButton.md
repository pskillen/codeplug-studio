# GoogleDriveButton

White bordered CTA with the multicolor Google Drive icon — used for connect, open, and save actions.

For import/export file actions outside Settings, prefer `GoogleDriveActionButton`, which greys out when Drive is not connected and prompts the operator to open Settings.

## Usage

```tsx
<GoogleDriveButton loading={loading} disabled={!isConfigured} onClick={() => void connect()}>
  Connect Google Drive
</GoogleDriveButton>
```

Accepts standard Mantine `Button` props except `variant`, `color`, and `leftSection` (icon is fixed).

## Related

- `GoogleDriveActionButton.tsx` — connection-gated open/save CTAs
- `GoogleDriveIcon.tsx`
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
