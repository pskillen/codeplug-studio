import {
  isAnalyticsConsentAccepted,
  subscribeAnalyticsConsent,
} from '../preferences/analyticsConsent.ts';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

type Gtag = {
  (...args: unknown[]): void;
  /** gtag.js replaces the stub after the external script loads. */
};

let scriptInjected = false;
let analyticsReady = false;
let pendingPagePath: string | null = null;

type AnalyticsReadyListener = () => void;
const readyListeners = new Set<AnalyticsReadyListener>();

export function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? '';
}

/** Match Google's snippet — push `arguments`, not a rest-params array. */
function installGtagStub(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js requires dataLayer.push(arguments), not a rest-params array.
      // eslint-disable-next-line prefer-rest-params -- Google gtag queue contract
      window.dataLayer?.push(arguments);
    } as Gtag;
  }
}

function notifyReady(): void {
  for (const listener of readyListeners) {
    listener();
  }
}

function markReady(measurementId: string): void {
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
  installGtagStub();
  window.gtag?.('js', new Date());
  // Disable the automatic first page_view; we send explicit page_view events per route.
  window.gtag?.('config', measurementId, { send_page_view: false });

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
  window.gtag?.('event', 'page_view', {
    send_to: measurementId,
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
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
