import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
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
