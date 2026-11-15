import { describe, expect, it } from 'vitest';
import { archiveAtD890Capture } from './atD890Capture.ts';
import { openDebugArchive } from './captureArchive.ts';
import { classifyAtD890DebugCoverage } from '@integrations/radio-io/radios/at-d890uv/debugCoverage.ts';
import {
  AT_D890_VITAL_UNITS,
  AT_D890_VITAL_UNIT_BYTES,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';

describe('D890 debug archive', () => {
  it('preserves sparse holes, outside-map blocks and separate vital units across reopening', async () => {
    const capture = {
      capturedAt: '2026-01-01T00:00:00.000Z',
      ident: {
        raw: new Uint8Array([...new TextEncoder().encode('ID890UV\0\x01V100'), 0, 0, 0]),
        model: 'ID890UV',
        version: 'V100',
        bandCode: 1,
      },
      cache: {
        blocks: new Map([
          [0, new Uint8Array(16).fill(1)],
          [32, new Uint8Array(16).fill(2)],
          [0x06000000, new Uint8Array(16).fill(3)],
        ]),
      },
      vital: {
        bothReadsMatched: true as const,
        units: AT_D890_VITAL_UNITS.map((def) => ({
          def,
          bytes: new Uint8Array(AT_D890_VITAL_UNIT_BYTES),
        })),
      },
    };
    const live = archiveAtD890Capture(capture);
    const file = openDebugArchive(live.zipBytes, 'AT-D890UV');
    expect(file.regions['sparse-0']).toEqual(new Uint8Array(16).fill(1));
    expect(file.regions['sparse-20']).toEqual(new Uint8Array(16).fill(2));
    expect(file.regions['sparse-6000000']).toEqual(new Uint8Array(16).fill(3));
    expect(classifyAtD890DebugCoverage(file.manifest.regions).outside).toHaveLength(1);
    expect(
      classifyAtD890DebugCoverage(file.manifest.regions).vital.filter((v) => v.region),
    ).toHaveLength(4);
    expect(file.sidecars).toEqual(live.sidecars);
    expect(file.manifest).toEqual(live.manifest);
    expect(classifyAtD890DebugCoverage(file.manifest.regions)).toEqual(
      classifyAtD890DebugCoverage(live.manifest.regions),
    );
    const { atD890DebugIdentity } =
      await import('@integrations/radio-io/radios/at-d890uv/debugCoverage.ts');
    expect(
      atD890DebugIdentity(file.sidecars['debug/ident.bin'], file.manifest.regions, file.regions),
    ).toEqual(
      atD890DebugIdentity(live.sidecars['debug/ident.bin'], live.manifest.regions, live.regions),
    );
    for (const id of Object.keys(live.regions)) {
      const hash = async (bytes: Uint8Array) =>
        new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
      expect(await hash(file.regions[id]!)).toEqual(await hash(live.regions[id]!));
    }
    expect(() => openDebugArchive(live.zipBytes, 'UV-5R Mini')).toThrow(/does not match/);
  });
});

it('classifies partial and overlapping sparse ranges without inventing bytes and keeps unknown entries', () => {
  const mk = (id: string, address: number, byteLength: number) => ({
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only' as const,
  });
  const coverage = classifyAtD890DebugCoverage([
    mk('sparse-0', 0, 32),
    mk('sparse-10', 16, 32),
    mk('mystery', 40, 32),
    mk('sparse-6000000', 0x6000000, 16),
  ]);
  expect(coverage.map[0]).toEqual({ start: 0, end: 48, captured: true });
  expect(coverage.map[1]?.captured).toBe(false);
  expect(coverage.unclassified.map((r) => r.id)).toEqual(['mystery']);
  expect(coverage.outside.map((r) => r.id)).toEqual(['sparse-6000000']);
  expect(coverage.vital.every((v) => !v.region)).toBe(true);
});

it('derives identity from valid captured bytes, never manifest claims', async () => {
  const { atD890DebugIdentity } =
    await import('@integrations/radio-io/radios/at-d890uv/debugCoverage.ts');
  const ident = new Uint8Array(16);
  ident.set(new TextEncoder().encode('ID890UV'));
  ident[8] = 42;
  ident.set(new TextEncoder().encode('V100'), 9);
  const local = new Uint8Array(AT_D890_VITAL_UNIT_BYTES);
  local.set(new TextEncoder().encode('SERIAL123456789'), 0x30);
  const region = {
    id: 'vital-local-info',
    label: 'local',
    address: 0x04f80000,
    byteLength: local.length,
    path: 'regions/local.bin',
    restoreRole: 'inspect-only' as const,
  };
  expect(atD890DebugIdentity(ident, [region], { 'vital-local-info': local })).toMatchObject({
    ident: { model: 'ID890UV', bandCode: 42, version: 'V100' },
    serial: 'SERIAL123456789',
  });
  ident[0] = 0;
  expect(atD890DebugIdentity(ident, [], {}).ident).toBeUndefined();
  expect(atD890DebugIdentity(undefined, [region], {}).serial).toBeUndefined();
});

it('refuses invalid archive bytes', () => {
  expect(() => openDebugArchive(new Uint8Array([1, 2, 3]), 'AT-D890UV')).toThrow();
});

it('reopens partial overlapping and unknown archive entries without merging their provenance', async () => {
  const { packRadioBackupZip, RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } =
    await import('@integrations/radio-io/backup/index.ts');
  const make = (id: string, address: number, byteLength: number) => ({
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only' as const,
  });
  const regions = [make('sparse-0', 0, 32), make('sparse-10', 16, 32), make('unknown', 24, 16)];
  const bytes = {
    'sparse-0': new Uint8Array(32).fill(1),
    'sparse-10': new Uint8Array(32).fill(2),
    unknown: new Uint8Array(16).fill(3),
  };
  const zip = packRadioBackupZip(
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
    bytes,
  );
  const file = openDebugArchive(zip, 'AT-D890UV');
  const live = { ...file, source: 'live-read' as const };
  expect(file.regions).toEqual(bytes);
  expect(classifyAtD890DebugCoverage(file.manifest.regions)).toEqual(
    classifyAtD890DebugCoverage(live.manifest.regions),
  );
  expect(classifyAtD890DebugCoverage(file.manifest.regions).unclassified.map((r) => r.id)).toEqual([
    'unknown',
  ]);
  expect(file.zipBytes).toEqual(zip);
});

it('validates vital comparison metadata as a claim', async () => {
  const { atD890VitalComparison } =
    await import('@integrations/radio-io/radios/at-d890uv/debugCoverage.ts');
  const encode = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  expect(
    atD890VitalComparison(encode({ bothReadsMatched: true, units: AT_D890_VITAL_UNITS })),
  ).toBe(true);
  expect(atD890VitalComparison(encode({ bothReadsMatched: true, units: [] }))).toBe(false);
  expect(atD890VitalComparison(new Uint8Array([255]))).toBe(false);
});

it('does not treat expected spans or occupancy-skipped records as captured', () => {
  const coverage = classifyAtD890DebugCoverage([]);
  expect(coverage.map).toEqual([{ start: 0, end: 0x5000000, captured: false }]);
  expect(coverage.spans.length).toBeGreaterThan(0);
  expect(coverage.spans.every((span) => !span.captured)).toBe(true);
});
