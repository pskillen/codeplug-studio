import { RepeaterDirectoryError, type RepeaterListing } from './types.ts';

const BRANDMEISTER_API_BASE = 'https://api.brandmeister.network/v2';

/** Raw BrandMeister device shape (tx/rx are MHz strings). */
interface BrandMeisterDevice {
  id: number;
  callsign: string;
  tx?: string;
  rx?: string;
  colorcode?: number;
  lat?: number;
  lng?: number;
  city?: string;
  statusText?: string;
  status?: number;
}

function mhzStringToHz(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const mhz = Number.parseFloat(value);
  return Number.isFinite(mhz) && mhz > 0 ? Math.round(mhz * 1_000_000) : null;
}

function normalise(device: BrandMeisterDevice): RepeaterListing {
  const location =
    typeof device.lat === 'number' && typeof device.lng === 'number'
      ? { lat: device.lat, lon: device.lng }
      : null;
  return {
    source: 'brandmeister',
    remoteId: String(device.id),
    callsign: device.callsign,
    name: device.city ?? '',
    rxFrequencyHz: mhzStringToHz(device.tx),
    txFrequencyHz: mhzStringToHz(device.rx),
    toneHz: null,
    mode: 'dmr',
    colourCode: device.colorcode ?? null,
    locator: null,
    location,
    band: '',
    status: device.statusText ?? String(device.status ?? ''),
  };
}

export async function searchBrandmeisterByCallsign(callsign: string): Promise<RepeaterListing[]> {
  const q = encodeURIComponent(callsign.trim());
  let response: Response;
  try {
    response = await fetch(`${BRANDMEISTER_API_BASE}/device/byCall?callsign=${q}`);
  } catch {
    throw new RepeaterDirectoryError(
      'Could not reach BrandMeister — check your network connection.',
    );
  }
  if (!response.ok) {
    throw new RepeaterDirectoryError(`BrandMeister returned ${response.status}.`, response.status);
  }
  let parsed: BrandMeisterDevice[] | BrandMeisterDevice;
  try {
    parsed = (await response.json()) as BrandMeisterDevice[] | BrandMeisterDevice;
  } catch {
    throw new RepeaterDirectoryError('Invalid response from BrandMeister.');
  }
  const devices = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return devices.map(normalise);
}
