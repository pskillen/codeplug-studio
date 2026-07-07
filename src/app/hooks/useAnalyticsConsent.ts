import { useSyncExternalStore } from 'react';
import {
  getAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsentState,
} from '@integrations/preferences/analyticsConsent.ts';

function getServerSnapshot(): AnalyticsConsentState {
  return getAnalyticsConsent();
}

export function useAnalyticsConsent(): AnalyticsConsentState {
  return useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getServerSnapshot);
}
