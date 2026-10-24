/**
 * Fetches the firmware project's public release index (`releases.json` in pskillen/mm9pdy-firmware) and its patches.
 * Read-only GETs of public files: nothing about the operator or the radio is sent, and nothing is stored. Core
 * parses and checks what comes back. See docs/features/firmware-flashing/releases.md.
 */
import { FirmwareError } from '@core/firmware/errors.ts';
import { parsePublishedReleaseIndex } from '@core/firmware/releases/index.ts';
import type { PublishedFirmwareRelease } from '@core/firmware/releases/types.ts';

export const DEFAULT_FIRMWARE_RELEASE_INDEX_URL =
  'https://raw.githubusercontent.com/pskillen/mm9pdy-firmware/main/releases.json';

/** `VITE_FIRMWARE_RELEASE_INDEX_URL` (e.g. a fork or a local server), else the public repository. */
export function firmwareReleaseIndexUrl(): string {
  return (
    import.meta.env.VITE_FIRMWARE_RELEASE_INDEX_URL?.trim() || DEFAULT_FIRMWARE_RELEASE_INDEX_URL
  );
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const UNAVAILABLE =
  'The firmware release list could not be downloaded. Check your connection and try again.';

async function get(fetchImpl: FetchLike, url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, { cache: 'no-cache', credentials: 'omit' });
  } catch {
    throw new FirmwareError('patch-unreadable', UNAVAILABLE);
  }
  if (!res.ok) throw new FirmwareError('patch-unreadable', `${UNAVAILABLE} (HTTP ${res.status})`);
  return res;
}

/**
 * A loader for the published rows: one fetch per page load, shared by every caller. A failed fetch is not cached,
 * so the next call tries again. Patch paths resolve against the index URL.
 */
export function createPublicReleaseIndexLoader(
  indexUrl: string = firmwareReleaseIndexUrl(),
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): () => Promise<readonly PublishedFirmwareRelease[]> {
  let pending: Promise<readonly PublishedFirmwareRelease[]> | null = null;
  const loadPatchBytes = async (patchPath: string) => {
    const res = await get(fetchImpl, new URL(patchPath, indexUrl).href);
    return new Uint8Array(await res.arrayBuffer());
  };
  return () => {
    pending ??= (async () => {
      const res = await get(fetchImpl, indexUrl);
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new FirmwareError('patch-unreadable', 'The firmware release list is not valid JSON.');
      }
      return parsePublishedReleaseIndex(json, { loadPatchBytes });
    })().catch((err: unknown) => {
      pending = null;
      throw err;
    });
    return pending;
  };
}
