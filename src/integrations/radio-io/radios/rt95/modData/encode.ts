import { crc16CcittFalse, crc8Poly07 } from '../../../kit/checksums.ts';
import { RT95_LIMITS } from '@core/radios/retevis/rt95/limits.ts';
import { RT95_CHANNEL_RECORD_SIZE } from '../constants.ts';
import {
  MMD1_BLOCK_BYTES,
  MMD1_DESCRIPTIONS_ADDR,
  MMD1_HEADER_ADDR,
  MMD1_MAGIC,
  MMD1_NAMES_ADDR,
  MMD1_SLOTS_ADDR,
  MMD1_SLOT_BYTES,
  MMD1_VERSION,
} from './layout.ts';
import { assertRt95WriteAllowed } from './writeInterlock.ts';

export interface Rt95ModDataInput {
  /** 0-based channel indexes, any order; duplicates are collapsed (a zone is a set). */
  zones: readonly { name: string; channelIndexes: readonly number[] }[];
  /** Empty text = not written. */
  descriptions: readonly { channelIndex: number; text: string }[];
}

export interface Rt95ModBlock {
  address: number;
  bytes: Uint8Array;
}

export interface Rt95ModDataEncoded {
  /** In write order: descriptions ascending, slots (2 blocks each), names, header LAST. */
  blocks: readonly Rt95ModBlock[];
  zoneGeneration: number;
  descriptionGeneration: number;
  zoneCount: number;
  descriptionCount: number;
}

export class Rt95ModDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Rt95ModDataError';
  }
}

/** Header flag bit 0: descriptions present. */
export const MMD1_FLAG_DESCRIPTIONS = 0x01;

/** Offset in the encoded channel image where fingerprints are taken (record n at n * 32). */
const FINGERPRINT_MIN_IMAGE = RT95_LIMITS.CHANNEL_MAX * RT95_CHANNEL_RECORD_SIZE;

export function isPrintableAscii(text: string, allowUnderscore: boolean): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
    if (!allowUnderscore && c === 0x5f) return false;
  }
  return true;
}

export function u16le(value: number): [number, number] {
  return [value & 0xff, (value >> 8) & 0xff];
}

