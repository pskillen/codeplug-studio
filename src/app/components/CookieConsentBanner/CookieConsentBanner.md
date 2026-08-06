# CookieConsentBanner

U7 bottom ribbon for first-visit analytics consent — sits above the mobile `BottomTabBar` when visible.

## Purpose

Meet a minimal GDPR/UK PECR bar: explain essential vs optional cookies, link to legal pages, and persist the operator's choice before Google Analytics can load.

## Props

None.

## Usage

```tsx
import CookieConsentBanner from './components/CookieConsentBanner/CookieConsentBanner.tsx';

// Mounted once in AppLayout above the route outlet.
<CookieConsentBanner />;
```

## Behaviour

- Wraps content in `DesignSystemV2Provider` (banner renders outside shell chrome scope).
- Reads consent via `useAnalyticsConsent()` (`localStorage` key `codeplug-studio:analytics-consent`).
- Hidden when `choice` is `accepted` or `declined`.
- **Collapsed:** copy + Manage / Accept.
- **Expanded (Manage):** Necessary (always on) + Analytics toggle; Reject non-essential / Save preferences.
- On narrow viewports, `bottom` uses `--dsv2-bottom-tab-bar-height` so the ribbon clears the tab bar.
- Links to `/privacy` and `/cookies` (in-app routes).

Companion control for changing preference after a choice: `CookiePreferenceControl.tsx` on the Cookies page.

## Related

- [docs/features/analytics/README.md](../../../../docs/features/analytics/README.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
- [`analyticsConsent.ts`](../../../integrations/preferences/analyticsConsent.ts)
