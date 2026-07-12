const CODEPLUG_APEX = 'codeplug.mm9pdy.net';

const LOCAL_DEV_ORIGIN = 'http://localhost:5173';

function isAllowedUrl(url: URL): boolean {
  const { hostname, protocol } = url;
  const port = url.port || (protocol === 'https:' ? '443' : '80');

  if (hostname === 'localhost') {
    return protocol === 'http:' && port === '5173';
  }

  if (protocol !== 'https:') {
    return false;
  }

  if (hostname === CODEPLUG_APEX) {
    return true;
  }

  return hostname.endsWith(`.${CODEPLUG_APEX}`);
}

/** Whether an Origin or Referer value is on the Codeplug Studio allowlist. */
export function isAllowedCodeplugOrigin(originOrReferer: string | null): boolean {
  if (!originOrReferer?.trim()) {
    return false;
  }

  try {
    return isAllowedUrl(new URL(originOrReferer.trim()));
  } catch {
    return false;
  }
}

/** Resolve a mirrorable ACAO value from Origin, then Referer. */
export function resolveAllowedRequestOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin');
  if (origin && isAllowedCodeplugOrigin(origin)) {
    return origin;
  }

  const referer = request.headers.get('Referer');
  if (referer && isAllowedCodeplugOrigin(referer)) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

export function corsHeadersForOrigin(origin: string | null): HeadersInit {
  if (origin && isAllowedCodeplugOrigin(origin)) {
    return { 'Access-Control-Allow-Origin': origin };
  }
  return {};
}

export function preflightHeaders(
  origin: string | null,
  allowedRequestHeaders?: string,
): HeadersInit {
  return {
    ...corsHeadersForOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    ...(allowedRequestHeaders ? { 'Access-Control-Allow-Headers': allowedRequestHeaders } : {}),
    'Access-Control-Max-Age': '86400',
  };
}

export function rejectResponse(
  status: number,
  message: string,
  origin: string | null = null,
): Response {
  return new Response(message, {
    status,
    headers: corsHeadersForOrigin(origin),
  });
}

/** Exported for tests and documentation. */
export const ALLOWED_LOCAL_DEV_ORIGIN = LOCAL_DEV_ORIGIN;
