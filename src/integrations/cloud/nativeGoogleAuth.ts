import type { DriveAuthProvider, DriveAuthTokens } from './driveAuthProvider.ts';
import {
  clearPendingNativeAuth,
  loadPendingNativeAuth,
  savePendingNativeAuth,
  type DriveSession,
} from './drivePrefs.ts';
import {
  DriveAuthError,
  DriveCancelledError,
  DRIVE_OAUTH_SCOPE,
} from './driveTypes.ts';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from './pkce.ts';

export const NATIVE_OAUTH_REDIRECT_URI = 'net.mm9pdy.codeplugstudio:/oauth2redirect';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export function getGoogleAndroidClientId(): string {
  return import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? '';
}

export function buildAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: params.scope,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

interface TokenResponseBody {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

function tokensFromResponse(body: TokenResponseBody): DriveAuthTokens {
  if (body.error) {
    throw new DriveAuthError(body.error_description ?? body.error);
  }
  if (!body.access_token) {
    throw new DriveAuthError('No access token returned.');
  }
  const expiresInMs = (body.expires_in ?? 3600) * 1000;
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresInMs,
    refreshToken: body.refresh_token,
  };
}

export async function exchangeAuthorizationCode(params: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri?: string;
  fetchImpl?: typeof fetch;
}): Promise<DriveAuthTokens> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      redirect_uri: params.redirectUri ?? NATIVE_OAUTH_REDIRECT_URI,
      code_verifier: params.codeVerifier,
    }),
  });
  const body = (await response.json()) as TokenResponseBody;
  if (!response.ok && !body.error) {
    throw new DriveAuthError(`Token exchange failed (${response.status}).`);
  }
  return tokensFromResponse(body);
}

export async function refreshAccessToken(params: {
  clientId: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<DriveAuthTokens> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
      client_id: params.clientId,
    }),
  });
  const body = (await response.json()) as TokenResponseBody;
  if (!response.ok && !body.error) {
    throw new DriveAuthError(`Token refresh failed (${response.status}).`);
  }
  const tokens = tokensFromResponse(body);
  return {
    ...tokens,
    refreshToken: tokens.refreshToken ?? params.refreshToken,
  };
}

export async function revokeToken(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!response.ok) {
    throw new DriveAuthError(`Token revoke failed (${response.status}).`);
  }
}

export interface NativeGoogleAuthDeps {
  fetchImpl: typeof fetch;
  openAuthorizationUrl: (url: string) => Promise<void>;
  waitForAuthorizationCode: (state: string) => Promise<string>;
  closeBrowser?: () => Promise<void>;
}

export function createNativeAuthProvider(
  deps?: Partial<NativeGoogleAuthDeps>,
): DriveAuthProvider {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const openAuthorizationUrl = deps?.openAuthorizationUrl;
  const waitForAuthorizationCode = deps?.waitForAuthorizationCode;
  const closeBrowser = deps?.closeBrowser;

  if (!openAuthorizationUrl || !waitForAuthorizationCode) {
    throw new Error('Native auth provider requires openAuthorizationUrl and waitForAuthorizationCode.');
  }

  return {
    async authorize(clientId) {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = generateOAuthState();
      savePendingNativeAuth({ state, codeVerifier: verifier, createdAt: Date.now() });

      const url = buildAuthorizationUrl({
        clientId,
        redirectUri: NATIVE_OAUTH_REDIRECT_URI,
        scope: DRIVE_OAUTH_SCOPE,
        state,
        codeChallenge: challenge,
      });

      await openAuthorizationUrl(url);

      try {
        const code = await waitForAuthorizationCode(state);
        clearPendingNativeAuth();
        if (closeBrowser) {
          await closeBrowser();
        }
        return await exchangeAuthorizationCode({
          clientId,
          code,
          codeVerifier: verifier,
          fetchImpl,
        });
      } catch (error) {
        clearPendingNativeAuth();
        if (closeBrowser) {
          await closeBrowser();
        }
        throw error;
      }
    },

    async revoke(session: DriveSession) {
      try {
        if (session.accessToken) {
          await revokeToken(session.accessToken, fetchImpl);
        }
        if (session.refreshToken) {
          await revokeToken(session.refreshToken, fetchImpl);
        }
      } catch {
        // Best-effort revoke.
      }
    },

    async tryRefresh(session, clientId) {
      if (!session.refreshToken) return null;
      try {
        return await refreshAccessToken({
          clientId,
          refreshToken: session.refreshToken,
          fetchImpl,
        });
      } catch {
        return null;
      }
    },
  };
}

/** Complete a pending native auth from stored prefs (cold-start redirect). */
export async function completePendingNativeAuthFromPrefs(params: {
  clientId: string;
  code: string;
  state: string;
  fetchImpl?: typeof fetch;
}): Promise<DriveAuthTokens | null> {
  const pending = loadPendingNativeAuth();
  if (!pending || pending.state !== params.state) {
    return null;
  }
  clearPendingNativeAuth();
  return exchangeAuthorizationCode({
    clientId: params.clientId,
    code: params.code,
    codeVerifier: pending.codeVerifier,
    fetchImpl: params.fetchImpl,
  });
}

export function parseNativeOAuthRedirectUrl(url: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'net.mm9pdy.codeplugstudio:') {
      return {};
    }
    const query = parsed.searchParams;
    const error = query.get('error') ?? undefined;
    if (error) {
      return {
        error,
        errorDescription: query.get('error_description') ?? undefined,
        state: query.get('state') ?? undefined,
      };
    }
    const code = query.get('code');
    const state = query.get('state');
    if (!code || !state) return {};
    return { code, state };
  } catch {
    return {};
  }
}

export function rejectNativeOAuthRedirect(error: string, description?: string): DriveCancelledError {
  if (error === 'access_denied') {
    return new DriveCancelledError(description);
  }
  return new DriveCancelledError(description ?? error);
}
