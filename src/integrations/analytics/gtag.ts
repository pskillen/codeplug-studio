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
let pendingPagePath: string | null = null;

type AnalyticsReadyListener = () => void;
const readyListeners = new Set<AnalyticsReadyListener>();

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

function notifyReady(): void {
  for (const listener of readyListeners) {
    listener();
  }
}

function markReady(measurementId: string): void {
  window.gtag?.('config', measurementId, { send_page_view: false });
  analyticsReady = true;
  if (pendingPagePath) {
    const path = pendingPagePath;
    pendingPagePath = null;
    sendPageView(path, measurementId);
  }
  notifyReady();
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
  script.onload = () => {
    markReady(measurementId);
  };
  script.onerror = () => {
    analyticsReady = false;
  };
  document.head.appendChild(script);
  scriptInjected = true;
}

function sendPageView(pagePath: string, measurementId: string): void {
  window.gtag?.('config', measurementId, {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
  });
}

export function initAnalytics(): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isAnalyticsConsentAccepted()) {
    analyticsReady = false;
    pendingPagePath = null;
    return;
  }
  injectGtagScript(measurementId);
}

export function trackPageView(pagePath: string): void {
  const measurementId = getMeasurementId();
  if (!measurementId || !isAnalyticsConsentAccepted()) {
    return;
  }
  if (!analyticsReady) {
    pendingPagePath = pagePath;
    return;
  }
  sendPageView(pagePath, measurementId);
}

export function subscribeAnalyticsReady(listener: AnalyticsReadyListener): () => void {
  readyListeners.add(listener);
  if (analyticsReady) {
    listener();
  }
  return () => {
    readyListeners.delete(listener);
  };
}

export function isAnalyticsReady(): boolean {
  return analyticsReady;
}

export function resetAnalyticsForTests(): void {
  scriptInjected = false;
  analyticsReady = false;
  pendingPagePath = null;
  readyListeners.clear();
  window.dataLayer = undefined;
  window.gtag = undefined;
}

function handleConsentChange(): void {
  if (isAnalyticsConsentAccepted()) {
    initAnalytics();
  } else {
    analyticsReady = false;
    pendingPagePath = null;
  }
}

subscribeAnalyticsConsent(handleConsentChange);
handleConsentChange();
