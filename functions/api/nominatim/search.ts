import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';
import { buildNominatimSearchUpstreamUrl, NOMINATIM_USER_AGENT } from '../../lib/nominatimUpstream.ts';

/**
 * Same-origin CORS bridge for OpenStreetMap Nominatim address search. Upstream is public
 * but requires an identifying User-Agent (unlike CelesTrak/AMSAT) — see nominatimUpstream.ts.
 * No server-side rate limiting here; Nominatim's 1 req/s policy is enforced client-side via
 * debounce (see src/integrations/geocoding/nominatimClient.ts), matching every other proxy
 * in this repo.
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
  if (!requestUrl.searchParams.get('q')?.trim()) {
    return rejectResponse(400, 'Query parameter q is required.', origin);
  }

  const upstreamUrl = buildNominatimSearchUpstreamUrl(requestUrl.searchParams);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_USER_AGENT,
      },
    });
  } catch {
    return rejectResponse(502, 'Could not reach Nominatim.', origin);
  }

  if (!upstream.ok) {
    return rejectResponse(502, `Nominatim returned ${upstream.status}.`, origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...corsHeadersForOrigin(origin),
    },
  });
}
