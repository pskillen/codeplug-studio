import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../../lib/codeplugOrigin.ts';

const RADIOID_DMR_USER_UPSTREAM = 'https://database.radioid.net/api/dmr/user/';

/**
 * Same-origin CORS bridge for RadioID.net DMR user search.
 * Upstream is public; no secrets or operator API keys.
 */
export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const origin = resolveAllowedRequestOrigin(context.request);
  if (!origin) {
    return rejectResponse(403, 'Request not allowed from this origin.');
  }

  return new Response(null, {
    status: 204,
    headers: preflightHeaders(origin),
  });
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const origin = resolveAllowedRequestOrigin(context.request);
  if (!origin) {
    return rejectResponse(403, 'Request not allowed from this origin.');
  }

  const requestUrl = new URL(context.request.url);
  const upstreamUrl = new URL(RADIOID_DMR_USER_UPSTREAM);
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
    });
  } catch {
    return rejectResponse(502, 'Could not reach RadioID.net.', origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...corsHeadersForOrigin(origin),
    },
  });
}
