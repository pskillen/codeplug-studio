import {
  isAnalyticsConsentAccepted,
  subscribeAnalyticsConsent,
} from '../preferences/analyticsConsent.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let scriptInjected = false;
let analyticsReady = false;

export function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? '';
}

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }
}

function injectGtagScript(measurementId: string): void {
  if (scriptInjected || typeof document === 'undefined') {
    return;
  }
  ensureDataLayer();
  window.gtag?.('js', new Date());
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  scriptInjected = true;
}

export function initAnalytics(): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isAnalyticsConsentAccepted()) {
    analyticsReady = false;
    return;
  }
  injectGtagScript(measurementId);
  window.gtag?.('config', measurementId, { send_page_view: false });
  analyticsReady = true;
}

export function trackPageView(pagePath: string): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isAnalyticsConsentAccepted() || !analyticsReady) {
    return;
  }
  window.gtag?.('event', 'page_view', { page_path: pagePath });
}

export function resetAnalyticsForTests(): void {
  scriptInjected = false;
  analyticsReady = false;
  window.dataLayer = undefined;
  window.gtag = undefined;
}

function handleConsentChange(): void {
  if (isAnalyticsConsentAccepted()) {
    initAnalytics();
  } else {
    analyticsReady = false;
  }
}

subscribeAnalyticsConsent(handleConsentChange);
handleConsentChange();
