import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import {
  hashUv5rMiniDebugSpans,
  type Uv5rMiniFullRead,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import {
  buildUv5rMiniReadsZip,
  uv5rMiniReadLabel,
  Uv5rMiniDebugReadStore,
} from './uv5rMiniDebugReads.ts';

function syntheticRead(fill: number): Uv5rMiniFullRead {
  const decoded = new Uint8Array(0x10000).fill(fill);
  return {
    ident: { f: new Uint8Array(16).fill(0x01), m: new TextEncoder().encode('5RMINI-SYNTHETIC') },
    raw: decoded.map((b) => b ^ 0x10),
    decoded,
    spans: hashUv5rMiniDebugSpans(decoded),
  };
}

describe('uv5rMiniReadLabel', () => {
  it('labels A to Z, then AA, AB', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(uv5rMiniReadLabel)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
    ]);
  });
});

describe('Uv5rMiniDebugReadStore', () => {
  it('labels reads in order, with their time, and counts those not downloaded', () => {
    const store = new Uv5rMiniDebugReadStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const t = new Date('2026-01-02T03:04:05Z');
    store.add(syntheticRead(1), t);
    store.add(syntheticRead(2), t);
    let snap = store.getSnapshot();
    expect(snap.reads.map((r) => r.label)).toEqual(['A', 'B']);
    expect(snap.reads[0]!.readAt).toBe(t);
    expect(snap.undownloaded).toBe(2);

    store.markAllDownloaded();
    store.add(syntheticRead(3), t);
    snap = store.getSnapshot();
    expect(snap.reads.map((r) => r.label)).toEqual(['A', 'B', 'C']);
    expect(snap.undownloaded).toBe(1);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('keeps a stable snapshot between changes', () => {
    const store = new Uv5rMiniDebugReadStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});

describe('buildUv5rMiniReadsZip', () => {
  it('holds raw, decoded and a summary for every read', () => {
    const store = new Uv5rMiniDebugReadStore();
    store.add(syntheticRead(0x11), new Date('2026-01-02T03:04:05Z'));
    store.add(syntheticRead(0x22));
    const reads = store.getSnapshot().reads;
    const files = unzipSync(buildUv5rMiniReadsZip(reads));

    expect(Object.keys(files).sort()).toEqual([
      'A/decoded.bin',
      'A/raw.bin',
      'A/summary.txt',
      'B/decoded.bin',
      'B/raw.bin',
      'B/summary.txt',
    ]);
    expect(files['A/decoded.bin']).toEqual(reads[0]!.decoded);
    expect(files['B/raw.bin']).toEqual(reads[1]!.raw);
    const summary = strFromU8(files['A/summary.txt']!);
    expect(summary).toContain('Read A');
    expect(summary).toContain('Time 2026-01-02T03:04:05.000Z');
    expect(summary).toContain(
      `M ${'5RMINI-SYNTHETIC'
        .split('')
        .map((c) => c.charCodeAt(0).toString(16))
        .join('')}`,
    );
    for (const s of reads[0]!.spans) expect(summary).toContain(s.sha256);
    expect(summary).toContain('0xF000–0xFFFF Calibration');
  });
});
