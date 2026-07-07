import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnalyticsConsent,
  setAnalyticsConsent,
} from '../preferences/analyticsConsent.ts';
import {
  getMeasurementId,
  initAnalytics,
  resetAnalyticsForTests,
  trackPageView,
} from './gtag.ts';

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

describe('gtag analytics', () => {
  const appendChild = vi.fn();
  const createElement = vi.fn(() => ({ async: false, src: '', onload: null as (() => void) | null }));

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
    resetAnalyticsForTests();
    clearAnalyticsConsent();
    appendChild.mockClear();
    createElement.mockClear();
    vi.stubGlobal('document', {
      createElement,
      head: { appendChild },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetAnalyticsForTests();
  });

  it('returns empty measurement id when env unset', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '');
    expect(getMeasurementId()).toBe('');
  });

  it('does not inject gtag when consent is declined', () => {
    setAnalyticsConsent('declined');
    initAnalytics();
    trackPageView('/library/channels');
    expect(createElement).not.toHaveBeenCalled();
    expect(window.gtag).toBeUndefined();
  });

  it('does not inject gtag when measurement id is missing', () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '');
    setAnalyticsConsent('accepted');
    initAnalytics();
    expect(createElement).not.toHaveBeenCalled();
  });

  it('injects gtag and sends page_view when consent accepted', () => {
    setAnalyticsConsent('accepted');
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => {
      gtagCalls.push(args);
    };

    initAnalytics();
    expect(createElement).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();

    trackPageView('/library/channels');
    expect(gtagCalls).toContainEqual(['event', 'page_view', { page_path: '/library/channels' }]);
  });
});
