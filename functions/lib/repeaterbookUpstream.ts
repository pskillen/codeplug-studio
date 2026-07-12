export const REPEATERBOOK_USER_AGENT =
  'CodeplugStudio/1.0 (+https://codeplug.mm9pdy.net; mm9pdy@gmail.com)';

const REPEATERBOOK_EXPORT_NA_URL = 'https://www.repeaterbook.com/api/export.php';
const REPEATERBOOK_EXPORT_ROW_URL = 'https://www.repeaterbook.com/api/exportROW.php';

/** Query keys forwarded to RepeaterBook (excluding proxy routing `region=na|row`). */
export const REPEATERBOOK_PASSTHROUGH_PARAMS = [
  'callsign',
  'city',
  'landmark',
  'state_id',
  'country',
  'county',
  'frequency',
  'mode',
  'emcomm',
  'stype',
  'region',
] as const;

export type RepeaterBookExportRegion = 'na' | 'row';

export function buildRepeaterBookUpstreamUrl(
  region: RepeaterBookExportRegion,
  searchParams: URLSearchParams,
): URL {
  const base = region === 'na' ? REPEATERBOOK_EXPORT_NA_URL : REPEATERBOOK_EXPORT_ROW_URL;
  const upstream = new URL(base);

  for (const key of REPEATERBOOK_PASSTHROUGH_PARAMS) {
    const value = searchParams.get(key);
    if (value == null || value === '') {
      continue;
    }
    if (key === 'region' && (value === 'na' || value === 'row')) {
      continue;
    }
    upstream.searchParams.set(key, value);
  }

  return upstream;
}
