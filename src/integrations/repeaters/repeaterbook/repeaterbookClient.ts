import { fetchDirectoryText } from '../directoryFetch.ts';
import { recordRateLimit } from '../rateLimit.ts';
import { REPEATERBOOK_CACHE_PREFIX } from '../sessionCache.ts';
import { RepeaterDirectoryError, type RepeaterListing } from '../types.ts';
import { REPEATERBOOK_EXPORT_PROXY_PATH } from './constants.ts';
import { parseRepeaterBookListings } from './parseListing.ts';

interface RepeaterBookErrorBody {
  status?: string;
  message?: string;
  code?: string;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_missing: 'RepeaterBook token required — add your token in Settings.',
  auth_invalid: 'RepeaterBook token is invalid — check Settings.',
  auth_inactive: 'RepeaterBook token or application is inactive.',
  auth_revoked: 'RepeaterBook token has been revoked — generate a new token.',
  auth_scope_denied: 'RepeaterBook token is not approved for this region — check your scopes.',
  ua_mismatch: 'RepeaterBook rejected the request User-Agent — report this to Codeplug Studio.',
  rate_limited: 'RepeaterBook rate limit reached — wait before searching again.',
  origin_forbidden: 'Request not allowed from this origin.',
};

function tokenPrefix(token: string): string {
  const trimmed = token.trim();
  return trimmed.slice(0, 8) || 'empty';
}

function requireToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new RepeaterDirectoryError(ERROR_MESSAGES.auth_missing!);
  }
  return trimmed;
}

function errorMessageFromBody(body: RepeaterBookErrorBody, status: number): string {
  const code = body.code ?? body.error;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]!;
  if (body.message?.trim()) return body.message.trim();
  if (status === 429) return ERROR_MESSAGES.rate_limited!;
  return `RepeaterBook returned ${status}.`;
}

function isRepeaterBookRateLimitResponse(_status: number, body: string): boolean {
  try {
    const parsed = JSON.parse(body) as RepeaterBookErrorBody;
    const code = parsed.code ?? parsed.error;
    return code === 'rate_limited';
  } catch {
    return false;
  }
}

function parseExportBody(body: string): RepeaterListing[] {
  let parsed: RepeaterBookErrorBody & { results?: unknown[] };
  try {
    parsed = JSON.parse(body) as RepeaterBookErrorBody & { results?: unknown[] };
  } catch {
    throw new RepeaterDirectoryError('Invalid response from RepeaterBook.');
  }

  if (parsed.status === 'error') {
    const code = parsed.code ?? parsed.error;
    if (code === 'rate_limited') {
      recordRateLimit('repeaterbook');
      throw new RepeaterDirectoryError(ERROR_MESSAGES.rate_limited!, 429);
    }
    throw new RepeaterDirectoryError(errorMessageFromBody(parsed, 400), 400);
  }

  if (!Array.isArray(parsed.results)) {
    throw new RepeaterDirectoryError('Unexpected response from RepeaterBook.');
  }

  return parseRepeaterBookListings(parsed.results);
}

export async function fetchRepeaterBookExport(
  url: string,
  token: string,
): Promise<RepeaterListing[]> {
  const appToken = requireToken(token);
  const { body, status } = await fetchDirectoryText(url, {
    provider: 'repeaterbook',
    cachePrefix: REPEATERBOOK_CACHE_PREFIX,
    cacheKeySuffix: tokenPrefix(appToken),
    init: {
      headers: {
        'X-RB-App-Token': appToken,
        Accept: 'application/json',
      },
    },
    networkErrorMessage: 'Could not reach RepeaterBook — check your network connection.',
    isRateLimitResponse: isRepeaterBookRateLimitResponse,
  });

  if (status === 403) {
    throw new RepeaterDirectoryError(ERROR_MESSAGES.origin_forbidden!);
  }

  if (status < 200 || status >= 300) {
    let parsed: RepeaterBookErrorBody = {};
    try {
      parsed = JSON.parse(body) as RepeaterBookErrorBody;
    } catch {
      // use generic message below
    }
    throw new RepeaterDirectoryError(errorMessageFromBody(parsed, status), status);
  }

  return parseExportBody(body);
}

export function buildRepeaterBookExportUrl(
  region: 'na' | 'row',
  params: Record<string, string>,
): string {
  const search = new URLSearchParams();
  search.set('region', region);
  for (const [key, value] of Object.entries(params)) {
    const trimmed = value.trim();
    if (trimmed) search.set(key, trimmed);
  }
  return `${REPEATERBOOK_EXPORT_PROXY_PATH}?${search.toString()}`;
}

export async function searchRepeaterBookByCallsign(
  callsign: string,
  token: string,
  region: 'na' | 'row' = 'na',
): Promise<RepeaterListing[]> {
  const trimmed = callsign.trim();
  if (!trimmed) return [];
  const url = buildRepeaterBookExportUrl(region, { callsign: trimmed });
  return fetchRepeaterBookExport(url, token);
}

async function searchRepeaterBookByCallsignRegion(
  callsign: string,
  token: string,
  region: 'na' | 'row',
): Promise<RepeaterListing[]> {
  try {
    return await searchRepeaterBookByCallsign(callsign, token, region);
  } catch (err) {
    if (
      err instanceof RepeaterDirectoryError &&
      err.message.includes('not approved for this region')
    ) {
      return [];
    }
    throw err;
  }
}

/** Search NA and ROW export endpoints; ignores scope-denied on either region. */
export async function searchRepeaterBookByCallsignAnyRegion(
  callsign: string,
  token: string,
): Promise<RepeaterListing[]> {
  const [na, row] = await Promise.all([
    searchRepeaterBookByCallsignRegion(callsign, token, 'na'),
    searchRepeaterBookByCallsignRegion(callsign, token, 'row'),
  ]);
  return [...na, ...row];
}
