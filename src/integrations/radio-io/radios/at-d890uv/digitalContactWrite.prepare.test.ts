/**
 * The prepared AT-D890UV contact Write (#1558): byte-identical to the original algorithm, and
 * bucketed by unit in one pass instead of a filter over every chunk per unit.
 *
 * `legacyPrepare` is the original implementation, kept here as the reference: a filter over all the
 * modelled chunks once per unit, a 2M-entry address set, and a copy of every staged block.
 */
import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { packAtD890DigitalContacts } from './digitalContactCodec.ts';
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

/** The original prepare, verbatim apart from the chunk source. */
function legacyPrepare(contacts: readonly RadioDigitalContactDto[]) {
  const pack = packAtD890DigitalContacts(contacts);
  // The original codec padded every block into its own buffer; rebuild the chunks that way.
  const modelledChunks: AtD890StagingChunk[] = pack.stagingChunks.map((c) => {
    const padded = new Uint8Array(16).fill(0xff);
    padded.set(c.data);
    return { address: c.address, data: padded };
  });
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

function frames(chunks: readonly AtD890StagingChunk[]): string {
  return chunks
    .map((c) => `${c.address.toString(16)}:${Buffer.from(c.data).toString('hex')}`)
    .join('\n');
}

describe('prepareAtD890DigitalContactWrite (#1558)', () => {
  it.each([
    [1, 11],
    [37, 12],
    [4_000, 13],
    // Spans the order table's and the data region's unit boundaries (several 256 KiB units).
    [12_000, 14],
  ])('sends byte-identical frames to the original for %i seeded contacts', (n, seed) => {
    const contacts = seededDirectory(n, seed);
    const next = prepareAtD890DigitalContactWrite(contacts);
    const ref = legacyPrepare(contacts);
    expect(next.units).toEqual(ref.units);
    expect(frames(next.chunks)).toBe(frames(ref.chunks));
    expect([...next.anchors.entries()]).toEqual([...ref.anchors.entries()]);
    expect(preparedContactWriteBytes(next)).toBe(ref.chunks.length * 16);
  });

  it('handles an empty directory', () => {
    expect(frames(prepareAtD890DigitalContactWrite([]).chunks)).toBe(
      frames(legacyPrepare([]).chunks),
    );
  });

  it('crosses more than one erase unit in the data region at 12,000 contacts', () => {
    const { units } = prepareAtD890DigitalContactWrite(seededDirectory(12_000, 14));
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
