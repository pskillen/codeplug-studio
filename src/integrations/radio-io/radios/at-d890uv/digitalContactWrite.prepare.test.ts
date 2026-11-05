/**
 * The prepared AT-D890UV contact Write (#1558): byte-identical to the original algorithm, and
 * bucketed by unit in one pass instead of a filter over every chunk per unit.
 *
 * `legacyPrepare` is the original implementation, kept here as the reference: a filter over all the
 * modelled chunks once per unit, a 2M-entry address set, and a copy of every staged block.
 */
import { describe, expect, it } from 'vitest';
import { AT_D890_BLOCK_SIZE, D890_MAP } from './constants.ts';
import { atD890BlockHoppedAddress, packAtD890DigitalContacts } from './digitalContactCodec.ts';
import {
  bucketChunksByUnit,
  prepareAtD890DigitalContactWrite,
  preparedContactWriteBytes,
} from './digitalContactWrite.ts';
import { AT_D890_ERASE_UNIT_BYTES, eraseUnitBaseFor, listTouchedEraseUnits } from './eraseUnits.ts';
import {
  eraseAnchorsFromModelled,
  listSparseStagingChunks,
  modelledAddressSetFromChunks,
  overlayModelledChunksOntoUnit,
  type AtD890StagingChunk,
} from './sparseEraseRmw.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';

/** Small deterministic PRNG (mulberry32): the same directory on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededDirectory(n: number, seed: number): RadioDigitalContactDto[] {
  const r = rng(seed);
  const word = (len: number) =>
    Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join('');
  const seen = new Set<number>();
  const out: RadioDigitalContactDto[] = [];
  while (out.length < n) {
    const digitalId = 1 + Math.floor(r() * 16_000_000);
    if (seen.has(digitalId)) continue;
    seen.add(digitalId);
    out.push({
      wireName: word(1 + Math.floor(r() * 14)),
      digitalId,
      callsign: word(3 + Math.floor(r() * 4)).toUpperCase(),
      city: word(Math.floor(r() * 16)),
      province: word(Math.floor(r() * 10)),
      country: word(Math.floor(r() * 12)),
      remark: r() < 0.2 ? word(Math.floor(r() * 20)) : '',
    });
  }
  return out;
}

/**
 * The original codec's chunking: every 16-byte block of a linear stream copied into its own
 * 0xFF-padded buffer. Built from the linear streams, never from the codec's own chunks.
 */
