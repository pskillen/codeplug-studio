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
import {
  AT_D890_NOT_IN_CAPTURE,
  alarmRetainPreview,
  localInfoRegisterPreview,
  optionalSettingsAprsPreview,
  optionalSettingsRetainPreview,
  settingsRetainPreview,
  type AtD890RegisterRow,
  type AtD890RetainPreviewRow,
} from './retainPreview.ts';

export interface AtD890RetainGroupSummary {
  label: string;
  blockCount: number;
  role: string;
  /** Inclusive address span of chunks in this group (hex). */
  addressRange: string;
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
  /** Decoded LocalInfo ExpertOptions fields (read for preview; not serial-written). */
  settingsRetain: readonly AtD890RetainPreviewRow[];
  /** Decoded optional settings forensic fields (never serial-written). */
  optionalSettingsRetain: readonly AtD890RetainPreviewRow[];
  /** APRS optional buffer hex preview. */
  optionalSettingsAprs: readonly AtD890RetainPreviewRow[];
  /** Light alarm forensic rows (never serial-written). */
  alarmRetain: readonly AtD890RetainPreviewRow[];
  /** LocalInfo as 16-byte register rows. */
  localInfoRegisters: readonly AtD890RegisterRow[];
  /** Documented regions Studio does not Read today. */
  notInCapture: typeof AT_D890_NOT_IN_CAPTURE;
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

  const groups = new Map<
    string,
    { count: number; role: string; minAddr: number; maxAddr: number }
  >();
  for (const b of radioCloneSparseBlockBytes(bag)) {
    const role = atD890WriteRole(b.address);
    if (role === 'replaced') continue;
    const label = atD890RegionLabel(b.address);
    const end = b.address + b.data.length - 1;
    const prev = groups.get(label);
    groups.set(label, {
      count: (prev?.count ?? 0) + 1,
      role: retainRoleCopy(),
      minAddr: prev ? Math.min(prev.minAddr, b.address) : b.address,
      maxAddr: prev ? Math.max(prev.maxAddr, end) : end,
    });
  }

  const localInfo = getCacheBytes(cache, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
  const hasLocalInfo = [...cache.blocks.keys()].some(
    (addr) => addr >= D890_MAP.LocalInfo && addr < D890_MAP.LocalInfo + D890_MAP.LocalInfoLength,
  );
  const optionalMain = getCacheBytes(
    cache,
    D890_MAP.OptionalSettingsMain,
    D890_MAP.OptionalSettingsMainLength,
  );
  const optionalExt = getCacheBytes(
    cache,
    D890_MAP.OptionalSettingsExt,
    D890_MAP.OptionalSettingsExtLength,
  );
  const optionalAprs = getCacheBytes(
    cache,
    D890_MAP.OptionalSettingsAprs,
    D890_MAP.OptionalSettingsAprsLength,
  );
  const alarmBitmap = getCacheBytes(cache, D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength);
  const alarmData = getCacheBytes(cache, D890_MAP.AlarmData, D890_MAP.AlarmDataLength);
  const hasOptionalMain = [...cache.blocks.keys()].some(
    (addr) =>
      addr >= D890_MAP.OptionalSettingsMain &&
      addr < D890_MAP.OptionalSettingsMain + D890_MAP.OptionalSettingsMainLength,
  );
  const hasOptionalExt = [...cache.blocks.keys()].some(
    (addr) =>
      addr >= D890_MAP.OptionalSettingsExt &&
      addr < D890_MAP.OptionalSettingsExt + D890_MAP.OptionalSettingsExtLength,
  );
  const hasOptionalAprs = [...cache.blocks.keys()].some(
    (addr) =>
      addr >= D890_MAP.OptionalSettingsAprs &&
      addr < D890_MAP.OptionalSettingsAprs + D890_MAP.OptionalSettingsAprsLength,
  );
  const hasAlarm =
    [...cache.blocks.keys()].some(
      (addr) =>
        addr >= D890_MAP.AlarmBitmap && addr < D890_MAP.AlarmBitmap + D890_MAP.AlarmBitmapLength,
    ) ||
    [...cache.blocks.keys()].some(
      (addr) => addr >= D890_MAP.AlarmData && addr < D890_MAP.AlarmData + D890_MAP.AlarmDataLength,
    );

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
      addressRange: `0x${g.minAddr.toString(16).toLowerCase()}…0x${g.maxAddr.toString(16).toLowerCase()}`,
    })),
    settingsRetain: hasLocalInfo ? settingsRetainPreview(localInfo) : [],
    optionalSettingsRetain:
      hasOptionalMain || hasOptionalExt
        ? optionalSettingsRetainPreview(optionalMain, optionalExt)
        : [],
    optionalSettingsAprs: hasOptionalAprs ? optionalSettingsAprsPreview(optionalAprs) : [],
    alarmRetain: hasAlarm ? alarmRetainPreview(optionalMain, alarmBitmap, alarmData) : [],
    localInfoRegisters: hasLocalInfo ? localInfoRegisterPreview(localInfo) : [],
    notInCapture: AT_D890_NOT_IN_CAPTURE,
    blockCount: radioCloneSparseBlockBytes(bag).length,
  };
}
