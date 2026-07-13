import type { DMRTimeSlot } from '@core/models/libraryTypes.ts';
import { fetchDirectoryText } from './directoryFetch.ts';
import { BRANDMEISTER_CACHE_PREFIX } from './sessionCache.ts';
import { RepeaterDirectoryError } from './types.ts';

const BRANDMEISTER_API_BASE = 'https://api.brandmeister.network/v2';
const BRANDMEISTER_NETWORK_ERROR = 'Could not reach BrandMeister — check your network connection.';

/** Raw static talk group row from `GET /device/{id}/talkgroup`. */
export interface BrandMeisterStaticTalkGroup {
  talkgroup: string;
  slot: string;
  repeaterid: string;
}

/** Static talk group with resolved display name and parsed slot. */
export interface ResolvedBrandMeisterTalkGroup {
  digitalId: number;
  name: string;
  slot: DMRTimeSlot | null;
}

export type BrandMeisterTalkGroupLookupPhase = 'device' | 'catalogue' | 'resolving';

export interface BrandMeisterTalkGroupLookupProgress {
  phase: BrandMeisterTalkGroupLookupPhase;
  message: string;
  /** 0–100 for UI progress bars */
  percent: number;
  resolvedCount?: number;
  totalCount?: number;
}

export type BrandMeisterTalkGroupLookupProgressCallback = (
  progress: BrandMeisterTalkGroupLookupProgress,
) => void;

interface TalkGroupDetailResponse {
  ID: number;
  Name: string;
}

function parseSlot(value: string): DMRTimeSlot | null {
  const slot = Number.parseInt(value, 10);
  if (slot === 1 || slot === 2) return slot;
  return null;
}

function parseDigitalId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function fetchBrandmeisterText(path: string) {
  return fetchDirectoryText(`${BRANDMEISTER_API_BASE}${path}`, {
    provider: 'brandmeister',
    cachePrefix: BRANDMEISTER_CACHE_PREFIX,
    networkErrorMessage: BRANDMEISTER_NETWORK_ERROR,
  });
}

export async function fetchDeviceTalkGroups(
  deviceId: string,
): Promise<BrandMeisterStaticTalkGroup[]> {
  const { body, status } = await fetchBrandmeisterText(
    `/device/${encodeURIComponent(deviceId)}/talkgroup`,
  );

  if (status < 200 || status >= 300) {
    throw new RepeaterDirectoryError(`BrandMeister talk groups returned ${status}.`, status);
  }

  let parsed: BrandMeisterStaticTalkGroup[];
  try {
    parsed = JSON.parse(body) as BrandMeisterStaticTalkGroup[];
  } catch {
    throw new RepeaterDirectoryError('Invalid talk group response from BrandMeister.');
  }
  return Array.isArray(parsed) ? parsed : [];
}

export async function loadTalkGroupNameMap(): Promise<Map<number, string>> {
  const { body, status } = await fetchBrandmeisterText('/talkgroup');

  if (status < 200 || status >= 300) {
    throw new RepeaterDirectoryError(
      `BrandMeister talk group catalogue returned ${status}.`,
      status,
    );
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(body) as Record<string, string>;
  } catch {
    throw new RepeaterDirectoryError('Invalid talk group catalogue from BrandMeister.');
  }
  const map = new Map<number, string>();
  for (const [key, name] of Object.entries(parsed)) {
    const id = Number.parseInt(key, 10);
    if (Number.isFinite(id) && name.trim()) {
      map.set(id, name.trim());
    }
  }
  return map;
}

async function fetchTalkGroupDetail(digitalId: number): Promise<string | null> {
  try {
    const { body, status } = await fetchBrandmeisterText(`/talkgroup/${digitalId}`);
    if (status < 200 || status >= 300) return null;
    const parsed = JSON.parse(body) as TalkGroupDetailResponse;
    return parsed.Name?.trim() || null;
  } catch {
    return null;
  }
}

export async function resolveTalkGroupName(
  digitalId: number,
  nameMap: Map<number, string>,
): Promise<string> {
  const fromDetail = await fetchTalkGroupDetail(digitalId);
  if (fromDetail) return fromDetail;
  const fromMap = nameMap.get(digitalId);
  if (fromMap) return fromMap;
  return `TG ${digitalId}`;
}

export async function resolveDeviceTalkGroups(
  staticRows: BrandMeisterStaticTalkGroup[],
  nameMap?: Map<number, string>,
  onProgress?: BrandMeisterTalkGroupLookupProgressCallback,
): Promise<ResolvedBrandMeisterTalkGroup[]> {
  const map = nameMap ?? (await loadTalkGroupNameMap());
  const rows = staticRows
    .map((row) => ({ row, digitalId: parseDigitalId(row.talkgroup) }))
    .filter(
      (entry): entry is { row: BrandMeisterStaticTalkGroup; digitalId: number } =>
        entry.digitalId !== null,
    );
  const total = rows.length;

  onProgress?.({
    phase: 'resolving',
    message: total > 0 ? `Resolving talk group 1 of ${total}…` : 'Resolving talk group names…',
    percent: 40,
    resolvedCount: 0,
    totalCount: total,
  });

  const resolved: ResolvedBrandMeisterTalkGroup[] = [];
  for (let index = 0; index < rows.length; index++) {
    const { row, digitalId } = rows[index]!;
    const name = await resolveTalkGroupName(digitalId, map);
    resolved.push({
      digitalId,
      name,
      slot: parseSlot(row.slot),
    });
    onProgress?.({
      phase: 'resolving',
      message: `Resolving talk group ${index + 1} of ${total}…`,
      percent: 40 + Math.round((60 * (index + 1)) / total),
      resolvedCount: index + 1,
      totalCount: total,
    });
  }
  return resolved;
}

export async function fetchResolvedDeviceTalkGroups(
  deviceId: string,
  onProgress?: BrandMeisterTalkGroupLookupProgressCallback,
): Promise<ResolvedBrandMeisterTalkGroup[]> {
  onProgress?.({
    phase: 'device',
    message: 'Fetching repeater talk groups…',
    percent: 5,
  });
  const staticRows = await fetchDeviceTalkGroups(deviceId);
  onProgress?.({
    phase: 'device',
    message: 'Fetching repeater talk groups…',
    percent: 15,
  });
  if (staticRows.length === 0) return [];
  onProgress?.({
    phase: 'catalogue',
    message: 'Loading talk group catalogue…',
    percent: 20,
  });
  const nameMap = await loadTalkGroupNameMap();
  onProgress?.({
    phase: 'catalogue',
    message: 'Loading talk group catalogue…',
    percent: 40,
  });
  return resolveDeviceTalkGroups(staticRows, nameMap, onProgress);
}
