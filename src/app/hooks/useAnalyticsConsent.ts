import { useSyncExternalStore } from 'react';
import {
  ANALYTICS_CONSENT_VERSION,
  getAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsentChoice,
  type AnalyticsConsentState,
} from '@integrations/preferences/analyticsConsent.ts';

function getChoiceSnapshot(): AnalyticsConsentChoice | null {
  return getAnalyticsConsent().choice;
}

function getServerChoiceSnapshot(): AnalyticsConsentChoice | null {
  return null;
}

export function useAnalyticsConsent(): AnalyticsConsentState {
  const choice = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getChoiceSnapshot,
    getServerChoiceSnapshot,
  );
  return { version: ANALYTICS_CONSENT_VERSION, choice };
}
