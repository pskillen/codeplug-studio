import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isAnalyticsReady,
  subscribeAnalyticsReady,
  trackPageView,
} from '@integrations/analytics/index.ts';
import { analyticsPagePath } from '../lib/analyticsPagePath.ts';
import { useAnalyticsConsent } from './useAnalyticsConsent.ts';

export function usePageAnalytics(): void {
  const location = useLocation();
  const { choice } = useAnalyticsConsent();
  const analyticsReady = useSyncExternalStore(
    subscribeAnalyticsReady,
    isAnalyticsReady,
    () => false,
  );

  useEffect(() => {
    if (choice !== 'accepted') {
      return;
    }
    const sanitized = analyticsPagePath(location.pathname);
    if (!sanitized) {
      return;
    }
    trackPageView(sanitized);
  }, [location.pathname, choice, analyticsReady]);
}
