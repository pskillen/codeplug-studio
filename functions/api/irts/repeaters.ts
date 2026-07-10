const IRTS_ANYTONE_CSV_URL = 'https://www.irts.ie/dnloads/repeaters_Anytone578.csv';

/**
 * Same-origin CORS bridge for the IRTS Anytone repeater CSV.
 * Upstream is public; no secrets or operator API keys.
 */
export async function onRequestGet(): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(IRTS_ANYTONE_CSV_URL, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
    });
  } catch {
    return new Response('Could not reach IRTS repeater feed.', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`IRTS repeater feed returned ${upstream.status}.`, { status: 502 });
  }

  const body = await upstream.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
