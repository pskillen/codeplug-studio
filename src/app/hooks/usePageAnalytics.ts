import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@integrations/analytics/index.ts';
import { analyticsPagePath } from '../lib/analyticsPagePath.ts';

export function usePageAnalytics(): void {
  const location = useLocation();

  useEffect(() => {
    const sanitized = analyticsPagePath(location.pathname);
    if (sanitized) {
      trackPageView(sanitized);
    }
  }, [location.pathname]);
}
