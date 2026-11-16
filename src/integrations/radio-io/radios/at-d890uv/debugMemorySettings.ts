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
import {
  AT_D890_NAMED_SETTING_RANGES,
  type AtD890NamedSettingConfidence,
  type AtD890NamedSettingKind,
  type AtD890NamedSettingRange,
} from './debugMemorySettingsNamed.ts';
import { MM9PDY_SETTINGS_STORE_LENGTH, isMm9pdySettingsStoreValid } from './mm9pdySettingsStore.ts';
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

/** Display order and titles. The Scan group has no registered field today; Mod features is the MM9PDY store. */
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
  /**
   * Display-only reading of a captured value the Write allow-list does not offer (for example a hang time of 0).
   * Never consulted by Write or by validation.
   */
  stateText?: string;
  /** What the firmware does with the stored value when that differs from the stored number. */
  firmwareNote?: string;
}

/** Captured bytes of a settings range that no registered field claims but the trace names. */
export interface AtD890NamedSettingBytes {
  /** Address of the first captured byte. */
  address: number;
  name: string;
  meaning: string;
  kind: AtD890NamedSettingKind;
  confidence: AtD890NamedSettingConfidence;
  evidence: string;
  /** Captured bytes only (the range may be partly captured). */
  bytes: readonly number[];
  /** Whole range captured. */
  complete: boolean;
  /** Single partly claimed byte only: the bits this row names. */
  mask?: number;
}

/** The GPS template text at `0x03501280`: UTF-16LE, up to 32 characters. */
export interface AtD890GpsText {
  text: string;
  /** Bytes captured of the block. */
  capturedBytes: number;
  /** Bytes the radio keeps for the text (33 units of 2 bytes). */
  blockBytes: number;
  /** Whether the capture holds the first unit's worth only and may cut the text short. */
  truncated: boolean;
}

export interface AtD890Mm9pdyStoreSetting {
  byte: number;
  label: string;
  raw: number;
  /** Named value when the source names it. */
  valueLabel?: string;
}

export type AtD890Mm9pdyStore =
  | { status: 'not-captured' }
  /** Bad magic, version or sum, or a blank record: the firmware treats every setting as 0. */
  | { status: 'invalid'; raw: readonly number[] }
  | { status: 'valid'; raw: readonly number[]; settings: readonly AtD890Mm9pdyStoreSetting[] };

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
  /** Captured bytes of the GPS template text block, raw. */
  aprsRuns: readonly AtD890RawRun[];
  /** The GPS template text decoded from those bytes; absent when nothing was captured. */
  gpsText?: AtD890GpsText;
  /** Captured bytes no registered field claims, named from the trace (including never-read bytes). */
  named: readonly AtD890NamedSettingBytes[];
  /** MM9PDY settings store at 0x03500200, read-only. */
  mm9pdy: AtD890Mm9pdyStore;
  /** Captured, unclaimed bytes (or bits) that nothing names. */
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
 * Display-only readings for values the settings model refuses (and one the radio changes). The Write allow-list
 * and `settingsFields` validation are untouched: these only stop the page calling a real state "unrecognised".
 * Evidence: radio repo F355 (0x081134F8, 0x0811A4F0, 0x08118AA8, 0x08118B68, 0x0810C9FC, decompile 104430).
 */
const HANG_ZERO = {
  stateText: 'No hang time (0)',
  firmwareNote: 'n < 31 is n seconds; 0 means no hang (0x081134F8).',
};
const MANUAL_HANG_ZERO = {
  stateText: '0 (acts as 1 s)',
  firmwareNote: 'The loader rewrites 0 to 1, so the radio uses 1 second (decompile 104430).',
};
const ZERO_STATE_DISPLAY: Record<
  string,
  (raw: number) => { stateText?: string; firmwareNote?: string } | undefined
