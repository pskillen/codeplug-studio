/**
 * UV-5R Mini Backup and Restore through the app service: the MM9PDY profile carries the zone table as a fourth
 * region, a stock profile leaves it out, and Restore on the MM9PDY profile is open on prod like its Write.
 * Fakes only.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import { UV5R_MINI_LAYOUT as layout } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { FakeMiniRadio } from '@integrations/radio-io/radios/uv5r-mini/__fixtures__/fakeMiniRadio.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  encodeUv5rMiniZoneTable,
  type Uv5rMiniZoneTableInput,
} from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { Uv5rMiniProtocol } from '@integrations/radio-io/radios/uv5r-mini/protocol.ts';

vi.mock('@integrations/download/browserDownload.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/download/browserDownload.ts')>()),
  downloadZip: vi.fn(),
}));

import {
  backupLiveRadioSession,
  defaultRestorableRegionIds,
  isRestoreHiddenForProfile,
  openRadioBackupZip,
  restoreRadioBackup,
  restoreRegionUnavailableReason,
} from './radioBackupRestore.ts';

const STOCK = 'radio-io-uv5r-mini';
const MM9PDY = 'radio-io-uv5r-mini-mm9pdy';

function zones(n: number): Uv5rMiniZoneTableInput {
  return {
    zones: Array.from({ length: n }, (_, i) => ({
      name: `Zone ${i + 1}`,
      slotIndexes: [i, i + 50],
    })),
  };
}

async function radioWithTable(n: number): Promise<FakeMiniRadio> {
  const radio = new FakeMiniRadio();
  const proto = new Uv5rMiniProtocol();
  await proto.connect(radio, { handshake: 'none' });
  proto.setZoneIntent(zones(n));
  await proto.upload(createMemoryMap(layout.memTotal), {});
  radio.writes.length = 0;
  return radio;
}

async function sessionOn(radio: FakeMiniRadio) {
  const proto = new Uv5rMiniProtocol();
  await proto.connect(radio, { handshake: 'none' });
  radio.writes.length = 0;
  return createRadioSession({ descriptor: UV5R_MINI_DESCRIPTOR, pipe: radio, radio: proto });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('UV-5R Mini Backup by profile', () => {
  it('the MM9PDY profile adds the zone table region after the clone, and the zip opens with it at 0xC000', async () => {
    const radio = await radioWithTable(4);
    const result = await backupLiveRadioSession(await sessionOn(radio), { profileId: MM9PDY });
    expect(result.manifest.regions.map((r) => r.id)).toEqual(['mem-0', 'mem-1', 'mem-2', 'zones']);
    const zonesRegion = result.manifest.regions[3]!;
    expect(zonesRegion).toMatchObject({ address: 0xc000, byteLength: 0x1000 });
    expect(zonesRegion.label).toContain('4 zones');
    expect(radio.wAddresses()).toEqual([]);
    const parsed = parseRadioBackupZip(result.zipBytes);
    expect(parsed.regions['zones']).toEqual(radio.sector());
    expect(result.image.get(0xc000, 0x1000)).toEqual(radio.sector());
    const opened = openRadioBackupZip(result.zipBytes);
    expect(opened.image.get(0xc000, 0x1000)).toEqual(radio.sector());
    expect(opened.inspectBag).toBeDefined();
  });

  it('a stock profile Backup is unchanged: three regions, nothing read at or above 0xC000', async () => {
    const radio = await radioWithTable(4);
    const result = await backupLiveRadioSession(await sessionOn(radio), { profileId: STOCK });
    expect(result.manifest.regions.map((r) => r.id)).toEqual(['mem-0', 'mem-1', 'mem-2']);
    expect(radio.rAddresses().filter((a) => a >= 0xc000)).toEqual([]);
    expect(result.image.size).toBe(layout.memTotal);
  });
});

describe('UV-5R Mini Restore by profile', () => {
  it('MM9PDY: a Backup restores the table onto a radio with another table, header first', async () => {
    const source = await radioWithTable(3);
    const backup = await backupLiveRadioSession(await sessionOn(source), { profileId: MM9PDY });
    const archive = openRadioBackupZip(backup.zipBytes);
    const target = await radioWithTable(10);
    const regionIds = defaultRestorableRegionIds(archive.manifest, MM9PDY);
    expect(regionIds).toEqual(['mem-0', 'mem-1', 'mem-2', 'zones']);
    await restoreRadioBackup(await sessionOn(target), archive, {
      regionIds,
      profileId: MM9PDY,
      buildEnv: 'staging',
    });
    const w = target.wAddresses();
    const firstTable = w.findIndex((a) => a >= 0xc000);
    expect(w[firstTable]).toBe(0xc000);
    expect(w.slice(0, firstTable).every((a) => a < 0xb000)).toBe(true);
    expect(target.sector()).toEqual(source.sector());
    expect(target.sector()).toEqual(encodeUv5rMiniZoneTable(zones(3)).sector);
  });

  it('stock: the table is left out of the default selection, and naming it is refused before any frame', async () => {
    const source = await radioWithTable(3);
    const backup = await backupLiveRadioSession(await sessionOn(source), { profileId: MM9PDY });
    const archive = openRadioBackupZip(backup.zipBytes);
    const zonesRegion = archive.manifest.regions.find((r) => r.id === 'zones')!;
    expect(restoreRegionUnavailableReason(archive.manifest, zonesRegion, STOCK)).toMatch(/MM9PDY/);
    expect(restoreRegionUnavailableReason(archive.manifest, zonesRegion, MM9PDY)).toBeNull();
    expect(defaultRestorableRegionIds(archive.manifest, STOCK)).toEqual([
      'mem-0',
      'mem-1',
      'mem-2',
    ]);

    const target = await radioWithTable(10);
    const before = target.sector();
    await expect(
      restoreRadioBackup(await sessionOn(target), archive, {
        regionIds: ['mem-0', 'mem-1', 'mem-2', 'zones'],
        profileId: STOCK,
        buildEnv: 'prod',
      }),
    ).rejects.toThrow(/MM9PDY target only/);
    expect(target.wAddresses()).toEqual([]);

    await restoreRadioBackup(await sessionOn(target), archive, {
      regionIds: defaultRestorableRegionIds(archive.manifest, STOCK),
      profileId: STOCK,
      buildEnv: 'prod',
    });
    expect(target.wAddresses().every((a) => a < 0xb000)).toBe(true);
    expect(target.sector()).toEqual(before);
  });

  it('MM9PDY Restore is open on prod like its Write; stock Restore too', async () => {
    for (const env of ['prod', 'staging']) {
      expect(isRestoreHiddenForProfile(UV5R_MINI_DESCRIPTOR, MM9PDY, env)).toBe(false);
      expect(isRestoreHiddenForProfile(UV5R_MINI_DESCRIPTOR, STOCK, env)).toBe(false);
    }

    const source = await radioWithTable(3);
    const backup = await backupLiveRadioSession(await sessionOn(source), { profileId: MM9PDY });
    const archive = openRadioBackupZip(backup.zipBytes);
    const target = await radioWithTable(10);
    await restoreRadioBackup(await sessionOn(target), archive, {
      regionIds: ['mem-0', 'mem-1', 'mem-2', 'zones'],
      profileId: MM9PDY,
      buildEnv: 'prod',
    });
    expect(target.sector()).toEqual(source.sector());
  });
});
