/**
 * Route templates for analytics page_view sanitization (longest / most specific first).
 * Kept in sync with `src/app/App.tsx` — update when adding dynamic routes.
 */
export const ANALYTICS_ROUTE_TEMPLATES = [
  '/debug/indexed-db/:storeName/:projectId/:id',
  '/debug/indexed-db/:storeName',
  '/debug/local-storage/:storageKey',
  '/library/channels/add-from-ukrepeater',
  '/library/channels/add-from-openaip',
  '/library/channels/add-from-brandmeister',
  '/library/channels/add-channel-set',
  '/library/zones/new-from-location',
  '/builds/:id/overview',
  '/builds/:id/channels',
  '/builds/:id/zones',
  '/builds/:id/talk-groups',
  '/builds/:id/contacts',
  '/builds/:id/scan-lists',
  '/builds/:id/rx-group-lists',
  '/builds/:id/export',
  '/debug/indexed-db',
  '/debug/local-storage',
  '/library/:kind/:id',
  '/library/channels',
  '/library/zones',
  '/library/talk-groups',
  '/library/contacts',
  '/library/rx-group-lists',
  '/library/scan-lists',
  '/library/aprs-configurations',
  '/reference/maidenhead',
  '/reference/bands',
  '/import-export',
  '/builds/new',
  '/builds/:id',
  '/summary',
  '/reference',
  '/privacy',
  '/cookies',
  '/terms',
  '/settings',
  '/attributions',
  '/help',
  '/builds',
  '/debug',
  '/styleguide',
  '/',
] as const;

/** Routes excluded from analytics (dev-only surfaces). */
const EXCLUDED_PREFIXES = ['/debug', '/styleguide'] as const;

export function isAnalyticsExcludedPath(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
