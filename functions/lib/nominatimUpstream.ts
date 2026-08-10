/**
 * Identifying User-Agent required by Nominatim's usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/) — unlike CelesTrak/AMSAT,
 * Nominatim rejects/blocks requests without one.
 */
export const NOMINATIM_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

const NOMINATIM_MAX_RESULT_LIMIT = 10;

function clampLimit(value: string | null): string | null {
  if (value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return String(Math.min(parsed, NOMINATIM_MAX_RESULT_LIMIT));
}

/**
 * Build the upstream Nominatim search URL, forwarding only the query params Studio's
 * address search actually uses (`q`, `limit`). `format` is pinned server-side so Studio's
 * proxy always gets the same response shape regardless of client input — never forwards
 * anything beyond the search term itself (no operator/project data in the query).
 */
export function buildNominatimSearchUpstreamUrl(searchParams: URLSearchParams): URL {
  const upstream = new URL(NOMINATIM_SEARCH_URL);
  upstream.searchParams.set('format', 'jsonv2');

  const query = searchParams.get('q');
  if (query != null && query.trim()) {
    upstream.searchParams.set('q', query.trim());
  }

  const limit = clampLimit(searchParams.get('limit'));
  if (limit != null) {
    upstream.searchParams.set('limit', limit);
  }

  return upstream;
}
