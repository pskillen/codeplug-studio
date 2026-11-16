/** RT95 captures as decoded records for the Compare tab's decoded diff. Read only. */
import { decodeRt95Calibration } from '@core/radios/retevis/rt95/calibration.ts';
import type {
  DecodedDomain,
  DecodedField,
  DecodedRecord,
  DecodedSnapshot,
  DebugCompareArchive,
} from '../../debugCompare/index.ts';
import { RT95_MODEL_ID } from './constants.ts';
import {
  RT95_CALIBRATION_REGION_ID,
  RT95_GUARD_ALIAS_SIDECAR,
  RT95_GUARD_IDENT_SIDECAR,
  RT95_GUARD_OUTCOME_SIDECAR,
  RT95_MMD1_REGION_ID,
} from './debugCapture.ts';
import { decodeRt95DebugSlots, type Rt95DebugSlot } from './debugMemory.ts';
import { projectRt95Settings } from './debugMemorySettings.ts';
import { evaluateRt95ChipGuard } from './modData/chipGuard.ts';
import { decodeRt95Description, decodeRt95ModData } from './modData/decode.ts';
import { MMD1_BASE } from './modData/layout.ts';
import { RT95_PROGRAMMING_IMAGE_REGION_ID } from './restoreFromBackup.ts';

/** True only when both raw guard blocks and the recorded outcome agree (as the Memory tab trusts it). */
function guardOk(archive: DebugCompareArchive): boolean {
  const { sidecars } = archive;
  const ident = sidecars[RT95_GUARD_IDENT_SIDECAR];
  const alias = sidecars[RT95_GUARD_ALIAS_SIDECAR];
  const recorded = sidecars[RT95_GUARD_OUTCOME_SIDECAR];
  if (ident?.length !== 16 || alias?.length !== 16 || !recorded) return false;
  try {
    const outcome = evaluateRt95ChipGuard(ident, alias);
    const json: unknown = JSON.parse(new TextDecoder().decode(recorded));
    if (!json || typeof json !== 'object') return false;
    const value = json as { ok?: unknown; reason?: unknown };
    return outcome.ok && value.ok === true && value.reason === undefined;
  } catch {
    return false;
  }
}

const hex = (b: ArrayLike<number>) =>
  Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const unavailable = (v: string) => (v === 'Unavailable' ? undefined : v);

const SLOT_FIELDS = [
  ['rx', 'RX'],
  ['duplex', 'Duplex / offset'],
  ['tx', 'TX'],
  ['power', 'Power'],
  ['width', 'Width'],
  ['rxTone', 'RX tone'],
  ['txTone', 'TX tone'],
  ['scan', 'Scan'],
  ['toneSquelch', 'Tone squelch'],
  ['signalling', 'Optional signalling'],
  ['dtmf', 'DTMF index'],
  ['fiveTone', '5-Tone index'],
] as const;

function channelsDomain(archive: DebugCompareArchive): DecodedDomain {
  const region = archive.manifest.regions.find((r) => r.id === RT95_PROGRAMMING_IMAGE_REGION_ID);
  const clone = archive.regions[RT95_PROGRAMMING_IMAGE_REGION_ID];
  const base = region?.address ?? 0;
  if (!clone)
    return {
      id: 'channels',
      label: 'Channels',
      occupancyCaptured: false,
      records: [],
      note: 'Clone image not captured.',
    };
  // Descriptions live in MMD1 and count only when the chip guard evidence holds.
  const mmd1 = archive.regions[RT95_MMD1_REGION_ID];
  const readBlock = (address: number) =>
    mmd1 && address >= MMD1_BASE && address + 16 <= MMD1_BASE + mmd1.length
      ? mmd1.subarray(address - MMD1_BASE, address - MMD1_BASE + 16)
      : undefined;
  const header = mmd1 && guardOk(archive) ? decodeRt95ModData(readBlock) : undefined;
  const slots: Rt95DebugSlot[] = decodeRt95DebugSlots(clone, base);
  const records: DecodedRecord[] = slots.map((slot) => {
    const occupied = slot.occupancy === 'unavailable' ? undefined : slot.occupancy === 'occupied';
    const identity = { name: slot.name || undefined };
    if (occupied !== true)
      return { key: `slot-${slot.slot}`, slot: slot.slot, identity: {}, occupied, fields: [] };
    let description: string | undefined;
    if (header?.status === 'valid') {
      const d = decodeRt95Description(readBlock, header, slot.slot - 1, slot.raw);
      description = 'text' in d ? d.text : undefined;
    }
    const fields: DecodedField[] = [
      { id: 'name', label: 'Radio name', value: slot.name || '(unnamed)' },
      ...SLOT_FIELDS.map(([key, label]) => ({
        id: key,
        label,
        value: unavailable(slot[key]),
      })),
      { id: 'description', label: 'Description', value: description },
    ];
    return { key: `slot-${slot.slot}`, slot: slot.slot, identity, occupied, fields };
  });
  return {
    id: 'channels',
    label: 'Channels',
    occupancyCaptured: slots[0]?.occupancy !== 'unavailable',
    records,
    note: 'The RT95 record has no callsign field; the radio name and description are shown as stored. Bytes the decoder does not interpret are compared in the byte view.',
  };
}

