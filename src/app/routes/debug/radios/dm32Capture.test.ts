import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import type { RadioBackupRegionV1 } from '@integrations/radio-io/backup/types.ts';
import { encodeDm32ChannelLocationPage } from '@integrations/radio-io/radios/dm32uv/channelLocationCodec.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import {
  classifyDm32DebugCoverage,
  dm32DebugIdentity,
} from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import { classifyDm32Metadata } from '@integrations/radio-io/radios/dm32uv/memory.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { openDebugArchive } from './captureArchive.ts';

const page = (tag: number, fill = 0) => {
  const data = new Uint8Array(4096).fill(fill);
  data[0xfff] = tag;
  return data;
};
const block = (address: number, metadata: number) => ({
  address,
  metadata,
  type: classifyDm32Metadata(metadata),
});

function syntheticCapture(overrides: Partial<Dm32DebugCapture> = {}): Dm32DebugCapture {
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    modelString: 'DP570UV',
    factory: { status: 'kept', bytes: new Uint8Array(4096).fill(0x5a) },
    vframes: [
      { id: 0x01, status: 'ok', payload: new TextEncoder().encode('DM32.SYN.001\0') },
      { id: 0x02, status: 'ok', payload: Uint8Array.from({ length: 12 }, (_, i) => i + 0xa0) },
      { id: 0x03, status: 'failed', reason: 'V-frame id mismatch' },
      { id: 0x0a, status: 'ok', payload: new Uint8Array([0, 0x10, 0, 0, 0xff, 0x5f, 0, 0]) },
    ],
    rawRange: { start: 0x1000, end: 0x5fff },
    window: { start: 0x1000, end: 0x5000 },
    discovered: [
      block(0x1000, 0x12),
      block(0x2000, 0x04),
      block(0x3000, 0x03),
      block(0x4000, 0x02),
      block(0x5000, 0x02),
    ],
    channelCount: 1,
    blocks: new Map([
      [0x1000, page(0x12, 1)],
      [0x2000, page(0x04, 2)],
      [0x4000, page(0x02, 3)],
      [0x5000, page(0x02, 4)],
    ]),
    ...overrides,
  };
}

const sha = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))));

