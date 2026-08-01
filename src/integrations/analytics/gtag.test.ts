import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAnalyticsConsent, setAnalyticsConsent } from '../preferences/analyticsConsent.ts';
import * as platform from '../platform/isNativeApp.ts';
import {
  getMeasurementId,
  getPageViewAnalyticsParams,
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
      title: '',
    });
    vi.stubGlobal('location', {
      origin: 'https://dev.codeplug.mm9pdy.net',
      href: 'https://dev.codeplug.mm9pdy.net/',
    });
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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

  it('queues page_view until gtag.js loads, then sends page_view event', () => {
    const gtagCalls: unknown[][] = [];
    window.gtag = ((...args: unknown[]) => {
      gtagCalls.push(args);
    }) as typeof window.gtag;

    setAnalyticsConsent('accepted');
    trackPageView('/library/channels');
    const eventBeforeLoad = gtagCalls.some(
      (call) => call[0] === 'event' && call[1] === 'page_view',
    );
    expect(eventBeforeLoad).toBe(false);

    scriptOnload?.();
    expect(gtagCalls).toContainEqual([
      'event',
      'page_view',
      {
        send_to: 'G-TEST123',
        page_path: '/library/channels',
        page_location: 'https://dev.codeplug.mm9pdy.net/',
        page_title: '',
        app_surface: 'web',
        build_env: __BUILD_ENV__,
      },
    ]);
  });

  it('getPageViewAnalyticsParams reports web by default', () => {
    expect(getPageViewAnalyticsParams()).toEqual({
      app_surface: 'web',
      build_env: __BUILD_ENV__,
    });
  });

  it('getPageViewAnalyticsParams reports android when native', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    expect(getPageViewAnalyticsParams()).toEqual({
      app_surface: 'android',
      build_env: __BUILD_ENV__,
    });
  });

  it('sends app_surface android on page_view when native', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    const gtagCalls: unknown[][] = [];
    window.gtag = ((...args: unknown[]) => {
      gtagCalls.push(args);
    }) as typeof window.gtag;

    setAnalyticsConsent('accepted');
    trackPageView('/library/channels');
    scriptOnload?.();

    expect(gtagCalls).toContainEqual([
      'event',
      'page_view',
      {
        send_to: 'G-TEST123',
        page_path: '/library/channels',
        page_location: 'https://dev.codeplug.mm9pdy.net/',
        page_title: '',
        app_surface: 'android',
        build_env: __BUILD_ENV__,
      },
    ]);
  });
});
