import {
  radioReportFrame,
  withCrc,
} from '@core/radios/baofeng/uv-5r-mini/__fixtures__/radioReportFrame.ts';
import { describe, expect, it } from 'vitest';
import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { openDebugArchive, uv5rMiniArchiveDetails } from './captureArchive.ts';

describe('Mini debug capture', () => {
  it('preserves wire and decoded bytes, replies and clone coverage offline', () => {
    const raw = new Uint8Array(0x10000).fill(0x42);
    const decoded = decodeUv5rMiniFullRead(raw);
    const archive = archiveUv5rMiniRead(
      {
        raw,
        decoded,
        ident: { f: new Uint8Array(16).fill(1), m: new Uint8Array(15).fill(2) },
        spans: [],
      },
      '2026-01-01T00:00:00Z',
    );
    const reopened = openDebugArchive(archive.zipBytes, 'UV-5R Mini');
    expect(reopened.regions.clone).toEqual(decoded);
    expect(reopened.sidecars['debug/wire.bin']).toEqual(raw);
    expect(reopened.sidecars['debug/f.bin']).toEqual(new Uint8Array(16).fill(1));
    expect(reopened.sidecars['debug/m.bin']).toEqual(new Uint8Array(15).fill(2));
    expect(uv5rMiniArchiveDetails(reopened)?.coverage.every((r) => r.captured)).toBe(true);
    expect(uv5rMiniArchiveDetails(reopened)?.report).toBeUndefined();
    expect(() => openDebugArchive(archive.zipBytes, 'retevis-rt95')).toThrow();
  });
  it('refuses an incomplete read', () => {
    expect(() =>
      archiveUv5rMiniRead({
        raw: new Uint8Array(1),
        decoded: new Uint8Array(1),
        ident: { f: new Uint8Array(), m: new Uint8Array() },
        spans: [],
      }),
    ).toThrow(/Incomplete/);
  });
});

it('recognises only a validated live report and keeps all other evidence unknown', () => {
  const create = (frame: Uint8Array) => {
    const decoded = new Uint8Array(0x10000);
    decoded.set(frame, 0xefc0);
    const raw = decodeUv5rMiniFullRead(decoded);
    return archiveUv5rMiniRead({
      raw,
      decoded,
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      spans: [],
    });
  };
  const valid = radioReportFrame();
  const live = create(valid);
  expect(uv5rMiniArchiveDetails(live)?.report?.kind).toBe('report');
  expect(
    uv5rMiniArchiveDetails(openDebugArchive(live.zipBytes, 'UV-5R Mini'))?.report,
  ).toBeUndefined();
  const badCrc = valid.slice();
  badCrc[10] ^= 1;
  const unsupported = valid.slice();
  unsupported[4] = 3;
  withCrc(unsupported);
  for (const frame of [new Uint8Array(64), badCrc, unsupported]) {
    expect(uv5rMiniArchiveDetails(create(frame))?.report).toBeUndefined();
  }
});