describe('DM-32 debug archive', () => {
  it('packs one entry per contiguous run plus the factory sector, all inspect-only', async () => {
    const live = await archiveDm32Capture(syntheticCapture());
    expect(live.source).toBe('live-read');
    expect(live.manifest).toMatchObject({
      radioModelId: 'DM-32UV',
      coverage: 'partial',
      addressBase: 0x1000,
      imageByteLength: 0x5000,
    });
    expect(live.manifest.serial).toBeUndefined();
    expect(live.manifest.regions.map((r) => [r.id, r.address, r.byteLength])).toEqual([
      ['sparse-1000', 0x1000, 0x2000],
      ['sparse-4000', 0x4000, 0x2000],
      ['factory-sector', 0x0300b000, 4096],
    ]);
    expect(live.manifest.regions.every((r) => r.restoreRole === 'inspect-only')).toBe(true);
    expect(Object.keys(live.sidecars).sort()).toEqual([
      'calibration.json',
      'debug/capture.json',
      'debug/v-frames.json',
      'factory-sector.json',
    ]);
    const record = JSON.parse(new TextDecoder().decode(live.sidecars['debug/capture.json']));
    expect(record.discovered).toHaveLength(5);
    expect(record.extraReadTags).toEqual([]);
    expect(record.v0a).toEqual({ start: 0x1000, end: 0x5fff });
  });

  it('omits the factory region when not kept and says why', async () => {
    const live = await archiveDm32Capture(
      syntheticCapture({ factory: { status: 'not-kept', reason: 'mismatch' } }),
    );
    expect(live.manifest.regions.some((r) => r.id === 'factory-sector')).toBe(false);
    expect(
      JSON.parse(new TextDecoder().decode(live.sidecars['factory-sector.json'])),
    ).toMatchObject({ kept: false, reason: 'mismatch' });
  });

  it('classifies each window block, calibration roles and the factory sector', async () => {
    const live = await archiveDm32Capture(syntheticCapture());
    const coverage = classifyDm32DebugCoverage(live.manifest, live.regions, live.sidecars);
    expect(coverage.blocks.map((b) => [b.address, b.status, b.tag, b.calibration])).toEqual([
      [0x1000, 'captured', 0x12, undefined],
      [0x2000, 'captured', 0x04, undefined],
      [0x3000, 'discovered, not read', 0x03, undefined],
      [0x4000, 'captured', 0x02, 'live'],
      [0x5000, 'captured', 0x02, 'duplicate'],
    ]);
    expect(coverage.factory?.id).toBe('factory-sector');
    expect(coverage.unclassified).toEqual([]);
  });

  it('reopens with the same bytes, hashes, sidecars, coverage and identity', async () => {
    const live = await archiveDm32Capture(syntheticCapture());
    const file = openDebugArchive(live.zipBytes, 'DM-32UV');
    expect(file.source).toBe('file');
    expect(file.manifest).toEqual(live.manifest);
    expect(file.sidecars).toEqual(live.sidecars);
    for (const id of Object.keys(live.regions))
      expect(await sha(file.regions[id]!)).toEqual(await sha(live.regions[id]!));
    expect(classifyDm32DebugCoverage(file.manifest, file.regions, file.sidecars)).toEqual(
      classifyDm32DebugCoverage(live.manifest, live.regions, live.sidecars),
    );
    const identity = dm32DebugIdentity(file.sidecars, file.manifest.regions, file.regions);
    expect(identity).toEqual(dm32DebugIdentity(live.sidecars, live.manifest.regions, live.regions));
    expect(identity.modelString).toBe('DP570UV');
    expect(identity.baseFirmware?.text).toBe('DM32.SYN.001');
    expect(identity.chipUidHex).toBe('a0a1a2a3a4a5a6a7a8a9aaab');
    expect(identity.vframes.find((v) => v.id === 0x03)?.failed).toMatch(/mismatch/);
    expect(identity.mm9pdyDataPresent).toBe(false);
  });

  it('reports MM9PDY-compatible data only for a decodable location page', async () => {
    const location = encodeDm32ChannelLocationPage(0, 'km', new Map());
    const live = await archiveDm32Capture(
      syntheticCapture({ blocks: new Map([[0x3000, location]]) }),
    );
    expect(dm32DebugIdentity(live.sidecars, live.manifest.regions, live.regions)).toMatchObject({
      mm9pdyDataPresent: true,
    });
    const broken = location.slice();
    broken[0] = 0;
    const bad = await archiveDm32Capture(syntheticCapture({ blocks: new Map([[0x3000, broken]]) }));
    expect(dm32DebugIdentity(bad.sidecars, bad.manifest.regions, bad.regions)).toMatchObject({
      mm9pdyDataPresent: false,
    });
  });

  it('refuses another model, and invalid or unknown archives', async () => {
    const live = await archiveDm32Capture(syntheticCapture());
    expect(() => openDebugArchive(live.zipBytes, 'AT-D890UV')).toThrow(/does not match/);
    expect(() => openDebugArchive(new Uint8Array([1, 2, 3]), 'DM-32UV')).toThrow();
  });
});

function pack(
  regions: { region: Omit<RadioBackupRegionV1, 'path' | 'byteLength'>; bytes: Uint8Array }[],
  extra: { addressBase?: number; imageByteLength?: number; serial?: string; firmware?: string },
) {
  const zip = packRadioBackupZip(
    {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: '2026-01-02T00:00:00.000Z',
      capturedVia: 'web-serial',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: 'DM-32UV',
      descriptorLabel: 'DM-32UV',
      coverage: 'known-map-regions',
      imageByteLength: extra.imageByteLength ?? 0x5000,
      ...(extra.addressBase !== undefined ? { addressBase: extra.addressBase } : {}),
      ...(extra.serial ? { serial: extra.serial } : {}),
      ...(extra.firmware ? { firmware: extra.firmware } : {}),
      regions: regions.map(({ region, bytes }) => ({
        ...region,
        byteLength: bytes.length,
        path: `regions/${region.id}.bin`,
      })),
    },
    Object.fromEntries(regions.map(({ region, bytes }) => [region.id, bytes])),
  );
  return openDebugArchive(zip, 'DM-32UV');
}

