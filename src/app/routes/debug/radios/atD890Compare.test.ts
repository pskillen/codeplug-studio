import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import { openDebugArchive } from './captureArchive.ts';
import { compareAtD890 } from './atD890Compare.ts';
import { AT_D890_PROVENANCE_PATH } from './atD890Provenance.ts';

function archive(parts: [number, number[]][]) {
  const regions = parts.map(([address, bytes]) => ({
    id: `sparse-${address.toString(16)}`,
    label: 'Sparse',
    address,
    byteLength: bytes.length,
    path: `regions/sparse-${address.toString(16)}.bin`,
    restoreRole: 'inspect-only' as const,
  }));
  const data = Object.fromEntries(
    parts.map(([address, bytes]) => [`sparse-${address.toString(16)}`, Uint8Array.from(bytes)]),
  );
  const ranges = regions.map((r) => ({
    regionId: r.id,
    address: r.address,
    byteLength: r.byteLength,
    kind: 'sparse',
    requestedUnit: null,
    respondingUnit: null,
    bothReadsMatched: null,
  }));
  return openDebugArchive(
    packRadioBackupZip(
      {
        format: RADIO_BACKUP_FORMAT,
        version: RADIO_BACKUP_VERSION,
        capturedAt: '2026-01-01',
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'AT-D890UV',
        descriptorLabel: 'synthetic',
        coverage: 'partial',
        imageByteLength: 0x5000000,
        regions,
      },
      data,
      {
        [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(JSON.stringify({ version: 1, ranges })),
      },
    ),
    'AT-D890UV',
  );
}

describe('D890 range comparison', () => {
  it('compares intersections across different boundaries and reports missing spans', () => {
    const result = compareAtD890(
      archive([
        [0, [1, 2, 3, 4]],
        [8, [9]],
      ]),
      archive([
        [0, [1, 7]],
        [2, [3, 4, 5]],
      ]),
    );
    expect(result?.map(({ start, end, changed }) => [start, end, changed])).toEqual([
      [0, 2, 1],
      [2, 4, 0],
      [4, 5, undefined],
      [8, 9, undefined],
    ]);
  });
  it('refuses absent or malformed claims', () => {
    const first = archive([[0, [1]]]);
    expect(compareAtD890(first, { ...first, sidecars: {} })).toBeUndefined();
  });
  it('refuses ambiguous overlapping bytes', () => {
    const result = compareAtD890(
      archive([
        [0, [1, 2, 3]],
        [1, [2, 3]],
      ]),
      archive([[0, [1, 2, 3]]]),
    );
    expect(result?.map(({ start, end, changed }) => [start, end, changed])).toEqual([
      [0, 1, 0],
      [1, 3, undefined],
    ]);
  });
});

function vitalArchive(opts: {
  tuneA?: number[];
  tuneB?: number[];
  responding?: Record<string, string | null>;
  repeat?: boolean | null;
}) {
  const defs = AT_D890_VITAL_UNITS;
  const present = defs.filter(
    (u) => (u.id === 'tune-a' && opts.tuneA) || (u.id === 'tune-b' && opts.tuneB),
  );
  const bytesFor = (id: string) => {
    const data = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
    data.set((id === 'tune-a' ? opts.tuneA : opts.tuneB) ?? []);
    return data;
  };
  const regions = present.map((u) => ({
    id: `vital-${u.id}`,
    label: u.label,
    address: u.address,
    byteLength: AT_D890_VITAL_UNIT_BYTES,
    path: `regions/vital-${u.id}.bin`,
    restoreRole: 'inspect-only' as const,
  }));
  const ranges = present.map((u) => ({
    regionId: `vital-${u.id}`,
    address: u.address,
    byteLength: AT_D890_VITAL_UNIT_BYTES,
    kind: 'vital',
    requestedUnit: u.id,
    respondingUnit: opts.responding?.[u.id] ?? null,
    bothReadsMatched: opts.repeat === undefined ? true : opts.repeat,
  }));
  return openDebugArchive(
    packRadioBackupZip(
      {
        format: RADIO_BACKUP_FORMAT,
        version: RADIO_BACKUP_VERSION,
        capturedAt: '2026-01-01',
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'AT-D890UV',
        descriptorLabel: 'synthetic',
        coverage: 'partial',
        imageByteLength: 0x5000000,
        regions,
      },
      Object.fromEntries(present.map((u) => [`vital-${u.id}`, bytesFor(u.id)])),
      {
        [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(JSON.stringify({ version: 1, ranges })),
        'debug/vital.json': new TextEncoder().encode(
          JSON.stringify({ bothReadsMatched: true, units: defs }),
        ),
      },
    ),
    'AT-D890UV',
  );
}

describe('D890 responding-unit verdicts', () => {
  it('stays Unknown for identical bytes without explicit evidence', () => {
    const spans = compareAtD890(
      vitalArchive({ tuneA: [1, 2, 3] }),
      vitalArchive({ tuneA: [1, 2, 3] }),
    )!;
    expect(spans[0]).toMatchObject({ unitVerdict: 'unknown', changed: 0, runs: [] });
  });
  it('is Same or Different only from explicit claims on both sides, apart from the bytes', () => {
    const same = compareAtD890(
      vitalArchive({ tuneA: [1], responding: { 'tune-a': 'tune-a' } }),
      vitalArchive({ tuneA: [9], responding: { 'tune-a': 'tune-a' } }),
    )!;
    expect(same[0]).toMatchObject({ unitVerdict: 'same', changed: 1 });
    const different = compareAtD890(
      vitalArchive({ tuneA: [1], responding: { 'tune-a': 'tune-a' } }),
      vitalArchive({ tuneA: [1], responding: { 'tune-a': 'local-info' } }),
    )!;
    expect(different[0]).toMatchObject({ unitVerdict: 'different', changed: 0 });
    expect(different[0]!.provenanceDiffers).toEqual(['responding unit claim']);
    const oneSided = compareAtD890(
      vitalArchive({ tuneA: [1], responding: { 'tune-a': 'tune-a' } }),
      vitalArchive({ tuneA: [1] }),
    )!;
    expect(oneSided[0]!.unitVerdict).toBe('unknown');
  });
  it('refuses a vital claim whose repeat read did not match', () => {
    expect(
      compareAtD890(vitalArchive({ tuneA: [1], repeat: false }), vitalArchive({ tuneA: [1] })),
    ).toBeUndefined();
  });
  it('keeps tune-b in its own space and never relabels it as tune-a', () => {
    const spans = compareAtD890(
      vitalArchive({ tuneA: [1], tuneB: [1] }),
      vitalArchive({ tuneB: [2] }),
    )!;
    expect(spans.map((s) => [s.space, s.changed])).toEqual([
      ['vital:tune-a', undefined],
      ['vital:tune-b', 1],
    ]);
  });
  it('lists every changed byte as runs with before and after', () => {
    const spans = compareAtD890(
      vitalArchive({ tuneA: [1, 2, 3, 4, 5, 6] }),
      vitalArchive({ tuneA: [1, 9, 9, 4, 5, 7] }),
    )!;
    expect(
      spans[0]!.runs!.map((r) => [r.start, r.length, Array.from(r.before), Array.from(r.after)]),
    ).toEqual([
      [0x04f00001, 2, [2, 3], [9, 9]],
      [0x04f00005, 1, [6], [7]],
    ]);
  });
  it('keeps every byte of a long changed run, not a preview', () => {
    const spans = compareAtD890(
      vitalArchive({ tuneA: Array(100).fill(1) }),
      vitalArchive({ tuneA: Array(100).fill(2) }),
    )!;
    const run = spans[0]!.runs![0]!;
    expect(run.length).toBe(100);
    expect(run.before).toHaveLength(100);
    expect(Array.from(run.after).every((b) => b === 2)).toBe(true);
  });
  it('leaves sparse ranges outside the real memory map unclassified and uncompared', () => {
    const outside = 0x5000000 + 0x100;
    const spans = compareAtD890(archive([[outside, [1, 2]]]), archive([[outside, [1, 2]]]))!;
    expect(spans.map((s) => [s.space, s.changed, s.runs])).toEqual([
      ['unclassified', undefined, undefined],
      ['unclassified', undefined, undefined],
    ]);
  });
  it('refuses hostile claims: unknown unit names and sparse unit claims', () => {
    const base = vitalArchive({ tuneA: [1] });
    const forge = (patch: object) => {
      const claim = JSON.parse(new TextDecoder().decode(base.sidecars[AT_D890_PROVENANCE_PATH]));
      claim.ranges[0] = { ...claim.ranges[0], ...patch };
      return {
        ...base,
        sidecars: {
          ...base.sidecars,
          [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(JSON.stringify(claim)),
        },
      };
    };
    expect(compareAtD890(forge({ respondingUnit: 'unit-x' }), base)).toBeUndefined();
    expect(compareAtD890(forge({ respondingUnit: 7 }), base)).toBeUndefined();
    expect(compareAtD890(forge({ respondingUnit: 'tune-a' }), base)).toBeDefined();
    const sparseClaim = archive([[0, [1]]]);
    const sparseForged = {
      ...sparseClaim,
      sidecars: {
        [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(
          JSON.stringify({
            version: 1,
            ranges: [
              {
                regionId: 'sparse-0',
                address: 0,
                byteLength: 1,
                kind: 'sparse',
                requestedUnit: null,
                respondingUnit: 'tune-a',
                bothReadsMatched: null,
              },
            ],
          }),
        ),
      },
    };
    expect(compareAtD890(sparseForged, sparseClaim)).toBeUndefined();
  });
});
