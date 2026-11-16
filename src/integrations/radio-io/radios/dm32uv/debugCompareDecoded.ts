/** DM-32 captures as decoded records for the Compare tab's decoded diff. Read only. */
import type {
  DebugCompareArchive,
  DecodedDomain,
  DecodedField,
  DecodedRecord,
  DecodedSnapshot,
} from '../../debugCompare/index.ts';
import type { RadioTone } from '../../radioChannelDto.ts';
import { DM32_MODEL_IDS } from './constants.ts';
import { dm32ComparisonEvidence } from './debugCompare.ts';
import { buildDm32SparseCapture, projectDm32Channels } from './debugMemory.ts';
import { projectDm32RxGroups, projectDm32TalkGroups } from './debugMemoryLists.ts';
import { projectDm32Settings } from './debugMemorySettings.ts';
import {
  projectDm32ScanLists,
  projectDm32Zones,
  type Dm32ResolvedMember,
} from './debugMemoryZones.ts';

const hex = (b: ArrayLike<number>) =>
  Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const notCaptured = (id: string, label: string, note: string): DecodedDomain => ({
  id,
  label,
  occupancyCaptured: false,
  records: [],
  note,
});

/** Same unavailable rule as `compareDm32Evidence`: missing, null, or an object holding a null. */
const evidenceValue = (v: unknown): string | undefined =>
  v === undefined || v === null || (typeof v === 'object' && JSON.stringify(v).includes('null'))
    ? undefined
    : JSON.stringify(v);

function evidenceDomain(archive: DebugCompareArchive): DecodedDomain {
  const evidence = dm32ComparisonEvidence(archive);
  const groups = new Map<string, DecodedField[]>();
  for (const [key, value] of Object.entries(evidence)) {
    const group = key.split(' / ')[0]!;
    const fields = groups.get(group) ?? [];
    fields.push({ id: key, label: key, value: evidenceValue(value) });
    groups.set(group, fields);
  }
  return {
    id: 'evidence',
    label: 'Identity and calibration evidence',
    occupancyCaptured: true,
    records: [...groups].map(([group, fields]) => ({
      key: `evidence-${group.toLowerCase()}`,
      identity: { name: group },
      fields,
    })),
    note: 'Decoded from classified captured bytes only. Sparse runs with different partitions may be incomparable.',
  };
}

const toneText = (t: RadioTone): string =>
  t.kind === 'none'
    ? 'None'
    : t.kind === 'ctcss'
      ? `CTCSS ${t.hz} Hz`
      : `DCS ${t.code}${t.polarity ?? ''}`;

const yesNo = (v: boolean | undefined) => (v ? 'Yes' : 'No');
const mhz = (hz: number) => `${(hz / 1e6).toFixed(5)} MHz`;

function channelsDomain(archive: DebugCompareArchive): DecodedDomain {
  const channels = projectDm32Channels(buildDm32SparseCapture(archive));
  if (channels.status !== 'captured')
    return notCaptured('channels', 'Channels', channels.reason ?? 'Channels not captured.');
  const records: DecodedRecord[] = channels.entries.map((entry) => {
    const key = `slot-${entry.slot}`;
    const { state } = entry;
    if (state.kind === 'not-captured')
      return { key, slot: entry.slot, identity: {}, fields: [], caveats: [state.reason] };
    if (state.kind !== 'decoded')
      return { key, slot: entry.slot, identity: {}, occupied: false, fields: [] };
    const c = state.channel;
    const { rxInvalidBcd, txInvalidBcd, noTxStored } = state.flags;
    const fields: DecodedField[] = [
      { id: 'name', label: 'Radio name', value: c.wireName || '(unnamed)' },
      { id: 'rx', label: 'RX', value: rxInvalidBcd ? undefined : mhz(c.rxHz) },
      { id: 'tx', label: 'TX', value: rxInvalidBcd || txInvalidBcd ? undefined : mhz(c.txHz) },
      { id: 'noTx', label: 'TX stored', value: noTxStored ? 'No (RX reused)' : 'Yes' },
      { id: 'mode', label: 'Mode', value: c.mode },
      {
        id: 'power',
        label: 'Power',
        value: c.powerPercent === null ? 'Radio default' : `${c.powerPercent}%`,
      },
      { id: 'bandwidth', label: 'Bandwidth', value: c.bandwidth },
      { id: 'rxTone', label: 'RX tone', value: toneText(c.rxTone) },
      { id: 'txTone', label: 'TX tone', value: toneText(c.txTone) },
      { id: 'colorCode', label: 'Color code', value: c.colorCode?.toString() },
      { id: 'timeslot', label: 'Time slot', value: c.timeslot?.toString() },
      { id: 'rxGroup', label: 'RX group index', value: c.rxGroupIndex?.toString() },
      { id: 'txContact', label: 'TX contact index', value: entry.txContactIndex?.toString() },
      { id: 'scanList', label: 'Scan list', value: String(c.scanListId ?? 0) },
      { id: 'scanAdd', label: 'Scan add', value: yesNo(c.scanAdd) },
      { id: 'rxOnly', label: 'Receive only', value: yesNo(c.rxOnly) },
    ];
    return {
      key,
      slot: entry.slot,
      identity: { name: c.wireName || undefined },
      occupied: true,
      fields,
    };
  });
  return {
    id: 'channels',
    label: 'Channels',
    // A gap in the captured pages leaves some slots unknown: added and removed stay unproven.
    occupancyCaptured: channels.notCaptured === 0,
    records,
    note: 'The DM-32 channel record has a single name field and no callsign, shown as stored. Bytes the decoder does not interpret are compared in the byte view.',
  };
}