function legacyChunksFromLinear(
  base: number,
  linear: Uint8Array,
  blockLength: number,
  stride: number,
): AtD890StagingChunk[] {
  if (linear.length === 0) return [];
  const aligned = Math.ceil(linear.length / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  const out: AtD890StagingChunk[] = [];
  for (let off = 0; off < aligned; off += AT_D890_BLOCK_SIZE) {
    const padded = new Uint8Array(AT_D890_BLOCK_SIZE).fill(0xff);
    padded.set(linear.slice(off, Math.min(off + AT_D890_BLOCK_SIZE, linear.length)));
    out.push({ address: atD890BlockHoppedAddress(base, off, blockLength, stride), data: padded });
  }
  return out;
}

/** The original prepare: chunks rebuilt independently, a filter over all chunks per unit. */
function legacyPrepare(contacts: readonly RadioDigitalContactDto[]) {
  const pack = packAtD890DigitalContacts(contacts, 'all');
  const modelledChunks: AtD890StagingChunk[] = [
    { address: D890_MAP.DigitalContactMeta, data: pack.meta.slice() },
    ...legacyChunksFromLinear(
      D890_MAP.DigitalContactOrder,
      pack.orderLinear,
      D890_MAP.DigitalContactOrderBlockLength,
      D890_MAP.DigitalContactOrderBlockStride,
    ),
    ...legacyChunksFromLinear(
      D890_MAP.DigitalContactData,
      pack.dataLinear,
      D890_MAP.DigitalContactDataBlockLength,
      D890_MAP.DigitalContactDataStride,
    ),
  ];
  const modelledAddresses = modelledAddressSetFromChunks(modelledChunks);
  const units = listTouchedEraseUnits(modelledChunks.map((c) => c.address));
  const mergedUnits = new Map<number, Uint8Array>();
  for (const unitBase of units) {
    const buffer = new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(0xff);
    overlayModelledChunksOntoUnit(
      unitBase,
      buffer,
      modelledChunks.filter((c) => eraseUnitBaseFor(c.address) === unitBase),
    );
    mergedUnits.set(unitBase, buffer);
  }
  const chunks = listSparseStagingChunks(mergedUnits, modelledAddresses);
  return { chunks, units, anchors: eraseAnchorsFromModelled(modelledChunks) };
}

/** Fixed-size records: every contact encodes to the same length, so counts step predictably. */
function fixedDirectory(n: number): RadioDigitalContactDto[] {
  return Array.from({ length: n }, (_, i) => ({
    wireName: 'N' + String(i).padStart(5, '0'),
    digitalId: 1 + i,
    callsign: 'AB1CDE',
    city: 'City',
    province: 'Prov',
    country: 'Land',
    remark: '',
  }));
}

function frames(chunks: readonly AtD890StagingChunk[]): string {
  return chunks
    .map((c) => `${c.address.toString(16)}:${Buffer.from(c.data).toString('hex')}`)
    .join('\n');
}

describe('prepareAtD890DigitalContactWrite (#1558)', () => {
  function expectIdentical(contacts: readonly RadioDigitalContactDto[]): void {
    const next = prepareAtD890DigitalContactWrite(contacts, 'all');
    const ref = legacyPrepare(contacts);
    expect(next.units).toEqual(ref.units);
    expect(frames(next.chunks)).toBe(frames(ref.chunks));
    expect([...next.anchors.entries()]).toEqual([...ref.anchors.entries()]);
    expect(preparedContactWriteBytes(next)).toBe(ref.chunks.length * 16);
  }

  it.each([
    [1, 11],
    [37, 12],
    [4_000, 13],
    // Spans the order table's and the data region's unit boundaries (several 256 KiB units).
    [12_000, 14],
  ])('sends byte-identical frames to the original for %i seeded contacts', (n, seed) => {
    expectIdentical(seededDirectory(n, seed));
  });

  it.each([0, 1, 2, 3, 15, 16, 17])('matches the original for %i fixed-size contacts', (n) => {
    expectIdentical(fixedDirectory(n));
  });

  it('matches the original around a unit-count change (n-1, n, n+1)', () => {
    // Find the first count whose data region needs one more erase unit than the count before.
    const unitsFor = (n: number) =>
      prepareAtD890DigitalContactWrite(fixedDirectory(n), 'all').units.length;
    let lo = 1;
    let hi = 6_000;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (unitsFor(mid) === unitsFor(lo)) lo = mid;
      else hi = mid;
    }
    const n = hi;
    expect(unitsFor(n)).toBeGreaterThan(unitsFor(n - 1));
    for (const count of [n - 1, n, n + 1]) expectIdentical(fixedDirectory(count));
  });

  it('matches the original when the data stream is block-aligned and when it is not', () => {
    const lengths = new Set<number>();
    for (let n = 1; n <= 40; n++) {
      const pack = packAtD890DigitalContacts(fixedDirectory(n), 'all');
      lengths.add(pack.dataLinear.length % AT_D890_BLOCK_SIZE === 0 ? 0 : 1);
      expectIdentical(fixedDirectory(n));
    }
    // Both shapes are exercised: a padded last block and an exact multiple.
    expect(lengths.size).toBe(2);
  });

  it('handles an empty directory', () => {
    expect(frames(prepareAtD890DigitalContactWrite([], 'all').chunks)).toBe(
      frames(legacyPrepare([]).chunks),
    );
  });

  it('crosses more than one erase unit in the data region at 12,000 contacts', () => {
    const { units } = prepareAtD890DigitalContactWrite(seededDirectory(12_000, 14), 'all');
    expect(units.length).toBeGreaterThan(3);
    expect(units).toContain(eraseUnitBaseFor(D890_MAP.DigitalContactMeta));
  });
});

describe('bucketChunksByUnit', () => {
  it('reads each chunk address a constant number of times, not once per unit', () => {
    const chunks: AtD890StagingChunk[] = [];
    let reads = 0;
    const units = 40;
    const perUnit = 50;
    for (let u = 0; u < units; u++) {
      for (let i = 0; i < perUnit; i++) {
        const address = D890_MAP.DigitalContactData + u * AT_D890_ERASE_UNIT_BYTES + i * 16;
        chunks.push({
          get address() {
            reads += 1;
            return address;
          },
          data: new Uint8Array(16),
        });
      }
    }
    const grouped = bucketChunksByUnit(chunks);
    expect(grouped.size).toBeGreaterThanOrEqual(units);
    expect([...grouped.values()].reduce((n, b) => n + b.length, 0)).toBe(chunks.length);
    // The original did units x chunks reads (here 80,000); one pass does one per chunk.
    expect(reads).toBe(chunks.length);
  });
});
