import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { driveApi } from './driveApi.ts';
import { loadDriveSession, saveDriveLastAccount, saveDriveSession } from './drivePrefs.ts';
import { DriveCancelledError } from './driveTypes.ts';
import {
  completePendingNativeAuthFromPrefs,
  getGoogleAndroidClientId,
  parseNativeOAuthRedirectUrl,
  rejectNativeOAuthRedirect,
} from './nativeGoogleAuth.ts';

type AuthorizationWaiter = {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
};

const authorizationWaiters = new Map<string, AuthorizationWaiter>();
const AUTHORIZATION_WAIT_TIMEOUT_MS = 10 * 60 * 1000;

export function waitForAuthorizationCode(state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (authorizationWaiters.has(state)) {
      reject(new Error('Duplicate authorization wait for state.'));
      return;
    }

    const timeoutId = setTimeout(() => {
      if (authorizationWaiters.has(state)) {
        authorizationWaiters.delete(state);
        reject(new DriveCancelledError());
      }
    }, AUTHORIZATION_WAIT_TIMEOUT_MS);

    authorizationWaiters.set(state, {
      resolve: (code) => {
        clearTimeout(timeoutId);
        authorizationWaiters.delete(state);
        resolve(code);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        authorizationWaiters.delete(state);
        reject(error);
      },
    });
  });
}

function resolveAuthorizationWaiter(state: string, code: string): boolean {
  const waiter = authorizationWaiters.get(state);
  if (!waiter) return false;
  waiter.resolve(code);
  return true;
}

function rejectAuthorizationWaiter(state: string, error: Error): boolean {
  const waiter = authorizationWaiters.get(state);
  if (!waiter) return false;
  waiter.reject(error);
  return true;
}

export async function handleNativeOAuthRedirectUrl(url: string): Promise<void> {
  const parsed = parseNativeOAuthRedirectUrl(url);
  if (!parsed.code && !parsed.error) return;

  if (parsed.error) {
    const error = rejectNativeOAuthRedirect(parsed.error, parsed.errorDescription);
    if (parsed.state) {
      rejectAuthorizationWaiter(parsed.state, error);
    }
    return;
  }

  if (!parsed.code || !parsed.state) return;

  if (resolveAuthorizationWaiter(parsed.state, parsed.code)) {
    return;
  }

  const clientId = getGoogleAndroidClientId();
  if (!clientId) return;

  try {
    const tokens = await completePendingNativeAuthFromPrefs({
      clientId,
      code: parsed.code,
      state: parsed.state,
    });
    if (!tokens) return;

    let accountEmail = loadDriveSession()?.accountEmail;
    try {
      const email = await driveApi.getUserEmail(tokens.accessToken);
      if (email) {
        accountEmail = email;
        saveDriveLastAccount(email);
      }
    } catch {
      // Account label is optional when userinfo fails.
    }

    saveDriveSession({
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      accountEmail,
      refreshToken: tokens.refreshToken,
    });
  } catch {
    // Operator can retry connect from Settings.
  }
}

let listenerRegistered = false;

export function registerNativeAuthRedirectListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  App.addListener('appUrlOpen', (event) => {
    void handleNativeOAuthRedirectUrl(event.url);
  });

  void App.getLaunchUrl().then((result) => {
    if (result?.url) {
      void handleNativeOAuthRedirectUrl(result.url);
    }
  });
}

export function resetNativeAuthRedirectListenerForTests(): void {
  listenerRegistered = false;
  authorizationWaiters.clear();
}

export async function openNativeAuthorizationUrl(url: string): Promise<void> {
  await Browser.open({ url });
}

export async function closeNativeAuthorizationBrowser(): Promise<void> {
  try {
    await Browser.close();
  } catch {
    // Browser may already be closed after redirect.
  }
}
