import { crc16CcittFalse } from '../../../kit/checksums.ts';
import { RT95_LIMITS } from '@core/radios/retevis/rt95/limits.ts';
import { channelFingerprint, concatBytes, MMD1_FLAG_DESCRIPTIONS, u16le } from './encode.ts';
import {
  MMD1_BLOCK_BYTES,
  MMD1_DESCRIPTIONS_ADDR,
  MMD1_HEADER_ADDR,
  MMD1_MAGIC,
  MMD1_NAMES_ADDR,
  MMD1_SLOTS_ADDR,
  MMD1_SLOT_BYTES,
  MMD1_STATE_MAGIC,
  MMD1_VERSION,
} from './layout.ts';

export type Rt95ModDataValid = {
  status: 'valid';
  zoneGeneration: number;
  descriptionGeneration: number;
  zones: { index: number; name: string; memberIndexes: number[]; valid: boolean }[];
  descriptionsPresent: boolean;
};

export type Rt95ModDataDecoded =
  { status: 'absent' | 'invalid'; reason: string } | Rt95ModDataValid;

export type ReadBlock = (address: number) => Uint8Array | undefined;

function isBlock(b: Uint8Array | undefined): b is Uint8Array {
  return b !== undefined && b.length === MMD1_BLOCK_BYTES;
}

function isAllFf(b: Uint8Array): boolean {
  return b.every((v) => v === 0xff);
}

function readU16(b: Uint8Array, off: number): number {
  return b[off]! | (b[off + 1]! << 8);
}

function asciiToText(b: Uint8Array): string {
  let s = '';
  for (const v of b) {
    if (v < 0x20 || v > 0x7e) break;
    s += String.fromCharCode(v);
  }
  return s;
}

function magicMatches(b: Uint8Array, magic: string): boolean {
  for (let i = 0; i < magic.length; i++) if (b[i] !== magic.charCodeAt(i)) return false;
  return true;
}

/**
 * Decode the MMD1 table the way the radio's reader does (rules 2 and 3). The chip guard (rule 1) is the
 * caller's job. An all-FF header is `absent`; anything else that fails the header rules is `invalid`.
 */
export function decodeRt95ModData(readBlock: ReadBlock): Rt95ModDataDecoded {
  const header = readBlock(MMD1_HEADER_ADDR);
  if (!isBlock(header)) return { status: 'invalid', reason: 'read-failed' };
  if (isAllFf(header)) return { status: 'absent', reason: 'blank' };
  if (!magicMatches(header, MMD1_MAGIC)) return { status: 'invalid', reason: 'magic' };
  if (header[4] !== MMD1_VERSION) return { status: 'invalid', reason: 'version' };
  const flags = header[6]!;
  if ((flags & ~MMD1_FLAG_DESCRIPTIONS) !== 0) return { status: 'invalid', reason: 'flags' };
  const n = header[5]!;
  if (n > RT95_LIMITS.ZONE_MAX) return { status: 'invalid', reason: 'zone-count' };

  const names: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const name = readBlock(MMD1_NAMES_ADDR + MMD1_BLOCK_BYTES * i);
    if (!isBlock(name)) return { status: 'invalid', reason: 'crc' };
    names.push(name);
  }
  const crc = crc16CcittFalse(concatBytes([header.subarray(0, 14), ...names]));
  if (crc !== readU16(header, 14)) return { status: 'invalid', reason: 'crc' };

  const zones: Rt95ModDataValid['zones'] = [];
  for (let i = 0; i < n; i++) {
    const name = names[i]!;
    const lo = readBlock(MMD1_SLOTS_ADDR + MMD1_SLOT_BYTES * i);
    const hi = readBlock(MMD1_SLOTS_ADDR + MMD1_SLOT_BYTES * i + MMD1_BLOCK_BYTES);
    const entry = {
      index: i,
      name: asciiToText(name.subarray(0, 12)),
      memberIndexes: [] as number[],
    };
    if (!isBlock(lo) || !isBlock(hi)) {
      zones.push({ ...entry, valid: false });
      continue;
    }
    const slot = concatBytes([lo, hi]);
    if (crc16CcittFalse(slot) !== readU16(name, 14)) {
      zones.push({ ...entry, valid: false });
      continue;
    }
    for (let c = 0; c < RT95_LIMITS.CHANNEL_MAX; c++) {
      if (slot[c >> 3]! & (1 << (c & 7))) entry.memberIndexes.push(c);
    }
    zones.push({ ...entry, valid: true });
  }

  return {
    status: 'valid',
    zoneGeneration: readU16(header, 8),
    descriptionGeneration: readU16(header, 10),
    zones,
    descriptionsPresent: (flags & MMD1_FLAG_DESCRIPTIONS) !== 0,
  };
}

/**
 * Decode one channel description (reader rule 4). `channelRecord` is the live 32-byte record; without
 * it the fingerprint cannot match.
 */
export function decodeRt95Description(
  readBlock: ReadBlock,
  header: Rt95ModDataValid,
  channelIndex: number,
  channelRecord: Uint8Array | undefined,
): { text: string } | { hidden: 'no-block' | 'crc' | 'fingerprint' | 'flag-clear' } {
  if (!header.descriptionsPresent) return { hidden: 'flag-clear' };
  const block = readBlock(MMD1_DESCRIPTIONS_ADDR + MMD1_BLOCK_BYTES * channelIndex);
  if (!isBlock(block) || isAllFf(block)) return { hidden: 'no-block' };
  const crc = crc16CcittFalse(
    concatBytes([
      block.subarray(0, 14),
      Uint8Array.of(channelIndex),
      Uint8Array.from(u16le(header.descriptionGeneration)),
    ]),
  );
  if (crc !== readU16(block, 14)) return { hidden: 'crc' };
  if (
    !channelRecord ||
    channelRecord.length < 0x1e ||
    channelFingerprint(channelRecord) !== block[12]
  ) {
    return { hidden: 'fingerprint' };
  }
  return { text: asciiToText(block.subarray(0, 12)) };
}

function stateCheck(b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 14; i++) sum = (sum + b[i]!) & 0xff;
  return sum ^ 0xa5;
}

/** Decode the radio's state block (0x4010): valid only for the header's zone generation. */
export function decodeRt95ZoneState(
  block: Uint8Array | undefined,
  header: Rt95ModDataValid,
): { valid: true; sideA: number; sideB: number } | { valid: false; reason: string } {
  if (!isBlock(block)) return { valid: false, reason: 'read-failed' };
  if (isAllFf(block)) return { valid: false, reason: 'blank' };
  if (!magicMatches(block, MMD1_STATE_MAGIC)) return { valid: false, reason: 'magic' };
  if (block[14] !== stateCheck(block)) return { valid: false, reason: 'check' };
  if (readU16(block, 4) !== header.zoneGeneration) {
    return { valid: false, reason: 'stale-generation' };
  }
  if (block[6]! > header.zones.length || block[7]! > header.zones.length) {
    return { valid: false, reason: 'zone-range' };
  }
  return { valid: true, sideA: block[6]!, sideB: block[7]! };
}

/** Test helper, not used by Write: build a state block the way the radio would. */
export function encodeRt95ZoneStateForTest(
  zoneGeneration: number,
  sideA: number,
  sideB: number,
): Uint8Array {
  const b = new Uint8Array(MMD1_BLOCK_BYTES);
  for (let i = 0; i < 4; i++) b[i] = MMD1_STATE_MAGIC.charCodeAt(i);
  b.set(u16le(zoneGeneration), 4);
  b[6] = sideA;
  b[7] = sideB;
  b[14] = stateCheck(b);
  return b;
}
