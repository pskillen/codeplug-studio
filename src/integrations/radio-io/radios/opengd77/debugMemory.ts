/**
 * Read-only OpenGD77 channel and zone inventory projected from a debug archive's captured FLASH
 * spans (DM-1701 and MD-9600).
 *
 * Pure: it takes the manifest and the region bytes, never a library, build or React type. Coverage
 * is the bytes actually captured. The image starts at 0xFF fill, which is never evidence, so a
 * bank or section that was not captured is reported as such and never decoded as empty.
 * Wire facts: docs/reference/radios/opengd77/debug-memory.md.
 */
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  OPENGD77_BACKUP_USER_DATABASE_ID,
} from './backupRestoreRoles.ts';
import { decodeChannelsFromImage } from './channelCodec.ts';
import {
  OPENGD77_CALIBRATION_REGION_ID,
  OPENGD77_CHANNEL_BANKS,
  OPENGD77_CHANNEL_BANK_BITMAP,
  OPENGD77_CHANNEL_BANK_RECORDS,
  OPENGD77_CHANNEL_BANK_SIZE,
  OPENGD77_CHANNEL_SLOTS,
  OPENGD77_CHANNELS_PER_BANK,
  OPENGD77_ZONE_BANK_BITMAP,
  OPENGD77_ZONE_BANK_SIZE,
  OPENGD77_ZONE_BANK_ZONES,
  OPENGD77_ZONE_COUNT,
  OPENGD77_ZONE_SIZE,
  OPENUV380_OFFSET,
  openUv380ChannelBankAbs,
} from './constants.ts';
import { openGd77DebugModel } from './debugCoverage.ts';
import { createOpenUv380Image, readAbs, writeAbs } from './memory.ts';
import { decodeZoneChannelNumbers, decodeZoneRecord } from './zoneCodec.ts';

export interface OpenGd77MemoryArchive {
  manifest: RadioBackupManifestV1;
  regions: Record<string, Uint8Array>;
}

export interface OpenGd77Refused {
  id: string;
  reason: string;
}

export interface OpenGd77CapturedImage {
  /** 0xFF-filled outside the accepted regions: read it only where `covers` is true. */
  image: MemoryMap;
  /** True only when every byte of `[abs, abs + length)` lies in accepted regions. */
  covers(abs: number, length: number): boolean;
  /** Merged captured ranges (`end` exclusive), ascending. */
  ranges: { start: number; end: number }[];
  refused: OpenGd77Refused[];
}

/**
 * Place the registered, length-matched `flash-span-N` regions into an image. A Backup ZIP
 * (restorable) and a debug read (inspect-only) are both valid reads. Anything else that is not
 * the User Database or the calibration working copy is refused whole, with a reason.
 */
export function openGd77CapturedImage(archive: OpenGd77MemoryArchive): OpenGd77CapturedImage {
  const image = createOpenUv380Image();
  const refused: OpenGd77Refused[] = [];
  const accepted: { start: number; end: number }[] = [];
  const idCounts = new Map<string, number>();
  for (const r of archive.manifest.regions) idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);

  for (const region of archive.manifest.regions) {
    const span = OPENGD77_BACKUP_FLASH_SPANS.find((s) => s.id === region.id);
    if (!span) {
      if (
        region.id === OPENGD77_BACKUP_USER_DATABASE_ID ||
        region.id === OPENGD77_CALIBRATION_REGION_ID
      )
        continue;
      refused.push({ id: region.id, reason: 'not a registered FLASH span' });
      continue;
    }
    const reason = (() => {
      if ((idCounts.get(region.id) ?? 0) > 1) return 'duplicate entry for this span';
      if (region.address !== span.start) return 'address does not match the registered span start';
      if (region.byteLength <= 0 || region.byteLength > span.length)
        return `length ${region.byteLength} is outside the span length ${span.length}`;
      if (region.path !== `regions/${region.id}.bin`) return 'unexpected path';
      const bytes = archive.regions[region.id];
      if (!bytes || bytes.length !== region.byteLength)
        return 'stored bytes do not match the declared length';
      return undefined;
    })();
    if (reason) {
      refused.push({ id: region.id, reason });
      continue;
    }
    const range = { start: region.address, end: region.address + region.byteLength };
    if (accepted.some((a) => range.start < a.end && a.start < range.end)) {
      refused.push({ id: region.id, reason: 'overlaps another accepted region' });
      continue;
    }
    writeAbs(image, region.address, archive.regions[region.id]!);
    accepted.push(range);
  }

  const ranges: { start: number; end: number }[] = [];
  for (const r of [...accepted].sort((a, b) => a.start - b.start)) {
    const last = ranges[ranges.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else ranges.push({ ...r });
  }
  return {
    image,
    ranges,
    refused,
    covers: (abs, length) =>
      length > 0 && ranges.some((r) => abs >= r.start && abs + length <= r.end),
  };
}

export interface OpenGd77ChannelBank {
  bank: number;
  /** One-based, never renumbered. */
  firstSlot: number;
  lastSlot: number;
  status: 'captured' | 'not-captured';
}

export interface OpenGd77ChannelEntry {
  slot: number;
  /** `occupied-empty-record`: the bitmap marks the slot occupied but the record decodes empty. */
  state: 'decoded' | 'occupied-empty-record';
  channel: RadioChannelDto;
}

export type OpenGd77MemberStatus =
  'resolved' | 'absent' | 'empty-record' | 'not-captured' | 'out-of-range';

export interface OpenGd77ZoneMember {
  position: number;
  channelNumber: number;
  status: OpenGd77MemberStatus;
  channelName?: string;
}

