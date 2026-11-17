/**
 * OpenGD77 (DM-1701, MD-9600) captures as decoded records for the Compare tab's decoded diff.
 * Read only. Every value comes from the same projections the debug Memory and Settings views use;
 * a source that was not captured is an unavailable value, never zero or empty.
 */
import type {
  DebugCompareArchive,
  DecodedDomain,
  DecodedField,
  DecodedRecord,
  DecodedSnapshot,
} from '../../debugCompare/index.ts';
import { OPENGD77_SETTINGS_ADDRESS } from '@core/radios/opengd77/settings.ts';
import type { RadioTone } from '../../radioChannelDto.ts';
import { openGd77ComparisonEvidence, isOpenGd77InvalidEvidence } from './debugCompare.ts';
import { selectOpenGd77Calibration } from './debugCalibration.ts';
import { openGd77DebugModel } from './debugCoverage.ts';
import { projectOpenGd77Contacts, projectOpenGd77RxGroups } from './debugDirectories.ts';
import { projectOpenGd77Memory } from './debugMemory.ts';
import { selectOpenGd77Settings } from './debugSettings.ts';

const hex = (b: ArrayLike<number>) =>
  Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const notCaptured = (id: string, label: string, note: string): DecodedDomain => ({
  id,
  label,
  occupancyCaptured: false,
  records: [],
  note,
});

const toneText = (t: RadioTone): string =>
  t.kind === 'none'
    ? 'None'
    : t.kind === 'ctcss'
      ? `CTCSS ${t.hz} Hz`
      : `DCS ${t.code}${t.polarity ?? ''}`;

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'Yes' : 'No');
const mhz = (hz: number) => `${(hz / 1e6).toFixed(5)} MHz`;

/** Identity and User Database header: the evidence the byte compare cannot show as values. */
function evidenceDomain(archive: DebugCompareArchive): DecodedDomain {
  const groups = new Map<string, DecodedField[]>();
  const caveats = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(openGd77ComparisonEvidence(archive))) {
    if (!key.includes(' / ')) continue; // the bare `Calibration` marker belongs to its own domain
    const [group, name] = key.split(' / ') as [string, string];
    if (group === 'Calibration') continue;
    const invalid = isOpenGd77InvalidEvidence(value);
    const fields = groups.get(group) ?? [];
    fields.push({
      id: key,
      label: name,
      // Missing, invalid and null all read unavailable.
      value: invalid || value === undefined || value === null ? undefined : String(value),
    });
    groups.set(group, fields);
    if (invalid) {
      const set = caveats.get(group) ?? new Set<string>();
      set.add(`Invalid FirmwareInfo: ${value.invalid}`);
      caveats.set(group, set);
    }
  }
  return {
    id: 'evidence',
    label: 'Identity and User Database evidence',
    occupancyCaptured: true,
    records: [...groups].map(([group, fields]) => ({
      key: `evidence-${group.toLowerCase().replaceAll(' ', '-')}`,
      identity: { name: group },
      fields,
      ...(caveats.has(group) ? { caveats: [...caveats.get(group)!] } : {}),
    })),
    note: 'The User Database is packed, so its entries are compared as bytes. A region that was not captured reads unavailable, not zero.',
  };
}

