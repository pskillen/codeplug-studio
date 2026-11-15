/**
 * Read-only AT-D890UV scan-list and optional-settings projections for the debug Memory viewer.
 *
 * Pure: it reads through a coverage-aware reader and never takes a library, build or archive
 * object. Every value is decoded only from bytes that were verified captured; the cache and
 * snapshot decoders fill missing bytes, so their output is never treated as proof of a read.
 * Wire facts: `docs/reference/radios/anytone/at-d890uv/scan-list-record.md` and
 * `optional-settings.md`.
 */
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import {
  atD890KeyFunctionOptions,
  atD890SettingField,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { listSetBits } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import type { AtD890ZoneMember } from './debugMemory.ts';
import { scanListAddress } from './memory.ts';
import { decodeAtD890RadioSettings } from './settingsCodec.ts';
import {
  AT_D890_SETTINGS_EXT_SPAN,
  AT_D890_SETTINGS_FIELDS,
  AT_D890_SETTINGS_MAIN_SPAN,
  type AtD890SettingValue,
} from './settingsFields.ts';
import { decodeTerminatedWideCharName } from './wideChar.ts';

/** The part of a sparse capture this module needs; satisfied by `AtD890SparseCapture`. */
export interface AtD890ByteReader {
  read(address: number, length: number): Uint8Array | undefined;
}

/** Resolve a stored zero-based channel index to a member with its status. */
export type AtD890ChannelResolver = (rawIndex: number, position: number) => AtD890ZoneMember;

// ---------------------------------------------------------------------------
// Scan lists
// ---------------------------------------------------------------------------

const SELECT_OFFSET = 0x01;
const PRIORITY_1_OFFSET = 0x02;
const PRIORITY_2_OFFSET = 0x04;
/** `+0x01..+0x05`: priority select byte and both priority words. */
const PRIORITY_SPAN = 5;
const NAME_OFFSET = 0x0e;
const NAME_BYTES = 0x20;
const MEMBERS_OFFSET = 0x30;
const MEMBER_BYTES = AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX * 2;
const MEMBER_EMPTY = 0xffff;
const PRIORITY_OFF = 0xffff;
const PRIORITY_CURRENT = 0;

const PRIORITY_SELECT_LABEL: Record<number, string> = {
  0: 'Off',
  1: 'Priority Channel Select 1',
  2: 'Priority Channel Select 2',
  3: 'Select 1 + Select 2',
};

export type AtD890ScanPriority =
  | { kind: 'off'; word: number }
  | { kind: 'current'; word: number }
  /** `word` is one-based (display slot); the stored channel index is `word - 1`. */
  | { kind: 'channel'; word: number; rawIndex: number; member: AtD890ZoneMember };

/** A scan-list member plus the priority roles that point at the same channel index. */
export interface AtD890ScanMember extends AtD890ZoneMember {
  roles: readonly (1 | 2)[];
}

export interface AtD890ScanListEntry {
  /** One-based slot, never renumbered. */
  slot: number;
  name: { status: 'captured'; text: string } | { status: 'not-captured' };
  members: { status: 'captured'; list: readonly AtD890ScanMember[] } | { status: 'not-captured' };
  priority:
    | {
        status: 'captured';
        select: { raw: number; label?: string };
        first: AtD890ScanPriority;
        second: AtD890ScanPriority;
      }
    | { status: 'not-captured' };
}

export interface AtD890ScanListInventory {
  bitmap: 'captured' | 'not-captured';
  capacity: number;
  occupied: number;
  /** Occupied slots whose name, members and priority spans were all captured. */
  decoded: number;
  entries: readonly AtD890ScanListEntry[];
  /** Zero-based bitmap bit numbers set at or above the hardware list count. */
  outOfRangeBits: readonly number[];
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function projectPriority(word: number, resolve: AtD890ChannelResolver): AtD890ScanPriority {
  if (word === PRIORITY_OFF) return { kind: 'off', word };
  if (word === PRIORITY_CURRENT) return { kind: 'current', word };
  // Priority words are one-based, unlike member indices, which are zero-based.
  return { kind: 'channel', word, rawIndex: word - 1, member: resolve(word - 1, 0) };
}

function projectScanList(
  capture: AtD890ByteReader,
  index: number,
  resolve: AtD890ChannelResolver,
): AtD890ScanListEntry {
  const base = scanListAddress(index);
  const nameBytes = capture.read(base + NAME_OFFSET, NAME_BYTES);
  const memberBytes = capture.read(base + MEMBERS_OFFSET, MEMBER_BYTES);
  const priorityBytes = capture.read(base + SELECT_OFFSET, PRIORITY_SPAN);

  let priority: AtD890ScanListEntry['priority'] = { status: 'not-captured' };
  let firstWord: number | undefined;
  let secondWord: number | undefined;
  if (priorityBytes) {
    const select = priorityBytes[0]!;
    firstWord = u16(priorityBytes, PRIORITY_1_OFFSET - SELECT_OFFSET);
    secondWord = u16(priorityBytes, PRIORITY_2_OFFSET - SELECT_OFFSET);
    const label = PRIORITY_SELECT_LABEL[select];
    priority = {
      status: 'captured',
      select: label === undefined ? { raw: select } : { raw: select, label },
      first: projectPriority(firstWord, resolve),
      second: projectPriority(secondWord, resolve),
    };
  }

  let members: AtD890ScanListEntry['members'] = { status: 'not-captured' };
  if (memberBytes) {
    const list: AtD890ScanMember[] = [];
    for (let i = 0; i < AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX; i++) {
      const raw = u16(memberBytes, i * 2);
      if (raw === MEMBER_EMPTY) continue;
      const roles: (1 | 2)[] = [];
      // A priority word n >= 1 names channel index n - 1; it never matches by position.
      if (firstWord !== undefined && firstWord !== PRIORITY_OFF && firstWord - 1 === raw)
        roles.push(1);
      if (secondWord !== undefined && secondWord !== PRIORITY_OFF && secondWord - 1 === raw)
        roles.push(2);
      list.push({ ...resolve(raw, i + 1), roles });
    }
    members = { status: 'captured', list };
  }

  return {
    slot: index + 1,
    name: nameBytes
      ? { status: 'captured', text: decodeTerminatedWideCharName(nameBytes) }
      : { status: 'not-captured' },
    members,
    priority,
  };
}

/** Scan lists need the complete normal occupancy bitmap; spans decode independently per list. */
export function projectAtD890ScanLists(
  capture: AtD890ByteReader,
  resolve: AtD890ChannelResolver,
): AtD890ScanListInventory {
  const capacity = AT_D890UV_LIMITS.SCAN_LISTS_MAX;
  const raw = capture.read(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  if (!raw)
    return {
      bitmap: 'not-captured',
      capacity,
      occupied: 0,
      decoded: 0,
      entries: [],
      outOfRangeBits: [],
    };
  const set = listSetBits(raw);
  const inRange = set.filter((bit) => bit < capacity);
  const entries = inRange.map((index) => projectScanList(capture, index, resolve));
  return {
    bitmap: 'captured',
    capacity,
    occupied: inRange.length,
    decoded: entries.filter(
      (e) =>
        e.name.status === 'captured' &&
        e.members.status === 'captured' &&
        e.priority.status === 'captured',
    ).length,
    entries,
    outOfRangeBits: set.filter((bit) => bit >= capacity),
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type AtD890SettingsGroupId =
  'display' | 'audio' | 'power' | 'keys' | 'dmr' | 'gps' | 'scan' | 'privacy' | 'mod' | 'other';

/** Display order and titles. Scan and Mod features have no registered field today. */
export const AT_D890_SETTINGS_GROUPS: readonly { id: AtD890SettingsGroupId; label: string }[] = [
  { id: 'display', label: 'Display' },
  { id: 'audio', label: 'Audio & tones' },
  { id: 'power', label: 'Power & battery' },
  { id: 'keys', label: 'Keys & buttons' },
  { id: 'dmr', label: 'DMR' },
  { id: 'gps', label: 'GPS / APRS' },
  { id: 'scan', label: 'Scan' },
  { id: 'privacy', label: 'Privacy / lock' },
  { id: 'mod', label: 'Mod features' },
  { id: 'other', label: 'Other' },
];

const GROUP_FIELD_IDS: Record<Exclude<AtD890SettingsGroupId, 'other'>, readonly string[]> = {
  display: [
    'callDisplayMode',
    'callSignColour',
    'lastCaller',
    'aliasDisplayPriority',
    'aliasTxFormat',
    'showCurrentContact',
    'channelNumberStyle',
    'showChannelType',
    'showTimeSlot',
    'showColourCode',
    'powerOnScreen',
    'powerOnLine1',
    'powerOnLine2',
    'displayMode',
    'backlightLevel',
    'backlightTimeout',
    'menuExitTime',
    'standbyTextColour',
    'channelNameColourA',
    'channelNameColourB',
    'zoneNameColourA',
    'zoneNameColourB',
    'standbyBackground',
    'nightMode',
    'clockOnStandby',
    'dateFormat',
    'timeZone',
    'language',
  ],
  audio: [
    'startupTone',
    'powerOnVolumeType',
    'powerOnVolumeLevel',
    'volumeBar',
    'maxVolume',
    'maxHeadphoneVolume',
    'audioProfile',
    'rxNoiseReduction',
    'txNoiseReduction',
    'rxDrc',
    'dmrMicGain',
    'analogueMicGain',
    'keyTone',
    'talkPermitTone',
    'callResetTone',
    'digitalIdleTone',
    'analogueIdleTone',
    'smsAlert',
    'callAlert',
  ],
  power: ['autoPowerOff', 'autoPowerOffType', 'txTimeout', 'txTimeoutPreAlert', 'powerSave'],
  keys: [
    'keyShortPF1',
    'keyShortPF2',
    'keyShortPF3',
    'keyShortP1',
    'keyShortP2',
    'keyLongPF1',
    'keyLongPF2',
    'keyLongPF3',
    'keyLongP1',
    'keyLongP2',
    'longPressTime',
  ],
  dmr: [
    'groupCallHangTime',
    'privateCallHangTime',
    'manualDialGroupHangTime',
    'manualDialPrivateHangTime',
    'analogueCallHold',
    'txPreamble',
    'voiceHeaderRepeats',
    'smsFormat',
    'missedCallFilterOwnId',
  ],
  gps: ['answerGpsRequests'],
  scan: [],
  privacy: [
    'powerOnPasswordEnabled',
    'powerOnPasswordDigits',
    'acceptRemoteKill',
    'acceptRemoteMonitor',
    'encryptionType',
  ],
  mod: [],
};

const GROUP_BY_FIELD = new Map<string, AtD890SettingsGroupId>(
  Object.entries(GROUP_FIELD_IDS).flatMap(([group, ids]) =>
    ids.map((id) => [id, group as AtD890SettingsGroupId] as const),
  ),
);

export interface AtD890SettingFieldView {
  id: string;
  label: string;
  help: string;
  group: AtD890SettingsGroupId;
  address: number;
  length: number;
  mask?: number;
  advanced: boolean;
  status: 'captured' | 'not-captured';
  /** The bytes read (the whole byte for a masked field); only when captured. */
  raw?: readonly number[];
  /** Decoded value; `undefined` when captured but the decoder does not recognise the bytes. */
  value?: AtD890SettingValue;
  /** Name of the value when the field knows it. */
  valueLabel?: string;
  /** Interpretation that holds only if the radio runs a specific write target. */
  conditional?: string;
}

/** A byte range inside the settings scope that no registered field claims. */
export interface AtD890UnknownSettingBytes {
  address: number;
  bytes: readonly number[];
  /** Single partially claimed byte only: the bits no registered field owns. */
  unclaimedMask?: number;
}

export interface AtD890RawRun {
  address: number;
  bytes: readonly number[];
}

export interface AtD890SettingsInventory {
  fields: readonly AtD890SettingFieldView[];
  /** Captured bytes of the optional APRS block, shown raw only. */
  aprsRuns: readonly AtD890RawRun[];
  /** Captured, unclaimed bytes (or bits) inside the main and ext scope. */
  unknown: readonly AtD890UnknownSettingBytes[];
  /** Bytes in the main and ext scope that were not captured. */
  missingBytes: number;
  counts: { registered: number; captured: number; decoded: number };
}

function readRuns(capture: AtD890ByteReader, start: number, length: number): AtD890RawRun[] {
  const runs: AtD890RawRun[] = [];
  let current: { address: number; bytes: number[] } | undefined;
  for (let address = start; address < start + length; address++) {
    const b = capture.read(address, 1);
    if (!b) {
      current = undefined;
      continue;
    }
    if (!current) {
      current = { address, bytes: [] };
      runs.push(current);
    }
    current.bytes.push(b[0]!);
  }
  return runs;
}

function conditionalKeyNote(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const stock = atD890KeyFunctionOptions('stock').find((o) => o.value === value)?.label;
  const mod = atD890KeyFunctionOptions('mm9pdy').find((o) => o.value === value)?.label;
  if (stock === undefined || mod === undefined || stock === mod) return undefined;
  return `If the radio runs MM9PDY firmware this function is named "${mod}"; the bytes alone do not show which firmware is installed.`;
}

/**
 * Project the optional settings, gating each registered field on its exact address and length.
 * Fields are decoded independently: a field is read from a snapshot that carries only the bytes
 * that were captured, and a field whose own span is incomplete is never published.
 */
export function projectAtD890Settings(capture: AtD890ByteReader): AtD890SettingsInventory {
  const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength);
  const ext = new Uint8Array(D890_MAP.OptionalSettingsExtLength);
  const claimed = new Map<number, number>();
  const capturedSpecs: string[] = [];
  for (const spec of AT_D890_SETTINGS_FIELDS.values()) {
    for (let i = 0; i < spec.length; i++) {
      claimed.set(spec.address + i, (claimed.get(spec.address + i) ?? 0) | (spec.mask ?? 0xff));
    }
    const bytes = capture.read(spec.address, spec.length);
    if (!bytes) continue;
    capturedSpecs.push(spec.id);
    const inMain =
      spec.address >= D890_MAP.OptionalSettingsMain &&
      spec.address < D890_MAP.OptionalSettingsMain + D890_MAP.OptionalSettingsMainLength;
    const block = inMain ? main : ext;
    block.set(
      bytes,
      spec.address - (inMain ? D890_MAP.OptionalSettingsMain : D890_MAP.OptionalSettingsExt),
    );
  }
  // Only fields whose spans were captured are looked up below; the zero fill never reaches output.
  const decoded = decodeAtD890RadioSettings({ main, ext }, 'stock');
  const capturedIds = new Set(capturedSpecs);

  const fields: AtD890SettingFieldView[] = [];
  for (const spec of AT_D890_SETTINGS_FIELDS.values()) {
    const def = atD890SettingField(spec.id);
    const base = {
      id: spec.id,
      label: def?.label ?? spec.id,
      help: def?.help ?? '',
      group: GROUP_BY_FIELD.get(spec.id) ?? ('other' as const),
      address: spec.address,
      length: spec.length,
      ...(spec.mask === undefined ? {} : { mask: spec.mask }),
      advanced: spec.advanced,
    };
    const d = capturedIds.has(spec.id) ? decoded[spec.id] : undefined;
    if (!d) {
      fields.push({ ...base, status: 'not-captured' });
      continue;
    }
    const conditional = def?.section === 'keys' ? conditionalKeyNote(d.raw[0]) : undefined;
    const keyLabel =
      def?.section === 'keys' && d.raw[0] !== undefined
        ? atD890KeyFunctionOptions('stock').find((o) => o.value === d.raw[0])?.label
        : undefined;
    const valueLabel = d.label ?? keyLabel;
    fields.push({
      ...base,
      status: 'captured',
      raw: d.raw,
      ...(d.value === undefined ? {} : { value: d.value }),
      ...(valueLabel === undefined ? {} : { valueLabel }),
      ...(conditional === undefined ? {} : { conditional }),
    });
  }

  const unknown: AtD890UnknownSettingBytes[] = [];
  let missingBytes = 0;
  for (const span of [AT_D890_SETTINGS_MAIN_SPAN, AT_D890_SETTINGS_EXT_SPAN]) {
    let run: { address: number; bytes: number[] } | undefined;
    const flush = () => {
      if (run) unknown.push(run);
      run = undefined;
    };
    for (let address = span.start; address < span.end; address++) {
      const b = capture.read(address, 1);
      if (!b) {
        missingBytes++;
        flush();
        continue;
      }
      const owned = claimed.get(address) ?? 0;
      if (owned === 0xff) {
        flush();
      } else if (owned === 0) {
        if (!run) run = { address, bytes: [] };
        run.bytes.push(b[0]!);
      } else {
        flush();
        unknown.push({ address, bytes: [b[0]!], unclaimedMask: ~owned & 0xff });
      }
    }
    flush();
  }

  return {
    fields,
    aprsRuns: readRuns(capture, D890_MAP.OptionalSettingsAprs, D890_MAP.OptionalSettingsAprsLength),
    unknown,
    missingBytes,
    counts: {
      registered: fields.length,
      captured: fields.filter((f) => f.status === 'captured').length,
      decoded: fields.filter((f) => f.status === 'captured' && f.value !== undefined).length,
    },
  };
}