const slots = (members: readonly Dm32ResolvedMember[]) =>
  members.length ? members.map((m) => m.slot).join(', ') : '(none)';

function zonesDomain(archive: DebugCompareArchive): DecodedDomain {
  const capture = buildDm32SparseCapture(archive);
  const zones = projectDm32Zones(capture, projectDm32Channels(capture));
  if (zones.status !== 'captured')
    return notCaptured('zones', 'Zones', zones.reason ?? 'Zones not captured.');
  return {
    id: 'zones',
    label: 'Zones',
    occupancyCaptured: zones.notCaptured === 0,
    records: zones.entries.map((e): DecodedRecord => {
      const key = `zone-${e.slot}`;
      const s = e.state;
      if (s.kind === 'not-captured')
        return { key, slot: e.slot, identity: {}, fields: [], caveats: [s.reason] };
      if (s.kind === 'vacant')
        return { key, slot: e.slot, identity: {}, occupied: false, fields: [] };
      return {
        key,
        slot: e.slot,
        identity: { name: s.name || undefined },
        occupied: true,
        fields: [
          { id: 'name', label: 'Zone name', value: s.name || '(unnamed)' },
          {
            id: 'members',
            label: 'Members (channel slots)',
            value: s.memberCountValid ? slots(s.members) : undefined,
          },
        ],
        ...(s.memberCountValid
          ? {}
          : { caveats: ['Member count out of range: members not compared.'] }),
      };
    }),
  };
}

function scanListsDomain(archive: DebugCompareArchive): DecodedDomain {
  const capture = buildDm32SparseCapture(archive);
  const lists = projectDm32ScanLists(capture, projectDm32Channels(capture));
  if (lists.status !== 'captured')
    return notCaptured('scan-lists', 'Scan lists', lists.reason ?? 'Scan lists not captured.');
  return {
    id: 'scan-lists',
    label: 'Scan lists',
    occupancyCaptured: true,
    records: lists.entries.map((e): DecodedRecord => {
      const key = `scan-list-${e.slot}`;
      const s = e.state;
      if (s.kind === 'vacant')
        return { key, slot: e.slot, identity: {}, occupied: false, fields: [] };
      const r = s.raw;
      return {
        key,
        slot: e.slot,
        identity: { name: s.name || undefined },
        occupied: true,
        fields: [
          { id: 'name', label: 'Scan list name', value: s.name || '(unnamed)' },
          {
            id: 'members',
            label: 'Members (channel slots)',
            value: s.namedCount === undefined ? undefined : slots(s.members),
          },
          {
            id: 'unestablished',
            label: 'Bytes with no established meaning (+0x0C, +0x0D, +0x0E, +0x11, +0x12)',
            value: hex([r.b0c, r.b0d, r.b0e, r.b11, r.b12]),
          },
        ],
      };
    }),
  };
}

