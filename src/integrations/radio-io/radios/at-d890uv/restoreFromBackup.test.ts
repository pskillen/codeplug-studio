import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
  type RadioBackupRegionV1,
} from '../../backup/types.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  AT_D890_LIMITS,
  AT_D890_MAP_SIZE,
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from './constants.ts';
import { AtD890uvProtocol } from './protocol.ts';
import { listAtD890RestoreModelledChunks } from './restoreFromBackup.ts';
import {
  AtD890ScriptedPipe,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
  writePayloadAt,
} from './__fixtures__/scriptedPipe.ts';

const TEST_SERIAL = 'SN-TEST-RESTORE01';
const here = dirname(fileURLToPath(import.meta.url));

function region(
  id: string,
  address: number,
  byteLength: number,
  restoreRole: RadioBackupRegionV1['restoreRole'],
): RadioBackupRegionV1 {
  return {
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole,
  };
}

function manifest(regions: RadioBackupRegionV1[]): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'Anytone AT-D890UV',
    coverage: 'known-map-regions',
    imageByteLength: AT_D890_MAP_SIZE,
    regions,
  };
}

describe('listAtD890RestoreModelledChunks', () => {
  it('omits LocalInfo, alarm, and the family skip address even if selected', () => {
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, 0x11);
    image.fill(D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength, 0x22);
    image.fill(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, 0x33);
    image.fill(AT_D890_SAFE_SKIP_WRITE_ADDR - 0x10, 0x30, 0x55);

    const archive = {
      manifest: manifest([
        region('local-info', D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, 'inspect-only'),
        region('alarm-bitmap', D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength, 'inspect-only'),
        region('channel-set', D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, 'restorable'),
        region('near-skip', AT_D890_SAFE_SKIP_WRITE_ADDR - 0x10, 0x30, 'restorable'),
        region('skip', AT_D890_SAFE_SKIP_WRITE_ADDR, 0x10, 'restorable'),
      ]),
      image,
    };
    const chunks = listAtD890RestoreModelledChunks(archive, [
      'local-info',
      'alarm-bitmap',
      'channel-set',
      'near-skip',
      'skip',
    ]);
    const addrs = chunks.map((c) => c.address);
    expect(addrs).toContain(D890_MAP.ChannelSet);
    expect(addrs.some((a) => a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100)).toBe(
      false,
    );
    expect(addrs).not.toContain(D890_MAP.AlarmBitmap);
    expect(addrs).not.toContain(AT_D890_SAFE_SKIP_WRITE_ADDR);
  });

  it('does not import assemble / write-from-build helpers', () => {
    const src = readFileSync(join(here, 'restoreFromBackup.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/hydration\.ts'/);
    expect(src).not.toMatch(/from '\.\/memory\.ts'/);
    expect(src).not.toMatch(/prepareRadioWriteImage/);
  });
});

describe('AtD890uvProtocol.restoreFromBackup', () => {
  it('writes restorable channels and zones, never LocalInfo or skip addr', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);

    const unit348 = makeAtD890EraseUnitBuffer();
    unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
    const unit350 = makeAtD890EraseUnitBuffer();
    unit350[0] = 0x01;
    scriptAtD890UploadReadResponder(
      pipe,
      new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(TEST_SERIAL)],
        [0x348_0000, unit348],
        [0x350_0000, unit350],
        [0x200_0000, makeAtD890EraseUnitBuffer()],
      ]),
    );
    enableAtD890AutoWriteAck(pipe);

    const image = createMemoryMap(AT_D890_MAP_SIZE);
    image.fill(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES, 0x21);
    image.fill(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES, 0x31);
    image.fill(D890_MAP.OptionalSettingsMain, D890_MAP.OptionalSettingsMainLength, 0x41);
    image.fill(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, 0x99);
    image.fill(AT_D890_SAFE_SKIP_WRITE_ADDR, 0x10, 0x77);
    image.fill(D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength, 0xee);

    await radio.restoreFromBackup(
      {
        manifest: manifest([
          region('local-info', D890_MAP.LocalInfo, D890_MAP.LocalInfoLength, 'inspect-only'),
          region('alarm-bitmap', D890_MAP.AlarmBitmap, D890_MAP.AlarmBitmapLength, 'inspect-only'),
          region(
            'channel-set',
            D890_MAP.ChannelSet,
            AT_D890_LIMITS.CHANNEL_SET_BYTES,
            'restorable',
          ),
          region('zone-set', D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES, 'restorable'),
          region(
            'optional-settings-main',
            D890_MAP.OptionalSettingsMain,
            D890_MAP.OptionalSettingsMainLength,
            'restorable',
          ),
          region('skip', AT_D890_SAFE_SKIP_WRITE_ADDR, 0x10, 'restorable'),
        ]),
        image,
      },
      {
        regionIds: [
          'local-info',
          'alarm-bitmap',
          'channel-set',
          'zone-set',
          'optional-settings-main',
          'skip',
        ],
      },
    );

    const written = collectAtD890WriteDataAddresses(pipe);
    expect(written).toContain(D890_MAP.ChannelSet);
    expect(written).toContain(D890_MAP.ZoneSet);
    expect(written).toContain(D890_MAP.OptionalSettingsMain);
    expect(written).not.toContain(AT_D890_SAFE_SKIP_WRITE_ADDR);
    expect(written.some((a) => a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100)).toBe(
      false,
    );
    expect(writePayloadAt(pipe, D890_MAP.ChannelSet)?.[0]).toBe(0x21);
    expect(writePayloadAt(pipe, D890_MAP.OptionalSettingsMain)?.[0]).toBe(0x41);
    expect(writePayloadAt(pipe, D890_MAP.AlarmBitmap)?.[0]).toBe(0xab);
  });
});
