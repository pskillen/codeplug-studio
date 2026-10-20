import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  memoryMapFromBackupRegions,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '../../backup/index.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { Dm32uvProtocol } from './protocol.ts';
import {
  assertDm32RestoreAddressMap,
  assertDm32RestoreUniqueOccupiedTags,
  listDm32RestoreBlocks,
} from './restoreFromBackup.ts';
import {
  Dm32ScriptedPipe,
  makeEmptyBlock,
  scriptDm32Connect,
} from './__fixtures__/scriptedPipe.ts';

const here = dirname(fileURLToPath(import.meta.url));

function region(
  id: string,
  address: number,
  data: Uint8Array,
  restoreRole: RadioBackupRegionV1['restoreRole'],
): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength: data.byteLength,
    path: `regions/${id}.bin`,
    restoreRole,
  };
}

function manifest(
  regions: RadioBackupRegionV1[],
  extras?: Partial<RadioBackupManifestV1>,
): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'DM-32UV',
    descriptorLabel: 'Baofeng DM-32UV',
    coverage: 'known-map-regions',
    imageByteLength: DM32_BLOCK_SIZE * 2,
    restoreFragileAfterFactoryReset: true,
    addressBase: 0x1000,
    dm32ContactsBase: 0x200000,
    dm32ContactsEnd: 0x200fff,
    regions,
    ...extras,
  };
}

function packedArchive(regionBytes: Record<string, Uint8Array>, regions: RadioBackupRegionV1[]) {
  const image = memoryMapFromBackupRegions(DM32_BLOCK_SIZE * 2, regions, regionBytes);
  return { manifest: manifest(regions), image };
}

