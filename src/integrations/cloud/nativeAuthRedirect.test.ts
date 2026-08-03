import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { savePendingNativeAuth, clearPendingNativeAuth } from './drivePrefs.ts';
import {
  handleNativeOAuthRedirectUrl,
  resetNativeAuthRedirectListenerForTests,
  waitForAuthorizationCode,
} from './nativeAuthRedirect.ts';
import { DriveCancelledError } from './driveTypes.ts';

function mockFetch(body: Record<string, unknown>): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

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

describe('nativeAuthRedirect', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    resetNativeAuthRedirectListenerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPendingNativeAuth();
    resetNativeAuthRedirectListenerForTests();
  });

  it('resolves waitForAuthorizationCode when redirect arrives', async () => {
    const codePromise = waitForAuthorizationCode('state-wait');
    await handleNativeOAuthRedirectUrl(
      'net.mm9pdy.codeplugstudio:/oauth2redirect?code=auth-code&state=state-wait',
    );
    await expect(codePromise).resolves.toBe('auth-code');
  });

  it('rejects waitForAuthorizationCode on access_denied', async () => {
    const codePromise = waitForAuthorizationCode('state-deny');
    await handleNativeOAuthRedirectUrl(
      'net.mm9pdy.codeplugstudio:/oauth2redirect?error=access_denied&state=state-deny',
    );
    await expect(codePromise).rejects.toBeInstanceOf(DriveCancelledError);
  });

  it('saves session on cold-start redirect without active waiter', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        access_token: 'ya29.cold',
        expires_in: 3600,
        refresh_token: 'rt.cold',
      }),
    );

    savePendingNativeAuth({
      state: 'cold-state',
      codeVerifier: 'cold-verifier',
      createdAt: Date.now(),
    });

    vi.stubEnv('VITE_GOOGLE_ANDROID_CLIENT_ID', 'android-client.apps.googleusercontent.com');

    await handleNativeOAuthRedirectUrl(
      'net.mm9pdy.codeplugstudio:/oauth2redirect?code=cold-code&state=cold-state',
    );

    const { loadDriveSession } = await import('./drivePrefs.ts');
    const loaded = loadDriveSession();
    expect(loaded?.accessToken).toBe('ya29.cold');
    expect(loaded?.refreshToken).toBe('rt.cold');

    vi.unstubAllEnvs();
  });
});
