import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { syntheticZip } from './uv5rMiniLegacyArchive.fixture.ts';
import { openUv5rMiniReadsZip } from './uv5rMiniLegacyArchive.ts';

describe('legacy Mini reads archives', () => {
  it('reopens all recorded bytes, metadata and hashes', () => {
    const [read] = openUv5rMiniReadsZip(syntheticZip());
    expect(read?.label).toBe('A');
    expect(read?.readAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(read?.spans).toHaveLength(5);
    expect(read?.raw[0]).toBe(0x37);
  });
  it('rejects missing, changed or unrecognised entries', () => {
    const files = unzipSync(syntheticZip());
    delete files['A/raw.bin'];
    expect(() => openUv5rMiniReadsZip(zipSync(files))).toThrow();
    const changed = unzipSync(syntheticZip());
    changed['A/decoded.bin']![0] ^= 1;
    expect(() => openUv5rMiniReadsZip(zipSync(changed))).toThrow();
    const extra = unzipSync(syntheticZip());
    extra['extra'] = strToU8('unexpected');
    expect(() => openUv5rMiniReadsZip(zipSync(extra))).toThrow();
  });
});