function channelsDomain(archive: DebugCompareArchive): DecodedDomain {
  const memory = projectOpenGd77Memory(archive, archive.manifest.radioModelId);
  if (memory.status !== 'ok') return notCaptured('channels', 'Channels', memory.reason);
  const records = memory.channels.entries.map((e): DecodedRecord => {
    const key = `slot-${e.slot}`;
    const c = e.channel;
    if (e.state === 'occupied-empty-record')
      return {
        key,
        slot: e.slot,
        identity: {},
        occupied: true,
        fields: [{ id: 'state', label: 'Record', value: 'Marked occupied, record is empty' }],
      };
    const fields: DecodedField[] = [
      { id: 'state', label: 'Record', value: 'Decoded' },
      { id: 'name', label: 'Radio name', value: c.wireName || '(unnamed)' },
      { id: 'rx', label: 'RX', value: mhz(c.rxHz) },
      { id: 'tx', label: 'TX', value: mhz(c.txHz) },
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
      { id: 'txContact', label: 'TX contact slot', value: c.txContactId?.toString() ?? 'None' },
      {
        id: 'squelch',
        label: 'Squelch',
        value: c.squelchPercent == null ? 'Global' : `${c.squelchPercent}%`,
      },
      { id: 'rxOnly', label: 'Receive only', value: yesNo(c.rxOnly) },
      { id: 'skipScan', label: 'Skip scan', value: yesNo(c.skipScan) },
      { id: 'skipZoneScan', label: 'Skip zone scan', value: yesNo(c.skipZoneScan) },
      {
        id: 'location',
        label: 'Location',
        value: c.location ? `${c.location.lat}, ${c.location.lon}` : 'None',
      },
      { id: 'useLocation', label: 'Use location', value: yesNo(c.useLocation) },
    ];
    // The record has a name only: no callsign field exists on the wire.
    return {
      key,
      slot: e.slot,
      identity: { name: c.wireName || undefined },
      occupied: true,
      fields,
    };
  });
  return {
    id: 'channels',
    label: 'Channels',
    // A bank outside the captured spans leaves its slots unknown: added and removed stay unproven.
    occupancyCaptured: memory.channels.notCapturedSlots === 0,
    records,
    note: 'The OpenGD77 channel record has a single name field and no callsign, shown as stored.',
  };
}

function zonesDomain(archive: DebugCompareArchive): DecodedDomain {
  const memory = projectOpenGd77Memory(archive, archive.manifest.radioModelId);
  if (memory.status !== 'ok') return notCaptured('zones', 'Zones', memory.reason);
  if (memory.zones.status !== 'captured')
    return notCaptured('zones', 'Zones', 'The zone bank was not captured.');
  return {
    id: 'zones',
    label: 'Zones',
    occupancyCaptured: true,
    records: memory.zones.entries.map((z): DecodedRecord => ({
      key: `zone-${z.slot}`,
      slot: z.slot,
      identity: { name: z.name || undefined },
      occupied: true,
      fields: [
        { id: 'name', label: 'Zone name', value: z.name ?? '(unnamed)' },
        {
          id: 'members',
          label: 'Members (channel slots)',
          value: z.members.length ? z.members.map((m) => m.channelNumber).join(', ') : '(none)',
        },
      ],
    })),
  };
}

const CALL_TYPE_ORDER = ['Group', 'Private', 'All call', 'Unknown'];

function contactsDomain(archive: DebugCompareArchive): DecodedDomain {
  const contacts = projectOpenGd77Contacts(archive);
  if (contacts.status !== 'captured')
    return notCaptured('contacts', 'Contacts', 'The contact bank was not captured.');
  return {
    id: 'contacts',
    label: 'Contacts',
    occupancyCaptured: true,
    records: contacts.entries.map((c): DecodedRecord => ({
      key: `contact-${c.slot}`,
      slot: c.slot,
      identity: { name: c.name || undefined },
      occupied: true,
      fields: [
        { id: 'name', label: 'Name', value: c.name || '(unnamed)' },
        { id: 'dmrId', label: 'DMR ID', value: String(c.digitalId) },
        {
          id: 'callType',
          label: 'Call type',
          value: CALL_TYPE_ORDER.includes(c.callTypeLabel) ? c.callTypeLabel : 'Unknown',
        },
        { id: 'timeSlot', label: 'Time slot byte', value: String(c.timeSlotByte) },
      ],
    })),
    note: 'The contact record has a name only: no callsign field exists on the wire.',
  };
}

