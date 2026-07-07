import { matchPath } from 'react-router-dom';
import { ANALYTICS_ROUTE_TEMPLATES, isAnalyticsExcludedPath } from './analyticsRouteTemplates.ts';

/**
 * Map a browser pathname to a route template for GA4 page_view, or null when tracking
 * should be skipped (dev-only routes).
 */
export function analyticsPagePath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (isAnalyticsExcludedPath(normalized)) {
    return null;
  }

  for (const template of ANALYTICS_ROUTE_TEMPLATES) {
    if (matchPath({ path: template, end: true }, normalized)) {
      return template;
    }
  }

  return normalized;
}
