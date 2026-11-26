import type { SettingsArea } from './settingsArea.ts';

/** Channel-tag headers in the RadioFoundry settings area. Parameter blocks are not decoded. */

export const CHANNEL_TAG_KEY_FIRST = 0x0400;
export const CHANNEL_TAG_KEY_LAST = 0x07ff;

/** Kinds Studio names. Any other id stays "kind N (not known to Studio)". */
export const RADIOFOUNDRY_CHANNEL_KIND_LABELS: Readonly<Record<number, string>> = {
  1: 'DMR Tier III trunked',
  2: 'P25 conventional',
  3: 'P25 trunked',
  4: 'NXDN conventional',
  5: 'Conventional DMR AES-256',
  6: 'M17 conventional',
};

export const RADIOFOUNDRY_KIND_AES = 5;
export const RADIOFOUNDRY_KIND_M17 = 6;

export interface ChannelTagHeader {
  /** 1-1024 */
  channelNumber: number;
  kind: number;
  /** null for 0xFF */
  system: number | null;
  nameCheck: number;
  /** Flag bit 0. */
  txAllowed: boolean;
  /** Flag bit 1. */
  baseStandsAlone: boolean;
}

const TAG_HEADER_LENGTH = 5;

/** Tag headers of a valid area, first entry per key, skipping kind 0/0xFF and values shorter than 5 bytes. */
export function readChannelTagHeaders(area: SettingsArea): ChannelTagHeader[] {
  if (area.state !== 'valid') return [];
  const seen = new Set<number>();
  const tags: ChannelTagHeader[] = [];
  for (const entry of area.entries) {
    if (entry.key < CHANNEL_TAG_KEY_FIRST || entry.key > CHANNEL_TAG_KEY_LAST) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const v = entry.value;
    if (v.length < TAG_HEADER_LENGTH) continue;
    const kind = v[0]!;
    if (kind === 0 || kind === 0xff) continue;
    const flags = v[4]!;
    tags.push({
      channelNumber: entry.key - CHANNEL_TAG_KEY_FIRST + 1,
      kind,
      system: v[1] === 0xff ? null : v[1]!,
      nameCheck: v[2]! | (v[3]! << 8),
      txAllowed: (flags & 0x01) !== 0,
      baseStandsAlone: (flags & 0x02) !== 0,
    });
  }
  return tags;
}

export function radioFoundryChannelKindLabel(kind: number): string {
  return RADIOFOUNDRY_CHANNEL_KIND_LABELS[kind] ?? `kind ${kind} (not known to Studio)`;
}

/** FNV-1a name check over the 16 stored name octets (pass record.subarray(0, 16)). */
export function radioFoundryNameCheck(storedName: Uint8Array): number {
  let h = 2166136261;
  let ended = false;
  for (let i = 0; i < 16; i++) {
    let b = i < storedName.length ? storedName[i]! : 0;
    if (b === 0x00 || b === 0xff) ended = true;
    if (ended) b = 0;
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff;
}

/** The live rule: check matches and (bit 1, or the base record is DMR receive-only). Pass the 56-byte record. */
export function isChannelTagLive(tag: ChannelTagHeader, channelRecord: Uint8Array): boolean {
  if (radioFoundryNameCheck(channelRecord.subarray(0, 16)) !== tag.nameCheck) return false;
  if (tag.baseStandsAlone) return true;
  return channelRecord[0x18] === 1 && (channelRecord[0x33]! & 0x04) !== 0;
}

/**
 * Whole tag value: kind, system, name check, flags, parameter block.
 * Studio writes every byte from the model. Flag bits other than transmit and
 * "base stands alone" are 0. There is no fallback and nothing is copied from an old tag.
 */
export function writeRadioFoundryChannelTag(args: {
  kind: number;
  /** Null is no system (0xFF). */
  system: number | null;
  /** The 16 name octets as the channel record stores them. */
  storedName: Uint8Array;
  txAllowed: boolean;
  /** Flag bit 1. Studio's M17 stand-in leaves this clear. */
  baseStandsAlone?: boolean;
  block: Uint8Array;
}): Uint8Array {
  const check = radioFoundryNameCheck(args.storedName);
  const flags = (args.txAllowed ? 0x01 : 0) | (args.baseStandsAlone ? 0x02 : 0);
  const out = new Uint8Array(TAG_HEADER_LENGTH + args.block.length);
  out[0] = args.kind & 0xff;
  out[1] = args.system == null ? 0xff : args.system & 0xff;
  out[2] = check & 0xff;
  out[3] = (check >> 8) & 0xff;
  out[4] = flags;
  out.set(args.block, TAG_HEADER_LENGTH);
  return out;
}