function rxGroupsDomain(archive: DebugCompareArchive): DecodedDomain {
  const groups = projectOpenGd77RxGroups(archive);
  if (groups.status !== 'captured')
    return notCaptured('rx-groups', 'RX groups', 'The RX group bank was not captured.');
  return {
    id: 'rx-groups',
    label: 'RX groups',
    occupancyCaptured: true,
    records: groups.entries.map((g): DecodedRecord => ({
      key: `rx-group-${g.slot}`,
      slot: g.slot,
      identity: { name: g.name || undefined },
      occupied: true,
      fields: [
        { id: 'name', label: 'Name', value: g.name || '(unnamed)' },
        {
          id: 'members',
          label: 'Members (DMR IDs)',
          // Members resolve through the contact bank: without it they are not shown.
          value: g.contactsCaptured
            ? g.resolvedMembers.length
              ? g.resolvedMembers.map((m) => m.digitalId).join(', ')
              : '(none)'
            : undefined,
        },
        { id: 'declared', label: 'Declared members', value: String(g.declaredMembers) },
        {
          id: 'unresolved',
          label: 'Unresolved members',
          value: g.contactsCaptured ? String(g.unresolved) : undefined,
        },
      ],
      ...(g.contactsCaptured
        ? {}
        : { caveats: ['Contact bank not captured: members cannot be resolved.'] }),
    })),
  };
}

function settingsDomain(archive: DebugCompareArchive): DecodedDomain {
  const selection = selectOpenGd77Settings(archive);
  if (selection.status !== 'ok') return notCaptured('settings', 'Settings', selection.reason);
  const records: DecodedRecord[] = [];
  const { settings } = selection;
  if (settings.status === 'ok')
    records.push({
      key: 'firmware-settings',
      identity: { name: 'Firmware settings' },
      fields: settings.members.map((m) => ({
        id: m.id,
        label: m.name,
        address: OPENGD77_SETTINGS_ADDRESS + m.offset,
        value: m.state !== 'captured' ? undefined : (m.value ?? (m.raw ? hex(m.raw) : undefined)),
      })),
    });
  const groups = new Map<string, DecodedField[]>();
  for (const row of selection.general)
    groups.set(row.group, [
      ...(groups.get(row.group) ?? []),
      {
        id: row.id,
        label: row.name,
        address: row.abs,
        value: !row.captured ? undefined : (row.value ?? (row.raw ? hex(row.raw) : undefined)),
        // The codeplug password and the boot PIN: compared, never shown unless revealed.
        ...(row.sensitive ? { sensitive: true } : {}),
      },
    ]);
  for (const [group, fields] of groups)
    records.push({
      key: `general-${group
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, '')}`,
      identity: { name: group },
      fields,
    });
  return {
    id: 'settings',
    label: 'Settings',
    occupancyCaptured: true,
    records,
    ...(settings.status === 'ok' ? {} : { note: `Firmware settings: ${settings.reason}` }),
  };
}

function calibrationDomain(archive: DebugCompareArchive): DecodedDomain {
  const selection = selectOpenGd77Calibration(archive);
  const label = 'Calibration (working copy)';
  if (selection.status === 'not-captured')
    return notCaptured('calibration', label, 'The calibration working copy was not captured.');
  if (selection.status === 'unavailable')
    return notCaptured('calibration', label, selection.reason);
  if (!selection.decode.markerPresent)
    return notCaptured(
      'calibration',
      label,
      'The working copy has no local calibration marker, so its rows are not decoded.',
    );
  return {
    id: 'calibration',
    label,
    occupancyCaptured: true,
    records: [
      {
        key: 'calibration',
        identity: { name: 'Calibration working copy' },
        fields: selection.decode.rows.map((r) => ({
          id: r.id,
          label: r.label,
          value: r.decoded,
        })),
      },
    ],
    note: 'The OpenGD77 working copy, never the stock factory calibration.',
  };
}

/** The OpenGD77 capture as decoded domains; empty for another radio's archive. */
export function openGd77DecodedSnapshot(archive: DebugCompareArchive): DecodedSnapshot {
  if (!openGd77DebugModel(archive.manifest.radioModelId)) return [];
  return [
    evidenceDomain(archive),
    channelsDomain(archive),
    zonesDomain(archive),
    contactsDomain(archive),
    rxGroupsDomain(archive),
    settingsDomain(archive),
    calibrationDomain(archive),
  ];
}
