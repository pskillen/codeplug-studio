import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';

const AMSAT_NASABARE_TLE_URL = 'https://www.amsat.org/tle/current/nasabare.txt';

/**
 * Same-origin CORS bridge for the AMSAT current amateur-satellite TLE feed
 * (secondary fallback source when CelesTrak is unreachable).
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

  let upstream: Response;
  try {
    upstream = await fetch(AMSAT_NASABARE_TLE_URL, {
      headers: { Accept: 'text/plain,*/*' },
    });
  } catch {
    return rejectResponse(502, 'Could not reach AMSAT.', origin);
  }

  if (!upstream.ok) {
    return rejectResponse(502, `AMSAT returned ${upstream.status}.`, origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...corsHeadersForOrigin(origin),
    },
  });
}
