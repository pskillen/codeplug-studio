export const ANALYTICS_CONSENT_KEY = 'codeplug-studio:analytics-consent';
export const ANALYTICS_CONSENT_VERSION = 1;

export type AnalyticsConsentChoice = 'accepted' | 'declined';

export interface AnalyticsConsentState {
  version: number;
  choice: AnalyticsConsentChoice | null;
}

type AnalyticsConsentListener = (state: AnalyticsConsentState) => void;

const listeners = new Set<AnalyticsConsentListener>();

function parseStoredConsent(raw: string | null): AnalyticsConsentState {
  if (!raw) {
    return { version: ANALYTICS_CONSENT_VERSION, choice: null };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsConsentState>;
    if (parsed.version !== ANALYTICS_CONSENT_VERSION) {
      return { version: ANALYTICS_CONSENT_VERSION, choice: null };
    }
    if (parsed.choice === 'accepted' || parsed.choice === 'declined') {
      return { version: ANALYTICS_CONSENT_VERSION, choice: parsed.choice };
    }
  } catch {
    // Invalid JSON — treat as undecided.
  }
  return { version: ANALYTICS_CONSENT_VERSION, choice: null };
}

function notifyListeners(state: AnalyticsConsentState): void {
  for (const listener of listeners) {
    listener(state);
  }
}

export function getAnalyticsConsent(): AnalyticsConsentState {
  try {
    const raw = globalThis.localStorage?.getItem(ANALYTICS_CONSENT_KEY) ?? null;
    return parseStoredConsent(raw);
  } catch {
    return { version: ANALYTICS_CONSENT_VERSION, choice: null };
  }
}

export function setAnalyticsConsent(choice: AnalyticsConsentChoice): void {
  const state: AnalyticsConsentState = {
    version: ANALYTICS_CONSENT_VERSION,
    choice,
  };
  try {
    globalThis.localStorage?.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failures (quota, disabled storage).
  }
  notifyListeners(state);
}

export function clearAnalyticsConsent(): void {
  try {
    globalThis.localStorage?.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Ignore removal failures.
  }
  notifyListeners({ version: ANALYTICS_CONSENT_VERSION, choice: null });
}

export function subscribeAnalyticsConsent(listener: AnalyticsConsentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAnalyticsConsentAccepted(): boolean {
  return getAnalyticsConsent().choice === 'accepted';
}
