import { fetchDirectoryText } from './directoryFetch.ts';
import { BRANDMEISTER_CACHE_PREFIX } from './sessionCache.ts';
import { RepeaterDirectoryError, type RepeaterListing } from './types.ts';

const BRANDMEISTER_API_BASE = 'https://api.brandmeister.network/v2';

/**
 * BrandMeister returns this sentinel when a former device is no longer on the
 * network. Do not treat API `status` / `statusText` as the inactive signal —
 * retired devices can still report a misleading "linked" status.
 */
export const BRANDMEISTER_INACTIVE_LAST_KNOWN_MASTER = 9999;

/** Raw BrandMeister device shape (tx/rx are MHz strings). */
export interface BrandMeisterDevice {
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
  lastKnownMaster?: number;
}

function mhzStringToHz(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const mhz = Number.parseFloat(value);
  return Number.isFinite(mhz) && mhz > 0 ? Math.round(mhz * 1_000_000) : null;
}

/**
 * Former BrandMeister devices still return a callsign and id, but with zero
 * frequencies and lastKnownMaster 9999. `status` is not a reliable signal.
 */
export function isBrandMeisterDeviceInactive(device: BrandMeisterDevice): boolean {
  return (
    mhzStringToHz(device.tx) == null &&
    mhzStringToHz(device.rx) == null &&
    device.lastKnownMaster === BRANDMEISTER_INACTIVE_LAST_KNOWN_MASTER
  );
}

/** User-facing warning when BrandMeister only returns retired device rows. */
export function brandMeisterInactiveDeviceMessage(callsign: string): string {
  const call = callsign.trim() || 'this callsign';
  return `BrandMeister has no active device for ${call}. It may have left the network.`;
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
    rxToneHz: null,
    txToneHz: null,
    modes: ['dmr'],
    primaryMode: 'dmr',
    colourCode: device.colorcode ?? null,
    locator: null,
    location,
    band: '',
    status: device.statusText ?? String(device.status ?? ''),
  };
}

export async function searchBrandmeisterByCallsign(callsign: string): Promise<RepeaterListing[]> {
  const q = encodeURIComponent(callsign.trim());
  const url = `${BRANDMEISTER_API_BASE}/device/byCall?callsign=${q}`;
  const { body, status } = await fetchDirectoryText(url, {
    provider: 'brandmeister',
    cachePrefix: BRANDMEISTER_CACHE_PREFIX,
    networkErrorMessage: 'Could not reach BrandMeister — check your network connection.',
  });

  if (status < 200 || status >= 300) {
    throw new RepeaterDirectoryError(`BrandMeister returned ${status}.`, status);
  }

  let parsed: BrandMeisterDevice[] | BrandMeisterDevice;
  try {
    parsed = JSON.parse(body) as BrandMeisterDevice[] | BrandMeisterDevice;
  } catch {
    throw new RepeaterDirectoryError('Invalid response from BrandMeister.');
  }
  const devices = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const active = devices.filter((device) => !isBrandMeisterDeviceInactive(device));
  if (devices.length > 0 && active.length === 0) {
    throw new RepeaterDirectoryError(brandMeisterInactiveDeviceMessage(callsign));
  }
  return active.map(normalise);
}
