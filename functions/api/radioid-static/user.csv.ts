import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';

const RADIOID_USER_DUMP_UPSTREAM = 'https://radioid.net/static/user.csv';

const RADIOID_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

/**
 * Same-origin CORS bridge for RadioID.net daily user.csv dump.
 * Streams upstream body — do not buffer the full file in the Worker.
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
    upstream = await fetch(RADIOID_USER_DUMP_UPSTREAM, {
      headers: {
        Accept: 'text/csv',
        'User-Agent': RADIOID_USER_AGENT,
      },
    });
  } catch {
    return rejectResponse(502, 'Could not reach RadioID.net.', origin);
  }

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => '');
    return new Response(body || 'RadioID.net dump request failed.', {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, no-store',
        ...corsHeadersForOrigin(origin),
      },
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
    'Cache-Control': 'private, no-store',
    ...corsHeadersForOrigin(origin),
  };
  const contentLength = upstream.headers.get('Content-Length');
  if (contentLength) {
    headers['Content-Length'] = contentLength;
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
