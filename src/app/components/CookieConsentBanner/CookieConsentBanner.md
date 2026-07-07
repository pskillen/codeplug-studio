# CookieConsentBanner

Fixed bottom bar shown on first visit until the operator accepts or declines analytics cookies.

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

- Reads consent via `useAnalyticsConsent()` (`localStorage` key `codeplug-studio:analytics-consent`).
- Hidden when `choice` is `accepted` or `declined`.
- **Accept analytics** → `setAnalyticsConsent('accepted')` — enables GA loader (see `src/integrations/analytics/`).
- **Essential only** → `setAnalyticsConsent('declined')` — analytics never loads.
- Links to `/privacy` and `/cookies` (in-app routes).

Companion control for changing preference: `CookiePreferenceControl.tsx` on the Cookies page.

## Related

- [docs/features/analytics/README.md](../../../../docs/features/analytics/README.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
- [`analyticsConsent.ts`](../../../integrations/preferences/analyticsConsent.ts)
