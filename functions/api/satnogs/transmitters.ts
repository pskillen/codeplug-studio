import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';

const SATNOGS_TRANSMITTERS_UPSTREAM = 'https://db.satnogs.org/api/transmitters/';

/**
 * Same-origin CORS bridge for the SatNOGS DB transmitters endpoint. Upstream is public;
 * no secrets or operator API keys. Studio forwards `norad_cat_id` (and any other supported
 * query params, e.g. `format=json`) straight through — see
 * docs/reference/remote-directories/satnogs/README.md for the full param/response reference.
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
  const { request } = context;
  const origin = resolveAllowedRequestOrigin(request);
  if (!origin) {
    return rejectResponse(403, 'Request not allowed from this origin.');
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(SATNOGS_TRANSMITTERS_UPSTREAM);
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });
  // SatNOGS DB's DRF browsable API serves HTML without an explicit format; pin JSON unless
  // the caller already specified one.
  if (!upstreamUrl.searchParams.has('format')) {
    upstreamUrl.searchParams.set('format', 'json');
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
    });
  } catch {
    return rejectResponse(502, 'Could not reach SatNOGS DB.', origin);
  }

  if (!upstream.ok) {
    return rejectResponse(502, `SatNOGS DB returned ${upstream.status}.`, origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...corsHeadersForOrigin(origin),
    },
  });
}
