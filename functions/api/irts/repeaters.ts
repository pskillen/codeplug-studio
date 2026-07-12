import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';

const IRTS_ANYTONE_CSV_URL = 'https://www.irts.ie/dnloads/repeaters_Anytone578.csv';

/**
 * Same-origin CORS bridge for the IRTS Anytone repeater CSV.
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

  let upstream: Response;
  try {
    upstream = await fetch(IRTS_ANYTONE_CSV_URL, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
    });
  } catch {
    return rejectResponse(502, 'Could not reach IRTS repeater feed.', origin);
  }

  if (!upstream.ok) {
    return rejectResponse(502, `IRTS repeater feed returned ${upstream.status}.`, origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...corsHeadersForOrigin(origin),
    },
  });
}
