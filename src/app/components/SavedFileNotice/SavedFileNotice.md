# SavedFileNotice

Android app notice that says where the last saved file went.

## Purpose

The app's WebView has no download bar. Every download goes through `downloadBlob`
(`src/integrations/download/browserDownload.ts`), which on native saves the file on the phone
(`nativeSave.ts`) and publishes the outcome. This notice shows it: **Saved to Documents/Codeplug
Studio/&lt;file&gt;**, or, when only the app's cache could be written (Android 10 and earlier), that
the share sheet is the way to keep the file, or why the save failed.

## Props

None.

## Usage

```tsx
import SavedFileNotice from './components/SavedFileNotice/SavedFileNotice.tsx';

// Mounted once in AppLayout, next to CookieConsentBanner.
<SavedFileNotice />;
```

## Behaviour

- Subscribes to `subscribeNativeSaves`; renders nothing until a save is reported, so it never shows
  in a browser.
- Fixed ribbon at the top of the viewport (clear of the share sheet, which opens from the bottom),
  `role="status"`.
- Info tone for a save, warning tone for a failure. Dismiss with the close button; it also hides
  itself after `SAVED_FILE_NOTICE_MS` (10 s). A new save replaces the shown one.

## Related

- [docs/features/android-app/README.md](../../../../docs/features/android-app/README.md#saving-files)
- [`nativeSave.ts`](../../../integrations/download/nativeSave.ts)
- [`DismissibleNotice`](../v2/DismissibleNotice.tsx)