> = {
  groupCallHangTime: (n) => (n === 0 ? HANG_ZERO : undefined),
  privateCallHangTime: (n) => (n === 0 ? HANG_ZERO : undefined),
  manualDialGroupHangTime: (n) => (n === 0 ? MANUAL_HANG_ZERO : undefined),
  manualDialPrivateHangTime: (n) => (n === 0 ? MANUAL_HANG_ZERO : undefined),
  analogueCallHold: (n) =>
    n === 0
      ? {
          stateText: 'No hold (0)',
          firmwareNote: 'The reader gates on a non-zero value (0x0811A4F0).',
        }
      : undefined,
  txPreamble: (n) =>
    n < 5
      ? {
          stateText: `${n} (sent as 5, 300 ms)`,
          firmwareNote: 'DMR sends at least 5 (300 ms); 0–4 all give 300 ms (0x08118AA8).',
        }
      : undefined,
  voiceHeaderRepeats: (n) =>
    n < 2
      ? {
          stateText: `${n} (sent as is)`,
          firmwareNote: 'The firmware sends min(n, 9): 0 and 1 go out as stored (0x08118B68).',
        }
      : n === 10
        ? { firmwareNote: 'A stored 10 goes on air as 9 (0x08118B68).' }
        : undefined,
  powerOnVolumeLevel: (n) =>
    n === 0
      ? {
          stateText: 'Level 0',
          firmwareNote: '0–14 are used as stored; above 14 becomes 15 (0x0810C9FC).',
        }
      : undefined,
};

/** The first named range covering `offset` from the main record start. */
function namedRangeAt(offset: number): AtD890NamedSettingRange | undefined {
  return AT_D890_NAMED_SETTING_RANGES.find(
    (r) => offset >= r.offset && offset < r.offset + r.length,
  );
}

const GPS_TEXT_BLOCK_BYTES = 0x42;

/** UTF-16LE up to the first zero unit; the radio turns a 0x00FF unit into 0 at load, so that ends the text too. */
function decodeGpsText(bytes: readonly number[]): string {
  let text = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const unit = bytes[i]! | (bytes[i + 1]! << 8);
    if (unit === 0 || unit === 0x00ff) break;
    text += String.fromCharCode(unit);
  }
  return text;
}

const MM9PDY_SETTINGS: readonly { byte: number; label: string; values?: readonly string[] }[] = [
  { byte: 3, label: 'Zone-scan source', values: ['Zone', 'Scan list'] },
  { byte: 4, label: 'TS match (1: TS filter Off while RX match is TG or RGL)' },
  { byte: 5, label: 'CC match (1: any colour code passes the repeater CC limit)' },
  {
    byte: 6,
    label: 'Talk-group time slot',
    values: ['Auto (TS1 / TS2 name suffix wins)', "The channel's slot"],
  },
  { byte: 7, label: 'RX match TG (1: only RX-table slot 0x41 while monitor is off)' },
  { byte: 8, label: 'Tone Any (1: tone match always met)' },
  { byte: 9, label: 'Heard-call popup in zone scan (1: off)' },
  { byte: 10, label: 'S-meter mode (0–4)' },
  { byte: 11, label: 'S-meter average (0–2)' },
  { byte: 12, label: 'S-meter peak (0–2)' },
  { byte: 13, label: 'Spectrum span (0–5)' },
  { byte: 14, label: 'S-meter step (0–2)' },
  { byte: 15, label: 'S-meter top (0–2)' },
  { byte: 16, label: 'S-meter bottom (0–2)' },
  { byte: 17, label: 'Volume range', values: ['Stock', 'Indoor', 'Outdoor', 'Full'] },
  { byte: 18, label: 'Zone-scan resume time', values: ['5 s', '10 s', '0.5 s', '1 s', '2 s'] },
  { byte: 19, label: 'Bluetooth knob volume', values: ['On (default)', 'Off (stock)'] },
  { byte: 20, label: 'Bluetooth internal mic', values: ['Off (default)', 'On'] },
  { byte: 21, label: 'NXDN unlock', values: ['Locked (default)', 'Unlocked with the PIN'] },
  { byte: 22, label: 'Up/Down keys', values: ['Zone', 'Channel', 'Talk group'] },
];