describe('listDm32RestoreBlocks', () => {
  it('includes restorable blocks and omits calibration even when selected', () => {
    const zone = makeEmptyBlock(DM32_METADATA.ZONE);
    zone[0] = 0xa1;
    const cal = makeEmptyBlock(DM32_METADATA.CALIBRATION);
    cal[0] = 0x02;
    const regions = [
      region('region-0x1000', 0x1000, zone, 'restorable'),
      region('calibration-0x2000', 0x2000, cal, 'inspect-only'),
    ];
    const archive = packedArchive({ 'region-0x1000': zone, 'calibration-0x2000': cal }, regions);
    const blocks = listDm32RestoreBlocks(archive, ['region-0x1000', 'calibration-0x2000']);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.address).toBe(0x1000);
    expect(blocks[0]!.data[0]).toBe(0xa1);
    expect(blocks[0]!.data[DM32_BLOCK_SIZE - 1]).toBe(DM32_METADATA.ZONE);
  });

  it('does not import assemble / hydration merge / write-image helpers', () => {
    const src = readFileSync(join(here, 'restoreFromBackup.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/hydration\.ts'/);
    expect(src).not.toMatch(/mergeChannelsInto/);
    expect(src).not.toMatch(/prepareRadioWriteImage/);
    expect(src).not.toMatch(/remapDm32/);
    expect(src).not.toMatch(/\bassemble\(/);
  });
});

describe('assertDm32RestoreUniqueOccupiedTags', () => {
  it('refuses a repeated occupied tag and leaves both blocks in the list', () => {
    const lower = { address: 0x1000, data: makeEmptyBlock(DM32_METADATA.ZONE) };
    const higher = { address: 0x2000, data: makeEmptyBlock(DM32_METADATA.ZONE) };
    const blocks = [lower, higher];
    expect(() => assertDm32RestoreUniqueOccupiedTags(blocks)).toThrow(/erase the higher page/);
    expect(blocks).toEqual([lower, higher]);
  });

  it('allows different occupied tags', () => {
    expect(() =>
      assertDm32RestoreUniqueOccupiedTags([
        { address: 0x1000, data: makeEmptyBlock(DM32_METADATA.ZONE) },
        { address: 0x2000, data: makeEmptyBlock(DM32_METADATA.SCAN_LIST) },
      ]),
    ).not.toThrow();
  });

  it('allows repeated free-page markers', () => {
    expect(() =>
      assertDm32RestoreUniqueOccupiedTags([
        { address: 0x1000, data: makeEmptyBlock(DM32_METADATA.EMPTY) },
        { address: 0x2000, data: makeEmptyBlock(DM32_METADATA.EMPTY) },
        { address: 0x3000, data: makeEmptyBlock(DM32_METADATA.EMPTY_ALT) },
        { address: 0x4000, data: makeEmptyBlock(DM32_METADATA.EMPTY_ALT) },
      ]),
    ).not.toThrow();
  });
});

describe('assertDm32RestoreAddressMap', () => {
  it('refuses when live V-frame bases differ from the manifest', () => {
    expect(() =>
      assertDm32RestoreAddressMap(manifest([]), {
        addressBase: 0x9000,
        dm32ContactsBase: 0x200000,
        dm32ContactsEnd: 0x200fff,
      }),
    ).toThrow(/addressBase/);
  });

  it('allows matching live bases', () => {
    expect(() =>
      assertDm32RestoreAddressMap(manifest([]), {
        addressBase: 0x1000,
        dm32ContactsBase: 0x200000,
        dm32ContactsEnd: 0x200fff,
      }),
    ).not.toThrow();
  });
});

describe('Dm32uvProtocol.restoreFromBackup', () => {
  it('writes restorable blocks and never calibration, without a download', async () => {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32Connect(pipe, {
      start: 0x1000,
      end: 0x2fff,
      contactsBase: 0x200000,
      contactsEnd: 0x200fff,
    });
    const proto = new Dm32uvProtocol();
    await proto.connect(pipe, { settleScale: 0 });
    expect(proto.getDownloadCache()?.blocks.size).toBe(0);
    const writesAfterConnect = pipe.writes.length;

    const zone = makeEmptyBlock(DM32_METADATA.ZONE);
    zone[4] = 0x5c;
    const cal = makeEmptyBlock(DM32_METADATA.CALIBRATION);
    const regions = [
      region('region-0x1000', 0x1000, zone, 'restorable'),
      region('calibration-0x2000', 0x2000, cal, 'inspect-only'),
    ];
    const archive = packedArchive({ 'region-0x1000': zone, 'calibration-0x2000': cal }, regions);
    pipe.enqueue(new Uint8Array([0x06]));

    const stages: string[] = [];
    await proto.restoreFromBackup(archive, {
      regionIds: ['region-0x1000', 'calibration-0x2000'],
      onProgress: (p) => {
        if (p.stage) stages.push(p.stage);
      },
    });

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    const reads = restoreWrites.filter((w) => w[0] === 0x52);
    expect(reads).toHaveLength(0);
    const writes = restoreWrites.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE);
    expect(writes).toHaveLength(1);
    const addr = writes[0]![1]! | (writes[0]![2]! << 8) | (writes[0]![3]! << 16);
    expect(addr).toBe(0x1000);
    expect(writes[0]![6 + 4]).toBe(0x5c);
    expect(stages).toContain('Restore');
    expect(proto.takeUploadStagingSnapshot()).toBeUndefined();
  });

  it('refuses a factory-reset address-map mismatch before any write', async () => {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32Connect(pipe, { start: 0x9000, end: 0xafff });
    const proto = new Dm32uvProtocol();
    await proto.connect(pipe, { settleScale: 0 });
    const writesAfterConnect = pipe.writes.length;

    const zone = makeEmptyBlock(DM32_METADATA.ZONE);
    const regions = [region('region-0x1000', 0x1000, zone, 'restorable')];
    const archive = packedArchive({ 'region-0x1000': zone }, regions);

    await expect(
      proto.restoreFromBackup(archive, { regionIds: ['region-0x1000'] }),
    ).rejects.toThrow(/addressBase/);
    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    expect(
      restoreWrites.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE),
    ).toHaveLength(0);
  });

  async function connectMatching(): Promise<{ proto: Dm32uvProtocol; pipe: Dm32ScriptedPipe }> {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32Connect(pipe, {
      start: 0x1000,
      end: 0x2fff,
      contactsBase: 0x200000,
      contactsEnd: 0x200fff,
    });
    const proto = new Dm32uvProtocol();
    await proto.connect(pipe, { settleScale: 0 });
    return { proto, pipe };
  }

  function twoRegionArchive(first: Uint8Array, second: Uint8Array) {
    const regions = [
      region('region-0x1000', 0x1000, first, 'restorable'),
      region('region-0x2000', 0x2000, second, 'restorable'),
    ];
    return {
      archive: packedArchive({ 'region-0x1000': first, 'region-0x2000': second }, regions),
      regionIds: ['region-0x1000', 'region-0x2000'] as const,
    };
  }

  it('refuses duplicate occupied tags before any write', async () => {
    const { proto, pipe } = await connectMatching();
    const writesAfterConnect = pipe.writes.length;
    const { archive, regionIds } = twoRegionArchive(
      makeEmptyBlock(DM32_METADATA.ZONE),
      makeEmptyBlock(DM32_METADATA.ZONE),
    );

    await expect(proto.restoreFromBackup(archive, { regionIds })).rejects.toThrow(
      /erase the higher page/,
    );
    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    expect(
      restoreWrites.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE),
    ).toHaveLength(0);
  });

  it('writes a pair of different occupied tags', async () => {
    const { proto, pipe } = await connectMatching();
    const writesAfterConnect = pipe.writes.length;
    const { archive, regionIds } = twoRegionArchive(
      makeEmptyBlock(DM32_METADATA.ZONE),
      makeEmptyBlock(DM32_METADATA.SCAN_LIST),
    );
    pipe.enqueue(new Uint8Array([0x06]), new Uint8Array([0x06]));

    await proto.restoreFromBackup(archive, { regionIds });

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    expect(
      restoreWrites.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE),
    ).toHaveLength(2);
  });

  it('writes repeated free-page markers', async () => {
    const { proto, pipe } = await connectMatching();
    const writesAfterConnect = pipe.writes.length;
    const { archive, regionIds } = twoRegionArchive(
      makeEmptyBlock(DM32_METADATA.EMPTY),
      makeEmptyBlock(DM32_METADATA.EMPTY),
    );
    pipe.enqueue(new Uint8Array([0x06]), new Uint8Array([0x06]));

    await proto.restoreFromBackup(archive, { regionIds });

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    expect(
      restoreWrites.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE),
    ).toHaveLength(2);
  });
});
