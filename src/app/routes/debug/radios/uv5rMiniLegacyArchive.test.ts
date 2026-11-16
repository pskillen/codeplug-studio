import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import {
  decodeUv5rMiniFullRead,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { buildUv5rMiniReadsZip, Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { openUv5rMiniReadsZip } from './uv5rMiniLegacyArchive.ts';

function syntheticZip() {
  const store = new Uv5rMiniDebugReadStore();
  const raw = new Uint8Array(0x10000).fill(0x37);
  const decoded = decodeUv5rMiniFullRead(raw);
  store.add(
    {
      raw,
      decoded,
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      spans: hashUv5rMiniDebugSpans(decoded),
    },
    new Date('2026-01-01T00:00:00Z'),
  );
  return buildUv5rMiniReadsZip(store.getSnapshot().reads);
}
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
