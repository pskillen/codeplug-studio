import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAnalyticsConsent, setAnalyticsConsent } from '../preferences/analyticsConsent.ts';
import { getMeasurementId, initAnalytics, resetAnalyticsForTests, trackPageView } from './gtag.ts';

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
  let scriptOnload: (() => void) | null = null;
  const createElement = vi.fn(() => ({
    async: false,
    src: '',
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
  }));

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
    resetAnalyticsForTests();
    clearAnalyticsConsent();
    appendChild.mockClear();
    createElement.mockClear();
    scriptOnload = null;
    appendChild.mockImplementation((script: { onload: (() => void) | null }) => {
      scriptOnload = script.onload;
    });
    vi.stubGlobal('document', {
      createElement,
      head: { appendChild },
    });
    vi.stubGlobal('location', { origin: 'https://dev.codeplug.mm9pdy.net' });
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

  it('queues page_view until gtag.js loads, then sends config hit', () => {
    const gtagCalls: unknown[][] = [];
    window.gtag = (...args: unknown[]) => {
      gtagCalls.push(args);
    };

    setAnalyticsConsent('accepted');
    trackPageView('/library/channels');
    const configBeforeLoad = gtagCalls.some(
      (call) =>
        call[0] === 'config' &&
        (call[2] as { page_path?: string })?.page_path === '/library/channels',
    );
    expect(configBeforeLoad).toBe(false);

    scriptOnload?.();
    expect(gtagCalls).toContainEqual([
      'config',
      'G-TEST123',
      {
        page_path: '/library/channels',
        page_location: 'https://dev.codeplug.mm9pdy.net/library/channels',
      },
    ]);
  });
});
