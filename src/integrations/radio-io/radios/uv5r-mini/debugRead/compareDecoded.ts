/**
 * UV-5R Mini captures as decoded records for the Compare tab's decoded diff: channels (the codec's
 * record fields, compared as masked bytes so nothing unmodelled slips by), zones, the settings and
 * VFO frames, and calibration. Read only; the Mini has no callsign field, so identity is the name.
 */
import type {
  DecodedDomain,
  DecodedField,
  DecodedRecord,
  DecodedSnapshot,
  DebugCompareArchive,
} from '../../../debugCompare/index.ts';
import { UV5R_MINI_LAYOUT } from '../../uv17pro-family/layout.ts';
import { decodeChannelRecord } from '../channelCodec.ts';
import { decodeUv5rMiniZoneTable } from '../modData/index.ts';
import { decodeUv5rMiniCalibration, UV5R_MINI_PA_POINTS } from './calibrationLayout.ts';
import {
  UV5R_MINI_CHANNEL_FIELDS,
  UV5R_MINI_SPECIAL_SLOTS,
  UV5R_MINI_UNMODELLED_RANGE,
} from './channelDiff.ts';
import { UV5R_MINI_FULL_READ_SIZE } from './fullRead.ts';
import { decodeUv5rMiniSettings, decodeUv5rMiniVfo } from './settingsFrame.ts';

const hexByte = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const hex = (b: ArrayLike<number>) => Array.from(b, hexByte).join(' ');

function channelsDomain(clone: Uint8Array): DecodedDomain {
  const size = UV5R_MINI_LAYOUT.channelSize;
  const records: DecodedRecord[] = [];
  for (let slot = 1; slot <= UV5R_MINI_LAYOUT.channelCount; slot++) {
    const raw = clone.subarray((slot - 1) * size, slot * size);
    const dto = decodeChannelRecord(raw, slot);
    const special = UV5R_MINI_SPECIAL_SLOTS.includes(slot);
    records.push({
      key: `slot-${slot}`,
      slot,
      identity: { name: dto.wireName || undefined },
      occupied: !dto.empty,
      // Every field is its masked bytes, so a changed bit reads changed even if no decoder shows it.
      fields: UV5R_MINI_CHANNEL_FIELDS.map((f) => ({
        id: `${f.offset}:${f.mask ?? 0xff}`,
        label: f.label,
        value: hex(
          Array.from(raw.subarray(f.offset, f.offset + f.length), (b) => b & (f.mask ?? 0xff)),
        ),
      })),
      ...(special
        ? {
            caveats: [
              `Slot ${slot} is channel data kept apart: CHIRP's firmware-version offset 0x1EF0 falls in slot 248.`,
            ],
          }
        : {}),
    });
  }
  return {
    id: 'channels',
    label: 'Channels',
    occupancyCaptured: true,
    records,
    note: `Fields are the record's masked bytes. Unmodelled bytes and bits (${UV5R_MINI_UNMODELLED_RANGE}) are listed too, so a missing unmodelled field means those bytes held.`,
  };
}

function zonesDomain(clone: Uint8Array): DecodedDomain {
  const table = decodeUv5rMiniZoneTable(clone.subarray(0xc000, 0xd000));
  if ('reject' in table)
    return {
      id: 'zones',
      label: 'Zones',
      occupancyCaptured: false,
      records: [],
      note: `No zone table (${table.reject}); the radio is stock.`,
    };
  return {
    id: 'zones',
    label: 'Zones',
    occupancyCaptured: true,
    records: table.zones.map((z, i) => ({
      key: `zone-${i + 1}`,
      slot: i + 1,
      identity: { name: z.name || undefined },
      fields: [
        { id: 'name', label: 'Zone name', value: z.name },
        {
          id: 'members',
          label: 'Members (slots)',
          value: z.slotIndexes.length ? z.slotIndexes.map((s) => s + 1).join(', ') : '(none)',
        },
      ],
    })),
  };
}

function settingsDomain(clone: Uint8Array): DecodedDomain {
  const settings = decodeUv5rMiniSettings(clone);
  const vfo = decodeUv5rMiniVfo(clone);
  const frame = (key: string, name: string, fields: typeof settings.fields): DecodedRecord => ({
    key,
    identity: { name },
    fields: fields.map((f) => ({
      address: f.address,
      id: `${f.field.offset}:${f.field.name}`,
      label: f.field.name || `Byte 0x${hexByte(f.field.offset)}`,
      value: f.text,
    })),
  });
  return {
    id: 'settings',
    label: 'Settings',
    occupancyCaptured: true,
    records: [
      frame('settings', 'Settings frame', settings.fields),
      ...vfo.sides.map((s) => frame(`vfo-${s.side}`, `VFO ${s.side}`, s.fields)),
    ],
    note: 'The frames live inside firmware log sectors the byte compare skips; they are reported, never a verdict.',
  };
}

function calibrationDomain(clone: Uint8Array): DecodedDomain {
  const c = decodeUv5rMiniCalibration(clone);
  const fields: DecodedField[] = [
    ...c.values.map((v) => ({
      id: v.id,
      label: v.label,
      value: String(v.value),
      address: v.address,
    })),
    {
      id: c.trim.id,
      label: c.trim.label,
      value: `${c.trim.value} (${c.trim.ppm} ppm)`,
      address: c.trim.address,
    },
    {
      id: c.region.id,
      address: c.region.address,
      label: c.region.label,
      value: `${c.region.value} (table ${c.region.table})`,
    },
    {
      id: 'battery',
      label: 'Battery thresholds',
      value: c.battery.values.join(', '),
      address: c.battery.start,
    },
    ...[...c.squelch.thresholds, ...c.squelch.offsets].map((b) => ({
      id: b.id,
      label: b.label,
      value: hex(b.bytes),
      address: b.start,
    })),
    ...c.texts.map((t) => ({ id: t.id, label: t.label, value: t.ascii, address: t.start })),
    {
      id: c.bandLimits.id,
      label: c.bandLimits.label,
      value: hex(c.bandLimits.bytes),
      address: c.bandLimits.start,
    },
    ...c.paBias.flatMap((seg) =>
      seg.levels.map((l) => ({
        id: `pa-${seg.segment.index}-${l.level}`,
        label: `PA bias ${seg.segment.label}, ${l.name}`,
        value: l.points.map((p) => p.value).join(' '),
        address: l.frameStart + seg.segment.index * UV5R_MINI_PA_POINTS,
      })),
    ),
  ];
  return {
    id: 'calibration',
    label: 'Calibration',
    occupancyCaptured: true,
    records: [{ key: 'calibration', identity: { name: 'Calibration' }, fields }],
    ...(c.blank ? { note: 'The calibration area reads blank (0xFF).' } : {}),
  };
}

/** The decoded clone (region `clone`) as domains; empty when the archive lacks a full read. */
export function uv5rMiniDecodedSnapshot(archive: DebugCompareArchive): DecodedSnapshot {
  const clone = archive.regions['clone'];
  if (!clone || clone.length < UV5R_MINI_FULL_READ_SIZE) return [];
  return [
    channelsDomain(clone),
    zonesDomain(clone),
    settingsDomain(clone),
    calibrationDomain(clone),
  ];
}