export interface OpenGd77ZoneEntry {
  /** One-based zone bank slot. */
  slot: number;
  /** Null when the bitmap marks the zone but its name is empty. */
  name: string | null;
  members: OpenGd77ZoneMember[];
}

export interface OpenGd77MemoryInventory {
  status: 'ok';
  channels: {
    banks: OpenGd77ChannelBank[];
    entries: OpenGd77ChannelEntry[];
    occupied: number;
    decoded: number;
    emptySlots: number;
    notCapturedSlots: number;
    capacity: number;
  };
  zones: {
    status: 'captured' | 'not-captured';
    entries: OpenGd77ZoneEntry[];
    capacity: number;
  };
  refused: OpenGd77Refused[];
}

export type OpenGd77MemoryProjection =
  OpenGd77MemoryInventory | { status: 'unavailable'; reason: string; refused: OpenGd77Refused[] };

const bitSet = (bytes: Uint8Array, base: number, index: number) =>
  ((bytes[base + Math.floor(index / 8)]! >> (index % 8)) & 1) === 1;

export function projectOpenGd77Memory(
  archive: OpenGd77MemoryArchive,
  modelId: string,
): OpenGd77MemoryProjection {
  const captured = openGd77CapturedImage(archive);
  const model = openGd77DebugModel(modelId);
  if (!model)
    return {
      status: 'unavailable',
      reason: `${modelId} is not an OpenGD77 model with a debug page`,
      refused: captured.refused,
    };
  const { image, covers } = captured;
  const decoded = decodeChannelsFromImage(image, model.powerSteps);

  const banks: OpenGd77ChannelBank[] = [];
  const entries: OpenGd77ChannelEntry[] = [];
  const capturedBanks = new Set<number>();
  let emptySlots = 0;
  let notCapturedSlots = 0;
  for (let bank = 0; bank < OPENGD77_CHANNEL_BANKS; bank++) {
    const abs = openUv380ChannelBankAbs(bank);
    const firstSlot = bank * OPENGD77_CHANNELS_PER_BANK + 1;
    const lastSlot = firstSlot + OPENGD77_CHANNELS_PER_BANK - 1;
    if (!covers(abs, OPENGD77_CHANNEL_BANK_SIZE)) {
      banks.push({ bank, firstSlot, lastSlot, status: 'not-captured' });
      notCapturedSlots += OPENGD77_CHANNELS_PER_BANK;
      continue;
    }
    banks.push({ bank, firstSlot, lastSlot, status: 'captured' });
    capturedBanks.add(bank);
    const bitmap = readAbs(
      image,
      abs + OPENGD77_CHANNEL_BANK_BITMAP,
      OPENGD77_CHANNEL_BANK_RECORDS,
    );
    for (let i = 0; i < OPENGD77_CHANNELS_PER_BANK; i++) {
      if (!bitSet(bitmap, 0, i)) {
        emptySlots++;
        continue;
      }
      const slot = firstSlot + i;
      const channel = decoded[slot - 1]!;
      entries.push({
        slot,
        state: channel.empty ? 'occupied-empty-record' : 'decoded',
        channel,
      });
    }
  }

  const bySlot = new Map(entries.map((e) => [e.slot, e]));
  const resolve = (channelNumber: number): Pick<OpenGd77ZoneMember, 'status' | 'channelName'> => {
    if (channelNumber < 1 || channelNumber > OPENGD77_CHANNEL_SLOTS)
      return { status: 'out-of-range' };
    const bank = Math.floor((channelNumber - 1) / OPENGD77_CHANNELS_PER_BANK);
    if (!capturedBanks.has(bank)) return { status: 'not-captured' };
    const entry = bySlot.get(channelNumber);
    if (!entry) return { status: 'absent' };
    if (entry.state === 'occupied-empty-record') return { status: 'empty-record' };
    return { status: 'resolved', channelName: entry.channel.wireName };
  };

  const zoneEntries: OpenGd77ZoneEntry[] = [];
  const zoneCaptured = covers(OPENUV380_OFFSET.zoneBank, OPENGD77_ZONE_BANK_SIZE);
  if (zoneCaptured) {
    const bank = readAbs(image, OPENUV380_OFFSET.zoneBank, OPENGD77_ZONE_BANK_SIZE);
    for (let i = 0; i < OPENGD77_ZONE_COUNT; i++) {
      if (!bitSet(bank, OPENGD77_ZONE_BANK_BITMAP, i)) continue;
      const off = OPENGD77_ZONE_BANK_ZONES + i * OPENGD77_ZONE_SIZE;
      const raw = bank.subarray(off, off + OPENGD77_ZONE_SIZE);
      const zone = decodeZoneRecord(raw);
      const numbers = zone ? zone.channelNumbers : decodeZoneChannelNumbers(raw);
      zoneEntries.push({
        slot: i + 1,
        name: zone ? zone.wireName : null,
        members: numbers.map((channelNumber, p) => ({
          position: p + 1,
          channelNumber,
          ...resolve(channelNumber),
        })),
      });
    }
  }

  return {
    status: 'ok',
    channels: {
      banks,
      entries,
      occupied: entries.length,
      decoded: entries.filter((e) => e.state === 'decoded').length,
      emptySlots,
      notCapturedSlots,
      capacity: OPENGD77_CHANNEL_SLOTS,
    },
    zones: {
      status: zoneCaptured ? 'captured' : 'not-captured',
      entries: zoneEntries,
      capacity: OPENGD77_FAMILY_LIMITS.ZONE_MAX,
    },
    refused: captured.refused,
  };
}
