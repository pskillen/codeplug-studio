# Usage and analytics

Anonymous page-view measurement and the consent/legal plumbing needed to run Google Analytics responsibly on the public SPA.

**Tracking:** Epic [#96](https://github.com/pskillen/codeplug-studio/issues/96)

**Source:** `src/integrations/analytics/`, `src/integrations/preferences/analyticsConsent.ts`, `src/app/components/CookieConsentBanner/`, `src/app/routes/legal/`

## Implementation status

| Area                   | Status  | Notes                                                          |
| ---------------------- | ------- | -------------------------------------------------------------- |
| Cookie consent banner  | Shipped | First visit; accept / essential only                           |
| Legal pages            | Shipped | `/privacy`, `/terms`, `/cookies`                               |
| Consent preference API | Shipped | `localStorage` key `codeplug-studio:analytics-consent`         |
| GA4 integration        | Shipped | Consent-gated `gtag.js`; page views only                       |
| Path sanitization      | Shipped | Route templates — no entity UUIDs in GA                        |
| Dual-property CI       | Shipped | Prod vs pre-prod measurement IDs at build time                 |
| Playwright smoke       | Shipped | [#176](https://github.com/pskillen/codeplug-studio/issues/176) |

## Consent flow

```text
First visit → CookieConsentBanner visible
  ├─ Accept analytics → setAnalyticsConsent('accepted') → GA may load
  └─ Essential only   → setAnalyticsConsent('declined') → GA never loads

Subsequent visits → banner hidden; choice read from localStorage
/cookies → CookiePreferenceControl to change or reset choice
```

Essential app storage (IndexedDB projects, UI prefs) works regardless of analytics choice.

## What GA collects (when accepted)

- **`page_view` events only** — no custom events, clicks, or workflow milestones in v1
- Fired by `usePageAnalytics` when **all** of:
  1. Analytics cookies accepted (`codeplug-studio:analytics-consent`)
  2. `VITE_GA_MEASUREMENT_ID` present in the build
  3. `gtag.js` has finished loading
  4. Current route maps to a sanitized template (not excluded)
- Triggers on **consent accept** (current page) and on each **client-side navigation** (React Router path change)
- Sanitized route templates (e.g. `/library/:kind/:id`, not real UUIDs)
- Deploy environment is visible in the footer (`__BUILD_ENV__`) but is not sent as a custom dimension in v1

## What GA does not collect

- Project names, channel data, callsigns, frequencies
- Mapbox or Google Drive tokens
- `localStorage` / IndexedDB keys or values
- **Debug or styleguide routes** — `/debug`, `/debug/*`, `/styleguide` are excluded (no `page_view`)

## Build configuration

| Variable                 | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `VITE_GA_MEASUREMENT_ID` | Baked in at build time; absent in local dev unless set in `.env.local` |

Deployed builds receive the ID from GitHub Actions secrets — see [build README](../../build/README.md#google-analytics-4-optional):

| Deploy             | Secret                      |
| ------------------ | --------------------------- |
| Production         | `GA_MEASUREMENT_ID`         |
| Staging, next, dev | `GA_MEASUREMENT_ID_PREPROD` |

## Code anchors

| Module                                             | Role                                     |
| -------------------------------------------------- | ---------------------------------------- |
| `src/integrations/preferences/analyticsConsent.ts` | Persist and subscribe to consent         |
| `src/integrations/analytics/gtag.ts`               | Load gtag after consent; `trackPageView` |
| `src/app/lib/analyticsPagePath.ts`                 | Pathname → route template                |
| `src/app/hooks/usePageAnalytics.ts`                | Fire page views on `useLocation` changes |
| `src/app/hooks/useAnalyticsConsent.ts`             | React hook for consent state             |

## Component sidecars

- [CookieConsentBanner.md](../../../src/app/components/CookieConsentBanner/CookieConsentBanner.md)

## Related

- [app-shell README](../app-shell/README.md) — footer legal links, banner mount
- [DESIGN.md](../../../DESIGN.md) — privacy principle (browser-local operator data)
- [progress log](analytics-progress.md) · [outstanding](analytics-outstanding.md)
