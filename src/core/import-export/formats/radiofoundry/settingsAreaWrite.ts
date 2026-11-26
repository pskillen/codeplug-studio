/**
 * Build and merge a RadioFoundry settings sector.
 * Unknown values, including secrets and traffic keys, are copied as bytes.
 */
import { CHANNEL_TAG_KEY_FIRST, CHANNEL_TAG_KEY_LAST } from './channelTags.ts';
import { SETTINGS_AREA_SIZE } from './layout.ts';
import { crc32, readRadioFoundrySettingsArea, type SettingsArea } from './settingsArea.ts';

const MAGIC = [0x52, 0x46, 0x4b, 0x56];
const VERSION = 1;
const DEFAULT_HEADER_LENGTH = 16;

export interface SettingsAreaValue {
  key: number;
  value: Uint8Array;
}

/** A radio-wide set. `head` keeps bytes past the new value (0x0A06). */
export interface SettingsAreaHeadWrite {
  value: Uint8Array;
  head?: boolean;
}

export interface RadioFoundrySettingsEdit {
  /**
   * When true, every channel-tag key is replaced by `channelTags` (D24).
   * Existing tags of any kind are dropped. When false, tag keys are copied.
   */
  ownsChannelTable: boolean;
  /** Channel number (1–1024) → full tag value. Applied only when `ownsChannelTable`. */
  channelTags?: ReadonlyMap<number, Uint8Array>;
  /** Non-channel keys to set. A missing key is appended. */
  radioWide?: ReadonlyMap<number, SettingsAreaHeadWrite>;
}

export type RadioFoundrySettingsWrite =
  | { status: 'unchanged' }
  | { status: 'written'; sector: Uint8Array }
  | { status: 'refused'; reason: 'newer' }
  | { status: 'refused'; reason: 'overflow'; overflowBytes: number };

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function sameEntries(a: readonly SettingsAreaValue[], b: readonly SettingsAreaValue[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.key !== b[i]!.key || !sameBytes(a[i]!.value, b[i]!.value)) return false;
  }
  return true;
}

function isChannelTagKey(key: number): boolean {
  return key >= CHANNEL_TAG_KEY_FIRST && key <= CHANNEL_TAG_KEY_LAST;
}

function channelTagKey(channelNumber: number): number | null {
  if (!Number.isInteger(channelNumber) || channelNumber < 1 || channelNumber > 1024) return null;
  return CHANNEL_TAG_KEY_FIRST + channelNumber - 1;
}

function dataLength(entries: readonly SettingsAreaValue[]): number {
  let n = 0;
  for (const entry of entries) n += 4 + entry.value.length;
  return n;
}

function applyHead(existing: Uint8Array, write: SettingsAreaHeadWrite): Uint8Array {
  if (!write.head || existing.length <= write.value.length) return copyBytes(write.value);
  const out = new Uint8Array(existing.length);
  out.set(write.value, 0);
  out.set(existing.subarray(write.value.length), write.value.length);
  return out;
}

function firstEntries(area: SettingsArea): SettingsAreaValue[] {
  const seen = new Set<number>();
  const entries: SettingsAreaValue[] = [];
  for (const entry of area.entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    entries.push({ key: entry.key, value: copyBytes(entry.value) });
  }
  return entries;
}