const CALL_TYPE = {
  private: 'Private',
  group: 'Group',
  all: 'All call',
  unknown: 'Unknown',
} as const;

function talkGroupsDomain(archive: DebugCompareArchive): DecodedDomain {
  const tg = projectDm32TalkGroups(buildDm32SparseCapture(archive));
  if (tg.status !== 'captured')
    return notCaptured('talk-groups', 'Talk groups', tg.reason ?? 'Talk groups not captured.');
  const overflow = tg.overflow.some((o) => o.addresses.length > 0 || o.discoveredNotCaptured);
  return {
    id: 'talk-groups',
    label: 'Talk groups',
    // Tags 0x45-0x48 hold further entries whose layout is never decoded.
    occupancyCaptured: !overflow,
    records: tg.entries.map((e) => ({
      key: `talk-group-${e.slot}`,
      slot: e.slot,
      identity: { name: e.name || undefined },
      occupied: true,
      fields: [
        { id: 'name', label: 'Name', value: e.name || '(unnamed)' },
        { id: 'dmrId', label: 'DMR ID', value: String(e.dmrId) },
        { id: 'callType', label: 'Call type', value: CALL_TYPE[e.callType] },
      ],
    })),
    ...(overflow
      ? {
          note: 'Overflow pages (tags 0x45-0x48) exist and are not decoded: added and removed talk groups are not reported.',
        }
      : {}),
  };
}

function rxGroupsDomain(archive: DebugCompareArchive): DecodedDomain {
  const capture = buildDm32SparseCapture(archive);
  const rx = projectDm32RxGroups(capture, projectDm32TalkGroups(capture));
  if (rx.status !== 'captured')
    return notCaptured('rx-groups', 'RX groups', rx.reason ?? 'RX groups not captured.');
  return {
    id: 'rx-groups',
    label: 'RX groups',
    occupancyCaptured: true,
    records: rx.entries.map((e): DecodedRecord => {
      const key = `rx-group-${e.slot}`;
      if (e.blank) return { key, slot: e.slot, identity: {}, occupied: false, fields: [] };
      const members = e.members
        .filter((m) => !m.empty)
        .map((m) => `${m.dmrId}${m.timeSlot ? ` (TS${m.timeSlot})` : ''}`);
      return {
        key,
        slot: e.slot,
        identity: { name: e.name || undefined },
        occupied: true,
        fields: [
          { id: 'name', label: 'Name', value: e.name || '(unnamed)' },
          {
            id: 'members',
            label: 'Members (DMR IDs)',
            value: members.length ? members.join(', ') : '(none)',
          },
        ],
        ...(e.timeSlotStore === 'check-failed'
          ? { caveats: ['Time-slot store check failed: time slots not shown.'] }
          : {}),
      };
    }),
  };
}

function settingsDomain(archive: DebugCompareArchive): DecodedDomain {
  const settings = projectDm32Settings(buildDm32SparseCapture(archive));
  if (settings.status !== 'captured') return notCaptured('settings', 'Settings', settings.reason);
  return {
    id: 'settings',
    label: 'Settings',
    occupancyCaptured: true,
    records: [
      {
        key: 'settings',
        identity: { name: 'Radio settings' },
        fields: settings.fields.map((f) => ({
          id: f.id,
          label: f.label,
          value:
            f.status !== 'captured'
              ? undefined
              : (f.value ??
                (f.raw
                  ? hex(f.mask === undefined ? f.raw : [f.raw[0]! & f.mask, ...f.raw.slice(1)])
                  : undefined)),
          // The three passwords: compared, never shown unless revealed.
          ...(f.sensitive ? { sensitive: true } : {}),
        })),
      },
    ],
  };
}

/** The DM-32 capture as decoded domains; empty for another radio's archive. */
export function dm32DecodedSnapshot(archive: DebugCompareArchive): DecodedSnapshot {
  if (!(DM32_MODEL_IDS as readonly string[]).includes(archive.manifest.radioModelId)) return [];
  return [
    evidenceDomain(archive),
    channelsDomain(archive),
    zonesDomain(archive),
    scanListsDomain(archive),
    talkGroupsDomain(archive),
    rxGroupsDomain(archive),
    settingsDomain(archive),
  ];
}
