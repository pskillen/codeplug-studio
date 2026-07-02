import type { DMRTimeSlot } from '@core/models/libraryTypes.ts';
import { RepeaterDirectoryError } from './types.ts';

const BRANDMEISTER_API_BASE = 'https://api.brandmeister.network/v2';

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

export async function fetchDeviceTalkGroups(
  deviceId: string,
): Promise<BrandMeisterStaticTalkGroup[]> {
  let response: Response;
  try {
    response = await fetch(
      `${BRANDMEISTER_API_BASE}/device/${encodeURIComponent(deviceId)}/talkgroup`,
    );
  } catch {
    throw new RepeaterDirectoryError(
      'Could not reach BrandMeister — check your network connection.',
    );
  }
  if (!response.ok) {
    throw new RepeaterDirectoryError(
      `BrandMeister talk groups returned ${response.status}.`,
      response.status,
    );
  }
  let parsed: BrandMeisterStaticTalkGroup[];
  try {
    parsed = (await response.json()) as BrandMeisterStaticTalkGroup[];
  } catch {
    throw new RepeaterDirectoryError('Invalid talk group response from BrandMeister.');
  }
  return Array.isArray(parsed) ? parsed : [];
}

export async function loadTalkGroupNameMap(): Promise<Map<number, string>> {
  let response: Response;
  try {
    response = await fetch(`${BRANDMEISTER_API_BASE}/talkgroup`);
  } catch {
    throw new RepeaterDirectoryError(
      'Could not reach BrandMeister — check your network connection.',
    );
  }
  if (!response.ok) {
    throw new RepeaterDirectoryError(
      `BrandMeister talk group catalogue returned ${response.status}.`,
      response.status,
    );
  }
  let parsed: Record<string, string>;
  try {
    parsed = (await response.json()) as Record<string, string>;
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
  let response: Response;
  try {
    response = await fetch(`${BRANDMEISTER_API_BASE}/talkgroup/${digitalId}`);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const parsed = (await response.json()) as TalkGroupDetailResponse;
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
): Promise<ResolvedBrandMeisterTalkGroup[]> {
  const map = nameMap ?? (await loadTalkGroupNameMap());
  const resolved: ResolvedBrandMeisterTalkGroup[] = [];
  for (const row of staticRows) {
    const digitalId = parseDigitalId(row.talkgroup);
    if (digitalId === null) continue;
    const name = await resolveTalkGroupName(digitalId, map);
    resolved.push({
      digitalId,
      name,
      slot: parseSlot(row.slot),
    });
  }
  return resolved;
}

export async function fetchResolvedDeviceTalkGroups(
  deviceId: string,
): Promise<ResolvedBrandMeisterTalkGroup[]> {
  const staticRows = await fetchDeviceTalkGroups(deviceId);
  if (staticRows.length === 0) return [];
  const nameMap = await loadTalkGroupNameMap();
  return resolveDeviceTalkGroups(staticRows, nameMap);
}