function mergedEntries(
  existing: readonly SettingsAreaValue[],
  edit: RadioFoundrySettingsEdit,
): SettingsAreaValue[] {
  const radioWide = edit.radioWide ?? new Map<number, SettingsAreaHeadWrite>();
  const seen = new Set<number>();
  const entries: SettingsAreaValue[] = [];
  for (const entry of existing) {
    if (seen.has(entry.key)) continue;
    // A dropped channel tag must not block the tag Studio appends for that channel.
    if (edit.ownsChannelTable && isChannelTagKey(entry.key)) continue;
    seen.add(entry.key);
    const wide = radioWide.get(entry.key);
    entries.push(
      wide
        ? { key: entry.key, value: applyHead(entry.value, wide) }
        : { key: entry.key, value: copyBytes(entry.value) },
    );
  }
  if (edit.ownsChannelTable) {
    const tags = [...(edit.channelTags ?? new Map<number, Uint8Array>()).entries()].sort(
      (a, b) => a[0] - b[0],
    );
    for (const [channelNumber, value] of tags) {
      const key = channelTagKey(channelNumber);
      if (key == null || seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, value: copyBytes(value) });
    }
  }
  const appended = [...radioWide.entries()].sort((a, b) => a[0] - b[0]);
  for (const [key, write] of appended) {
    if (seen.has(key) || isChannelTagKey(key)) continue;
    entries.push({ key, value: copyBytes(write.value) });
  }
  return entries;
}

/**
 * One sector. `headerTail` is the bytes from offset 12 through the header
 * (reserved and any extension). The tail of the sector is 0xFF.
 * Overflow is reported and nothing partial is returned.
 */
export function encodeRadioFoundrySettingsSector(
  entries: readonly SettingsAreaValue[],
  options?: { headerLength?: number; headerTail?: Uint8Array },
): { ok: true; sector: Uint8Array } | { ok: false; overflowBytes: number } {
  const headerLength = options?.headerLength ?? DEFAULT_HEADER_LENGTH;
  const payload = dataLength(entries);
  const overflowBytes = headerLength + payload - SETTINGS_AREA_SIZE;
  if (headerLength < DEFAULT_HEADER_LENGTH || overflowBytes > 0) {
    return { ok: false, overflowBytes: Math.max(overflowBytes, 1) };
  }
  const data = new Uint8Array(payload);
  let pos = 0;
  for (const entry of entries) {
    data[pos] = entry.key & 0xff;
    data[pos + 1] = (entry.key >> 8) & 0xff;
    data[pos + 2] = entry.value.length & 0xff;
    data[pos + 3] = (entry.value.length >> 8) & 0xff;
    data.set(entry.value, pos + 4);
    pos += 4 + entry.value.length;
  }
  const sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  sector.set(MAGIC, 0);
  sector[4] = VERSION;
  sector[5] = headerLength;
  sector[6] = payload & 0xff;
  sector[7] = (payload >> 8) & 0xff;
  const crc = crc32(data);
  sector[8] = crc & 0xff;
  sector[9] = (crc >>> 8) & 0xff;
  sector[10] = (crc >>> 16) & 0xff;
  sector[11] = (crc >>> 24) & 0xff;
  const tail = options?.headerTail;
  if (tail) sector.set(tail.subarray(0, headerLength - 12), 12);
  sector.set(data, headerLength);
  return { ok: true, sector };
}

/**
 * Apply one edit to a 4096-byte sector. A newer area is refused. An erased or
 * invalid area is replaced only when the edit writes something. A no-op returns
 * unchanged. Overflow refuses the whole edit.
 */
export function mergeRadioFoundrySettingsArea(
  sector: Uint8Array,
  edit: RadioFoundrySettingsEdit,
): RadioFoundrySettingsWrite {
  const area = readRadioFoundrySettingsArea(sector);
  const existing = area.state === 'valid' ? firstEntries(area) : [];
  const entries = mergedEntries(existing, edit);
  const changed = area.state !== 'valid' ? entries.length > 0 : !sameEntries(existing, entries);
  if (!changed) return { status: 'unchanged' };
  if (area.state === 'newer') return { status: 'refused', reason: 'newer' };

  const headerLength = area.state === 'valid' ? sector[5]! : DEFAULT_HEADER_LENGTH;
  const headerTail = area.state === 'valid' ? sector.subarray(12, headerLength) : new Uint8Array(4);
  const encoded = encodeRadioFoundrySettingsSector(entries, { headerLength, headerTail });
  if (!encoded.ok)
    return { status: 'refused', reason: 'overflow', overflowBytes: encoded.overflowBytes };
  return { status: 'written', sector: encoded.sector };
}
