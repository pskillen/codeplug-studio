/**
 * Read-only summary of an AT-D890UV sparse radio-clone hydration bag.
 */

import type { RadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  radioCloneHasSparseBlocks,
  radioCloneSparseBlockBytes,
} from '@core/models/radioCloneHydration.ts';
import { listSetBits } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { decodeChannelsFromAtD890Cache } from './channelCodec.ts';
import { cacheFromBag } from './hydration.ts';
import { getCacheBytes } from './memory.ts';
import {
  AT_D890_DIGITAL_CONTACTS_WRITE_GAP,
  AT_D890_WRITTEN_FROM_BUILD_LABELS,
  atD890RegionLabel,
  atD890WriteRole,
} from './writeRole.ts';

export interface AtD890RetainGroupSummary {
  label: string;
  blockCount: number;
  role: string;
}

export interface AtD890uvCloneSummary {
  radioModelId: string;
  firmware?: string;
  imageByteLength: number;
  capturedVia: RadioCloneHydrationBag['retain']['capturedVia'];
  channelCount: number;
  zoneCount: number;
  scanListCount: number;
  talkGroupCount: number;
  rxGroupCount: number;
  radioIdCount: number;
  writtenFromBuild: readonly string[];
  digitalContactsWriteGap: string;
  retainGroups: readonly AtD890RetainGroupSummary[];
  blockCount: number;
}

function retainRoleCopy(): string {
  return 'Kept from Read from radio — not changed when you write from your build';
}

export function summariseAtD890uvClone(bag: RadioCloneHydrationBag): AtD890uvCloneSummary | null {
  if (!radioCloneHasSparseBlocks(bag)) return null;
  const cache = cacheFromBag(bag);
  const channels = decodeChannelsFromAtD890Cache(cache);
  const zoneSet = getCacheBytes(cache, D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  const scanSet = getCacheBytes(cache, D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  const tgSet = getCacheBytes(cache, D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  const rxSet = getCacheBytes(cache, D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  const ridSet = getCacheBytes(cache, D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);

  const groups = new Map<string, { count: number; role: string }>();
  for (const b of radioCloneSparseBlockBytes(bag)) {
    const role = atD890WriteRole(b.address);
    if (role === 'replaced') continue;
    const label = atD890RegionLabel(b.address);
    const prev = groups.get(label);
    groups.set(label, {
      count: (prev?.count ?? 0) + 1,
      role: retainRoleCopy(),
    });
  }

  return {
    radioModelId: bag.retain.radioModelId,
    firmware: bag.retain.firmware,
    imageByteLength: bag.retain.imageByteLength,
    capturedVia: bag.retain.capturedVia,
    channelCount: channels.filter((c) => !c.empty).length,
    zoneCount: listSetBits(zoneSet).length,
    scanListCount: listSetBits(scanSet).length,
    talkGroupCount: listSetBits(tgSet, true).length,
    rxGroupCount: listSetBits(rxSet).length,
    radioIdCount: listSetBits(ridSet).length,
    writtenFromBuild: AT_D890_WRITTEN_FROM_BUILD_LABELS,
    digitalContactsWriteGap: AT_D890_DIGITAL_CONTACTS_WRITE_GAP,
    retainGroups: [...groups.entries()].map(([label, g]) => ({
      label,
      blockCount: g.count,
      role: g.role,
    })),
    blockCount: radioCloneSparseBlockBytes(bag).length,
  };
}
