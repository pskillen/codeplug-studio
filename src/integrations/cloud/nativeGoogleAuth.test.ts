import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationUrl,
  createNativeAuthProvider,
  exchangeAuthorizationCode,
  getGoogleAndroidClientId,
  NATIVE_OAUTH_REDIRECT_URI,
  parseNativeOAuthRedirectUrl,
  refreshAccessToken,
  rejectNativeOAuthRedirect,
} from './nativeGoogleAuth.ts';
import { clearPendingNativeAuth, loadPendingNativeAuth } from './drivePrefs.ts';
import { DriveAuthError, DriveCancelledError } from './driveTypes.ts';

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

describe('nativeGoogleAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPendingNativeAuth();
  });

  it('builds authorization URL with PKCE params', () => {
    const url = buildAuthorizationUrl({
      clientId: 'android-client.apps.googleusercontent.com',
      redirectUri: NATIVE_OAUTH_REDIRECT_URI,
      scope: 'https://www.googleapis.com/auth/drive',
      state: 'state-123',
      codeChallenge: 'challenge-abc',
    });
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('state=state-123');
  });

  it('exchanges authorization code for tokens', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'ya29.native',
        expires_in: 3600,
        refresh_token: 'rt.native',
      }),
    })) as typeof fetch;

    const tokens = await exchangeAuthorizationCode({
      clientId: 'android-client.apps.googleusercontent.com',
      code: 'auth-code',
      codeVerifier: 'verifier',
      fetchImpl,
    });

    expect(tokens.accessToken).toBe('ya29.native');
    expect(tokens.refreshToken).toBe('rt.native');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('refreshes access token', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'ya29.refreshed',
        expires_in: 3600,
      }),
    })) as typeof fetch;

    const tokens = await refreshAccessToken({
      clientId: 'android-client.apps.googleusercontent.com',
      refreshToken: 'rt.native',
      fetchImpl,
    });

    expect(tokens.accessToken).toBe('ya29.refreshed');
    expect(tokens.refreshToken).toBe('rt.native');
  });

  it('authorize opens URL and exchanges returned code', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'ya29.flow',
        expires_in: 3600,
        refresh_token: 'rt.flow',
      }),
    })) as typeof fetch;

    let capturedUrl = '';
    let capturedState = '';

    const provider = createNativeAuthProvider({
      fetchImpl,
      openAuthorizationUrl: async (url) => {
        capturedUrl = url;
        const state = new URL(url).searchParams.get('state');
        if (state) capturedState = state;
      },
      waitForAuthorizationCode: async (state) => {
        expect(state).toBe(capturedState);
        return 'returned-code';
      },
    });

    const tokens = await provider.authorize('android-client.apps.googleusercontent.com');
    expect(capturedUrl).toContain('accounts.google.com');
    expect(tokens.accessToken).toBe('ya29.flow');
    expect(loadPendingNativeAuth()).toBeNull();
  });

  it('maps access_denied redirect to cancelled error', () => {
    const err = rejectNativeOAuthRedirect('access_denied', 'User denied');
    expect(err).toBeInstanceOf(DriveCancelledError);
  });

  it('parses successful redirect URL', () => {
    const parsed = parseNativeOAuthRedirectUrl(
      'net.mm9pdy.codeplugstudio:/oauth2redirect?code=abc&state=xyz',
    );
    expect(parsed).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('parses error redirect URL', () => {
    const parsed = parseNativeOAuthRedirectUrl(
      'net.mm9pdy.codeplugstudio:/oauth2redirect?error=access_denied&state=xyz',
    );
    expect(parsed.error).toBe('access_denied');
    expect(parsed.state).toBe('xyz');
  });

  it('getGoogleAndroidClientId returns trimmed env value', () => {
    expect(getGoogleAndroidClientId()).toBe('');
  });

  it('tryRefresh returns null when refresh fails', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    })) as typeof fetch;

    const provider = createNativeAuthProvider({
      fetchImpl,
      openAuthorizationUrl: async () => {},
      waitForAuthorizationCode: async () => 'code',
    });

    const result = await provider.tryRefresh!(
      {
        accessToken: 'old',
        expiresAt: 0,
        refreshToken: 'bad-refresh',
      },
      'client-id',
    );
    expect(result).toBeNull();
  });

  it('pending auth is saved during authorize', async () => {
    const provider = createNativeAuthProvider({
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 't', expires_in: 3600 }),
      })) as typeof fetch,
      openAuthorizationUrl: async () => {},
      waitForAuthorizationCode: async () => {
        const pending = loadPendingNativeAuth();
        expect(pending?.codeVerifier).toBeTruthy();
        return 'code';
      },
    });

    await provider.authorize('client-id');
    expect(loadPendingNativeAuth()).toBeNull();
  });
});

describe('exchangeAuthorizationCode errors', () => {
  it('throws DriveAuthError on token error response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Bad code' }),
    })) as typeof fetch;

    await expect(
      exchangeAuthorizationCode({
        clientId: 'client',
        code: 'bad',
        codeVerifier: 'verifier',
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(DriveAuthError);
  });
});
