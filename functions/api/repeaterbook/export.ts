import {
  corsHeadersForOrigin,
  preflightHeaders,
  rejectResponse,
  resolveAllowedRequestOrigin,
} from '../../lib/codeplugOrigin.ts';
import {
  buildRepeaterBookUpstreamUrl,
  REPEATERBOOK_USER_AGENT,
  type RepeaterBookExportRegion,
} from '../../lib/repeaterbookUpstream.ts';

function parseExportRegion(value: string | null): RepeaterBookExportRegion | null {
  if (value === 'na' || value === 'row') {
    return value;
  }
  return null;
}

export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const origin = resolveAllowedRequestOrigin(context.request);
  if (!origin) {
    return rejectResponse(403, 'Request not allowed from this origin.');
  }

  return new Response(null, {
    status: 204,
    headers: preflightHeaders(origin, 'X-RB-App-Token'),
  });
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const origin = resolveAllowedRequestOrigin(request);
  if (!origin) {
    return rejectResponse(403, 'Request not allowed from this origin.');
  }

  const requestUrl = new URL(request.url);
  const region = parseExportRegion(requestUrl.searchParams.get('region'));
  if (!region) {
    return rejectResponse(400, 'Query parameter region must be na or row.', origin);
  }

  const token = request.headers.get('X-RB-App-Token')?.trim();
  if (!token) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'auth_missing',
        message: 'RepeaterBook token required.',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeadersForOrigin(origin),
        },
      },
    );
  }

  const upstreamUrl = buildRepeaterBookUpstreamUrl(region, requestUrl.searchParams);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': REPEATERBOOK_USER_AGENT,
        'X-RB-App-Token': token,
      },
    });
  } catch {
    return rejectResponse(502, 'Could not reach RepeaterBook.', origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeadersForOrigin(origin),
    },
  });
}
