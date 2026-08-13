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
import {
  OPENGD77_TYPE_COMMAND,
  OPENGD77_TYPE_READ,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import {
  OPENGD77_CMD_CONTROL,
  OPENGD77_CONTROL_SAVE_REBOOT,
  OPENUV380_IMAGE_SIZE,
} from './constants.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from './backupRestoreRoles.ts';
import { collectDirtySectors, createOpenUv380Image, writeAbs } from './memory.ts';
import { OpenGd77Protocol, createOpenGd77Md9600Protocol } from './protocol.ts';
import {
  intendedOpenGd77RestoreImage,
  listOpenGd77RestoreDirtySectors,
} from './restoreFromBackup.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

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
    radioModelId: 'DM-1701',
    descriptorLabel: 'Baofeng DM-1701',
    coverage: 'known-map-regions',
    imageByteLength: OPENUV380_IMAGE_SIZE,
    regions,
  };
}

function fillRestorableSpans(image: ReturnType<typeof createOpenUv380Image>, value: number): void {
  for (const span of OPENGD77_BACKUP_FLASH_SPANS) {
    writeAbs(image, span.start, new Uint8Array(span.length).fill(value));
  }
}

function restorableManifestRegions(): RadioBackupRegionV1[] {
  return OPENGD77_BACKUP_FLASH_SPANS.map((span) =>
    region(span.id, span.start, span.length, span.restoreRole),
  );
}

describe('listOpenGd77RestoreDirtySectors', () => {
  it('marks restorable archive spans dirty vs an empty prior', () => {
    const image = createOpenUv380Image();
    fillRestorableSpans(image, 0xa5);
    const archive = { manifest: manifest(restorableManifestRegions()), image };
    const ids = OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id);
    const dirty = listOpenGd77RestoreDirtySectors(archive, ids);
    const expected = collectDirtySectors(createOpenUv380Image(), image);
    expect(dirty.map((s) => s.sectorAbs)).toEqual(expected.map((s) => s.sectorAbs));
    expect(dirty.length).toBeGreaterThan(0);
    expect(dirty.every((s) => s.payload.includes(0xa5))).toBe(true);
  });

  it('omits inspect-only regions even if selected', () => {
    const image = createOpenUv380Image();
    fillRestorableSpans(image, 0x11);
    const first = OPENGD77_BACKUP_FLASH_SPANS[0]!;
    const archive = {
      manifest: manifest([
        region(first.id, first.start, first.length, 'inspect-only'),
        ...OPENGD77_BACKUP_FLASH_SPANS.slice(1).map((span) =>
          region(span.id, span.start, span.length, 'restorable'),
        ),
      ]),
      image,
    };
    const dirty = listOpenGd77RestoreDirtySectors(
      archive,
      OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id),
    );
    const intended = intendedOpenGd77RestoreImage(
      archive,
      OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id),
    );
    expect(intended.bytes[0]).toBe(0xff);
    expect(dirty.length).toBeGreaterThan(0);
  });

  it('does not import assemble / write-projection helpers', () => {
    const src = readFileSync(join(here, 'restoreFromBackup.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/hydration\.ts'/);
    expect(src).not.toMatch(/encodeOpenGd77WriteImageFromPrior/);
    expect(src).not.toMatch(/prepareRadioWriteImage/);
    expect(src).not.toMatch(/\bassemble\(/);
  });
});

describe('OpenGd77Protocol.restoreFromBackup', () => {
  it('writes dirty FLASH vs blank prior and sends SAVE_REBOOT without a pre-write read', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(OPENGD77_BACKUP_FLASH_SPANS[0]!.start, 0xa5);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);
    const writesAfterConnect = pipe.writes.length;

    const image = createOpenUv380Image();
    fillRestorableSpans(image, 0xa5);

    const stages: string[] = [];
    await proto.restoreFromBackup(
      { manifest: manifest(restorableManifestRegions()), image },
      {
        regionIds: OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id),
        onProgress: (p) => {
          if (p.stage) stages.push(p.stage);
        },
      },
    );

    const restoreWrites = pipe.writes.slice(writesAfterConnect);
    const flashReads = restoreWrites.filter((w) => w[0] === OPENGD77_TYPE_READ && w[1] === 0x01);
    expect(flashReads).toHaveLength(0);

    const setSectors = restoreWrites.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    expect(setSectors.length).toBe(proto.getLastDirtySectorCount());
    expect(setSectors.length).toBeGreaterThan(0);

    const saveReboot = restoreWrites.filter(
      (w) =>
        w[0] === OPENGD77_TYPE_COMMAND &&
        w[1] === OPENGD77_CMD_CONTROL &&
        w[2] === OPENGD77_CONTROL_SAVE_REBOOT,
    );
    expect(saveReboot.length).toBe(1);
    expect(stages).toContain('Restore');
    expect(stages).not.toContain('Pre-write read');
    expect(pipe.flashByte(OPENGD77_BACKUP_FLASH_SPANS[0]!.start)).toBe(0xa5);
  });

  it('still programs matching live FLASH because dirty compare uses a blank prior', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    for (const span of OPENGD77_BACKUP_FLASH_SPANS) {
      for (let i = 0; i < span.length; i++) pipe.plantByte(span.start + i, 0x5a);
    }
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);

    const image = createOpenUv380Image();
    fillRestorableSpans(image, 0x5a);
    await proto.restoreFromBackup(
      { manifest: manifest(restorableManifestRegions()), image },
      { regionIds: OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id) },
    );
    expect(proto.getLastDirtySectorCount()).toBeGreaterThan(0);
  });

  it('is available on the MD-9600 protocol instance', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x05);
    const proto = createOpenGd77Md9600Protocol() as OpenGd77Protocol;
    await proto.connect(pipe);
    const image = createOpenUv380Image();
    fillRestorableSpans(image, 0x22);
    await proto.restoreFromBackup(
      { manifest: manifest(restorableManifestRegions()), image },
      { regionIds: OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id) },
    );
    expect(proto.getLastDirtySectorCount()).toBeGreaterThan(0);
  });
});