describe('DM-32 coverage for build Backup and unusual archives', () => {
  it('classifies a build Backup archive by window and factory-sector, not by region id', () => {
    const archive = pack(
      [
        {
          region: { id: 'region-0x1000', label: 'R', address: 0x1000, restoreRole: 'restorable' },
          bytes: page(0x12),
        },
        {
          region: {
            id: 'calibration-0x4000',
            label: 'Live calibration page',
            address: 0x4000,
            restoreRole: 'inspect-only',
          },
          bytes: page(0x02),
        },
        {
          region: {
            id: 'factory-sector',
            label: 'Factory',
            address: 0x0300b000,
            restoreRole: 'inspect-only',
          },
          bytes: new Uint8Array(4096),
        },
        {
          region: { id: 'font', label: 'F', address: 0x105000, restoreRole: 'inspect-only' },
          bytes: page(0x02),
        },
      ],
      { addressBase: 0x1000, serial: 'CLAIMED', firmware: 'CLAIMED' },
    );
    const coverage = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
    expect(coverage.discoveryRecorded).toBe(false);
    expect(coverage.blocks.map((b) => [b.address, b.status, b.calibration])).toEqual([
      [0x1000, 'captured', undefined],
      [0x2000, 'discovery not recorded', undefined],
      [0x3000, 'discovery not recorded', undefined],
      [0x4000, 'captured', 'live'],
      [0x5000, 'discovery not recorded', undefined],
    ]);
    expect(coverage.factory?.id).toBe('factory-sector');
    expect(coverage.unclassified.map((u) => [u.region.id, u.reason])).toEqual([
      ['font', 'Outside the V-frame 0x0A window (a tag 0x02 page here is not calibration)'],
    ]);
    // Manifest claims never become identity.
    const identity = dm32DebugIdentity(archive.sidecars, archive.manifest.regions, archive.regions);
    expect(identity).toEqual({ vframes: [], mm9pdyDataPresent: false });
  });

  it('leaves overlapping entries and archives with no window unclassified', () => {
    const overlapping = pack(
      [
        {
          region: { id: 'a', label: 'A', address: 0x1000, restoreRole: 'inspect-only' },
          bytes: new Uint8Array(0x2000),
        },
        {
          region: { id: 'b', label: 'B', address: 0x2000, restoreRole: 'inspect-only' },
          bytes: page(0x04),
        },
      ],
      { addressBase: 0x1000 },
    );
    const coverage = classifyDm32DebugCoverage(
      overlapping.manifest,
      overlapping.regions,
      overlapping.sidecars,
    );
    expect(coverage.unclassified.map((u) => u.region.id).sort()).toEqual(['a', 'b']);
    expect(coverage.blocks.every((b) => b.status !== 'captured')).toBe(true);

    const noWindow = pack(
      [
        {
          region: { id: 'a', label: 'A', address: 0x1000, restoreRole: 'inspect-only' },
          bytes: page(0x04),
        },
      ],
      {},
    );
    const none = classifyDm32DebugCoverage(noWindow.manifest, noWindow.regions);
    expect(none.window).toBeUndefined();
    expect(none.blocks).toEqual([]);
    expect(none.unclassified[0]?.reason).toMatch(/window/);
  });

  it('ignores a capture sidecar that does not match the window', async () => {
    const live = await archiveDm32Capture(syntheticCapture());
    const coverage = classifyDm32DebugCoverage(
      { ...live.manifest, addressBase: 0x2000, imageByteLength: 0x4000 },
      live.regions,
      live.sidecars,
    );
    expect(coverage.discoveryRecorded).toBe(false);
  });
});