/** The MM9PDY settings store (source: radio repo fw/src/m6.h, cfg.c). Read-only. */
function projectMm9pdyStore(capture: AtD890ByteReader): AtD890Mm9pdyStore {
  const record = capture.read(D890_MAP.SettingsStore, MM9PDY_SETTINGS_STORE_LENGTH);
  if (!record) return { status: 'not-captured' };
  const raw = [...record];
  if (!isMm9pdySettingsStoreValid(record)) return { status: 'invalid', raw };
  return {
    status: 'valid',
    raw,
    settings: MM9PDY_SETTINGS.map((def) => {
      const value = raw[def.byte]!;
      const valueLabel = def.values?.[value];
      return {
        byte: def.byte,
        label: def.label,
        raw: value,
        ...(valueLabel === undefined ? {} : { valueLabel }),
      };
    }),
  };
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
    const zero = d.raw.length === 1 ? ZERO_STATE_DISPLAY[spec.id]?.(d.raw[0]!) : undefined;
    fields.push({
      ...base,
      status: 'captured',
      raw: d.raw,
      ...(d.value === undefined ? {} : { value: d.value }),
      ...(valueLabel === undefined ? {} : { valueLabel }),
      ...(conditional === undefined ? {} : { conditional }),
      ...(zero?.stateText === undefined || d.value !== undefined
        ? {}
        : { stateText: zero.stateText }),
      ...(zero?.firmwareNote === undefined ? {} : { firmwareNote: zero.firmwareNote }),
    });
  }

  const unknown: AtD890UnknownSettingBytes[] = [];
  const namedByRange = new Map<AtD890NamedSettingRange, AtD890NamedSettingBytes>();
  const addNamed = (range: AtD890NamedSettingRange, address: number, byte: number) => {
    let entry = namedByRange.get(range);
    if (!entry) {
      entry = {
        address,
        name: range.name,
        meaning: range.meaning,
        kind: range.kind,
        confidence: range.confidence,
        evidence: range.evidence,
        bytes: [],
        complete: false,
        ...(range.mask === undefined ? {} : { mask: range.mask }),
      };
      namedByRange.set(range, entry);
    }
    (entry.bytes as number[]).push(byte);
    entry.complete = entry.bytes.length === range.length;
  };
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
      const range =
        span === AT_D890_SETTINGS_MAIN_SPAN && owned !== 0xff
          ? namedRangeAt(address - span.start)
          : undefined;
      if (owned === 0xff) {
        flush();
      } else if (range && (owned === 0) === (range.mask === undefined)) {
        flush();
        addNamed(range, address, b[0]!);
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

  const aprsRuns = readRuns(
    capture,
    D890_MAP.OptionalSettingsAprs,
    D890_MAP.OptionalSettingsAprsLength,
  );
  const gpsRun = aprsRuns[0];
  const gpsText: AtD890GpsText | undefined = gpsRun
    ? {
        text: decodeGpsText(gpsRun.bytes),
        capturedBytes: gpsRun.bytes.length,
        blockBytes: GPS_TEXT_BLOCK_BYTES,
        truncated: gpsRun.bytes.length < GPS_TEXT_BLOCK_BYTES,
      }
    : undefined;

  return {
    fields,
    aprsRuns,
    ...(gpsText === undefined ? {} : { gpsText }),
    named: [...namedByRange.values()].sort((x, y) => x.address - y.address),
    mm9pdy: projectMm9pdyStore(capture),
    unknown,
    missingBytes,
    counts: {
      registered: fields.length,
      captured: fields.filter((f) => f.status === 'captured').length,
      decoded: fields.filter((f) => f.status === 'captured' && f.value !== undefined).length,
    },
  };
}