function zonesDomain(archive: DebugCompareArchive): DecodedDomain {
  const none = (note: string): DecodedDomain => ({
    id: 'zones',
    label: 'Zones',
    occupancyCaptured: false,
    records: [],
    note,
  });
  const mmd1 = archive.regions[RT95_MMD1_REGION_ID];
  if (!mmd1) return none('MMD1 not captured.');
  if (!guardOk(archive)) return none('MMD1 chip guard evidence missing or refused.');
  const decoded = decodeRt95ModData((address) =>
    address >= MMD1_BASE && address + 16 <= MMD1_BASE + mmd1.length
      ? mmd1.subarray(address - MMD1_BASE, address - MMD1_BASE + 16)
      : undefined,
  );
  if (decoded.status !== 'valid')
    return none(
      `MMD1 header ${decoded.status === 'absent' ? 'blank' : 'invalid'}: ${decoded.reason}.`,
    );
  return {
    id: 'zones',
    label: 'Zones',
    occupancyCaptured: true,
    records: decoded.zones.map((z) => ({
      key: `zone-${z.index + 1}`,
      slot: z.index + 1,
      identity: { name: z.name || undefined },
      fields: [
        { id: 'name', label: 'Zone name', value: z.name || '(unnamed)' },
        {
          id: 'members',
          label: 'Members (slots)',
          value: z.valid
            ? z.memberIndexes.length
              ? z.memberIndexes.map((i) => i + 1).join(', ')
              : '(none)'
            : undefined,
        },
      ],
      ...(z.valid ? {} : { caveats: ['Member CRC invalid: members not compared.'] }),
    })),
  };
}

function settingsDomain(archive: DebugCompareArchive): DecodedDomain {
  const region = archive.manifest.regions.find((r) => r.id === RT95_PROGRAMMING_IMAGE_REGION_ID);
  const clone = archive.regions[RT95_PROGRAMMING_IMAGE_REGION_ID];
  if (!clone)
    return {
      id: 'settings',
      label: 'Settings',
      occupancyCaptured: false,
      records: [],
      note: 'Clone image not captured.',
    };
  const { fields } = projectRt95Settings(clone, region?.address ?? 0);
  return {
    id: 'settings',
    label: 'Settings',
    occupancyCaptured: true,
    records: [
      {
        key: 'settings',
        identity: { name: 'Radio settings' },
        fields: fields.map((f) => ({
          id: `${f.address.toString(16)}:${f.mask ?? 0}:${f.id}`,
          label: f.label,
          value:
            f.status === 'captured' ? (f.value ?? (f.raw ? hex(f.raw) : undefined)) : undefined,
          // The power-on password: compared, never shown unless revealed.
          ...(f.sensitive ? { sensitive: true } : {}),
        })),
      },
    ],
  };
}

function calibrationDomain(archive: DebugCompareArchive): DecodedDomain {
  const bytes = archive.regions[RT95_CALIBRATION_REGION_ID];
  if (!bytes)
    return {
      id: 'calibration',
      label: 'Calibration',
      occupancyCaptured: false,
      records: [],
      note: 'Calibration not captured.',
    };
  const { fields } = decodeRt95Calibration(bytes);
  return {
    id: 'calibration',
    label: 'Calibration',
    occupancyCaptured: true,
    records: [
      {
        key: 'calibration',
        identity: { name: 'Calibration and production record' },
        fields: fields.map((f) => ({
          id: `${f.address.toString(16)}:${f.width}`,
          label:
            f.meaning === 'unused'
              ? `${f.label} (0x${f.address.toString(16).toUpperCase()})`
              : f.label,
          value:
            f.availability === 'captured'
              ? f.sensitive
                ? hex(f.raw)
                : (f.decoded ?? f.text ?? hex(f.raw))
              : undefined,
          ...(f.sensitive ? { sensitive: true } : {}),
        })),
        note: 'Captured through the head: the body can answer with stale or zero bytes.',
      },
    ],
  };
}

/** The RT95 capture as channels, zones, settings and calibration; empty for another radio's archive. */
export function rt95DecodedSnapshot(archive: DebugCompareArchive): DecodedSnapshot {
  if (archive.manifest.radioModelId !== RT95_MODEL_ID) return [];
  return [
    channelsDomain(archive),
    zonesDomain(archive),
    settingsDomain(archive),
    calibrationDomain(archive),
  ];
}
