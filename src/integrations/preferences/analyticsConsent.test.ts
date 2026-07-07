import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_CONSENT_VERSION,
  clearAnalyticsConsent,
  getAnalyticsConsent,
  isAnalyticsConsentAccepted,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from './analyticsConsent.ts';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('analyticsConsent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null choice when unset', () => {
    expect(getAnalyticsConsent()).toEqual({
      version: ANALYTICS_CONSENT_VERSION,
      choice: null,
    });
    expect(isAnalyticsConsentAccepted()).toBe(false);
  });

  it('persists accepted and declined choices', () => {
    setAnalyticsConsent('accepted');
    expect(getAnalyticsConsent().choice).toBe('accepted');
    expect(isAnalyticsConsentAccepted()).toBe(true);

    setAnalyticsConsent('declined');
    expect(getAnalyticsConsent().choice).toBe('declined');
    expect(isAnalyticsConsentAccepted()).toBe(false);
  });

  it('stores versioned JSON under the consent key', () => {
    setAnalyticsConsent('accepted');
    const raw = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({
      version: ANALYTICS_CONSENT_VERSION,
      choice: 'accepted',
    });
  });

  it('treats invalid or version-mismatched storage as undecided', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, '{"version":0,"choice":"accepted"}');
    expect(getAnalyticsConsent().choice).toBe(null);

    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'not-json');
    expect(getAnalyticsConsent().choice).toBe(null);
  });

  it('notifies subscribers on change', () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeAnalyticsConsent((state) => {
      seen.push(state.choice);
    });

    setAnalyticsConsent('accepted');
    setAnalyticsConsent('declined');
    clearAnalyticsConsent();
    unsubscribe();

    expect(seen).toEqual(['accepted', 'declined', null]);
  });

  it('does not notify after unsubscribe', () => {
    let count = 0;
    const unsubscribe = subscribeAnalyticsConsent(() => {
      count += 1;
    });
    unsubscribe();
    setAnalyticsConsent('accepted');
    expect(count).toBe(0);
  });
});