/** Map 0x0000 to 0x0001 and 0xFFFF to 0xFFFE. */
export function mapGeneration(crc: number): number {
  if (crc === 0x0000) return 0x0001;
  if (crc === 0xffff) return 0xfffe;
  return crc;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** CRC-8 over the encoded record's RX frequency (+0x00..+0x03) and name (+0x18..+0x1D). */
export function channelFingerprint(record: Uint8Array): number {
  return crc8Poly07(concatBytes([record.subarray(0x00, 0x04), record.subarray(0x18, 0x1e)]));
}

function asciiPadded(text: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

/**
 * Encode the MMD1 v1 table. `image` is the encoded stock clone (at least 0x1900 bytes) the descriptions'
 * fingerprints are taken from. Throws `Rt95ModDataError` on any input outside the v1 limits.
 */
export function encodeRt95ModData(input: Rt95ModDataInput, image: Uint8Array): Rt95ModDataEncoded {
  const { ZONE_MAX, ZONE_NAME_LENGTH, ZONE_MEMBERS_MAX, DESCRIPTION_LENGTH, CHANNEL_MAX } =
    RT95_LIMITS;

  if (input.zones.length > ZONE_MAX) {
    throw new Rt95ModDataError(`At most ${ZONE_MAX} zones (got ${input.zones.length}).`);
  }
  const wantsDescriptions = input.descriptions.some((d) => d.text !== '');
  if (wantsDescriptions && image.length < FINGERPRINT_MIN_IMAGE) {
    throw new Rt95ModDataError(`Channel image too short for fingerprints (${image.length} bytes).`);
  }

  // Zones.
  const slots: Uint8Array[] = [];
  const names: Uint8Array[] = [];
  input.zones.forEach((zone, i) => {
    if (zone.name.length < 1 || zone.name.length > ZONE_NAME_LENGTH) {
      throw new Rt95ModDataError(`Zone ${i} name must be 1-${ZONE_NAME_LENGTH} characters.`);
    }
    if (!isPrintableAscii(zone.name, true)) {
      throw new Rt95ModDataError(`Zone ${i} name must be printable ASCII (0x20-0x7E).`);
    }
    const members = new Set<number>();
    for (const idx of zone.channelIndexes) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= CHANNEL_MAX) {
        throw new Rt95ModDataError(
          `Zone ${i} member index ${idx} is outside 0-${CHANNEL_MAX - 1}.`,
        );
      }
      members.add(idx);
    }
    if (members.size < 1) throw new Rt95ModDataError(`Zone ${i} has no members.`);
    if (members.size > ZONE_MEMBERS_MAX) {
      throw new Rt95ModDataError(`Zone ${i} has more than ${ZONE_MEMBERS_MAX} members.`);
    }
    const slot = new Uint8Array(MMD1_SLOT_BYTES);
    for (const idx of members) slot[idx >> 3]! |= 1 << (idx & 7);
    const name = new Uint8Array(MMD1_BLOCK_BYTES);
    name.set(asciiPadded(zone.name, 12), 0);
    name[12] = members.size;
    name[13] = 0;
    name.set(u16le(crc16CcittFalse(slot)), 14);
    slots.push(slot);
    names.push(name);
  });

  // Descriptions.
  const seen = new Set<number>();
  const descs: { n: number; block: Uint8Array }[] = [];
  for (const d of input.descriptions) {
    if (!Number.isInteger(d.channelIndex) || d.channelIndex < 0 || d.channelIndex >= CHANNEL_MAX) {
      throw new Rt95ModDataError(
        `Description channel index ${d.channelIndex} is outside 0-${CHANNEL_MAX - 1}.`,
      );
    }
    if (seen.has(d.channelIndex)) {
      throw new Rt95ModDataError(`Duplicate description for channel index ${d.channelIndex}.`);
    }
    seen.add(d.channelIndex);
    if (d.text === '') continue;
    if (d.text.length > DESCRIPTION_LENGTH) {
      throw new Rt95ModDataError(
        `Description for channel index ${d.channelIndex} is longer than ${DESCRIPTION_LENGTH}.`,
      );
    }
    if (!isPrintableAscii(d.text, false)) {
      throw new Rt95ModDataError(
        `Description for channel index ${d.channelIndex} must be printable ASCII without "_".`,
      );
    }
    const block = new Uint8Array(MMD1_BLOCK_BYTES);
    block.set(asciiPadded(d.text, 12), 0);
    const recordStart = d.channelIndex * RT95_CHANNEL_RECORD_SIZE;
    block[12] = channelFingerprint(
      image.subarray(recordStart, recordStart + RT95_CHANNEL_RECORD_SIZE),
    );
    descs.push({ n: d.channelIndex, block });
  }
  descs.sort((a, b) => a.n - b.n);

  const zoneGeneration = mapGeneration(crc16CcittFalse(concatBytes([...names, ...slots])));
  const descriptionGeneration = descs.length
    ? mapGeneration(
        crc16CcittFalse(
          concatBytes(
            descs.map(({ n, block }) => concatBytes([Uint8Array.of(n), block.subarray(0, 13)])),
          ),
        ),
      )
    : 0;

  for (const { n, block } of descs) {
    const crc = crc16CcittFalse(
      concatBytes([
        block.subarray(0, 14),
        Uint8Array.of(n),
        Uint8Array.from(u16le(descriptionGeneration)),
      ]),
    );
    block.set(u16le(crc), 14);
  }

  const header = new Uint8Array(MMD1_BLOCK_BYTES);
  header.set(asciiPadded(MMD1_MAGIC, 4), 0);
  header[4] = MMD1_VERSION;
  header[5] = input.zones.length;
  header[6] = descs.length ? MMD1_FLAG_DESCRIPTIONS : 0;
  header.set(u16le(zoneGeneration), 8);
  header.set(u16le(descriptionGeneration), 10);
  header.set(u16le(crc16CcittFalse(concatBytes([header.subarray(0, 14), ...names]))), 14);

  const blocks: Rt95ModBlock[] = [];
  for (const { n, block } of descs) {
    blocks.push({ address: MMD1_DESCRIPTIONS_ADDR + MMD1_BLOCK_BYTES * n, bytes: block });
  }
  slots.forEach((slot, i) => {
    const base = MMD1_SLOTS_ADDR + MMD1_SLOT_BYTES * i;
    blocks.push({ address: base, bytes: slot.slice(0, MMD1_BLOCK_BYTES) });
    blocks.push({ address: base + MMD1_BLOCK_BYTES, bytes: slot.slice(MMD1_BLOCK_BYTES) });
  });
  names.forEach((name, i) => {
    blocks.push({ address: MMD1_NAMES_ADDR + MMD1_BLOCK_BYTES * i, bytes: name });
  });
  blocks.push({ address: MMD1_HEADER_ADDR, bytes: header });

  for (const b of blocks) {
    assertRt95WriteAllowed(b.address, b.bytes.length, {
      profile: 'mm9pdy',
      chipGuardPassed: true,
      operation: 'write',
    });
  }

  return {
    blocks,
    zoneGeneration,
    descriptionGeneration,
    zoneCount: input.zones.length,
    descriptionCount: descs.length,
  };
}
