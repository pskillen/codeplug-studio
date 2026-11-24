import { describe, expect, it } from 'vitest';
import { BLOCK_SIZE, EEPROM_IMAGE_END, FLASH_IMAGE_START } from './constants.ts';
import {
  buildRadioFoundryDebugArchiveParts,
  captureRadioFoundryDebugPipe,
  RADIOFOUNDRY_DEBUG_SUMS_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import { classifyRadioFoundryDebugCoverage } from './debugCoverage.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import { FakeRadioFoundryRadio } from './__fixtures__/fakeRadioFoundryRadio.ts';
import { MD9600_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { buildOpenGd77DebugArchiveParts } from '../opengd77/debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from '../opengd77/hydration.ts';
import { createOpenUv380Image } from '../opengd77/memory.ts';
import { makeOpenGd77FirmwareInfoPayload } from '../opengd77/__fixtures__/scriptedPipe.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';

const protocolOpts = { protocolOptions: { pause: async () => {} } };

const manifestBase = (regions: RadioBackupManifestV1['regions']): RadioBackupManifestV1 => ({
  format: RADIO_BACKUP_FORMAT,
  version: RADIO_BACKUP_VERSION,
  capturedAt: '2026-03-01T00:00:00.000Z',
  capturedVia: 'web-serial',
  app: { buildEnv: 'test', buildVersion: 'test' },
  radioModelId: 'MD-9600-RadioFoundry',
  descriptorLabel: 'test',
  coverage: 'partial',
  imageByteLength: 0,
  regions,
});

function sumsRow(address: number, blank: boolean): Uint8Array {
  const row = new Uint8Array(9);
  row[0] = address & 0xff;
  row[1] = (address >>> 8) & 0xff;
  row[2] = (address >>> 16) & 0xff;
  row[3] = (address >>> 24) & 0xff;
  row[8] = blank ? 1 : 0;
  return row;
}

describe('classifyRadioFoundryDebugCoverage', () => {
  it('classifies EEPROM and flash block counts without area 2', async () => {
    const pipe = new FakeRadioFoundryRadio({
      imageEnd: MD9600_RADIOFOUNDRY_CABLE_BOARD.limits.IMAGE_END,
      versionText: `proto=1\nboard=${MD9600_RADIOFOUNDRY_CABLE_BOARD.versionBoardNames[0]}\n`,
    });
    const capture = await captureRadioFoundryDebugPipe(
      pipe,
      MD9600_RADIOFOUNDRY_CABLE_BOARD,
      protocolOpts,
    );
    const parts = buildRadioFoundryDebugArchiveParts(capture);
    const cov = classifyRadioFoundryDebugCoverage(parts.manifest, parts.regions, parts.sidecars);
    expect(cov).toBeDefined();
    expect(cov!.area2).toEqual({ state: 'not-read' });
    expect(cov!.gap).toEqual({ start: 0x10000, end: 0x20000 });
    expect(cov!.sums).toBe('present');
    const eeprom = cov!.regions.find((r) => r.id === RADIOFOUNDRY_REGION.eeprom);
    expect(eeprom!.blocksRead + eeprom!.blocksBlank).toBeGreaterThan(0);
  });

  it('reports area 2 read with a blank tail', async () => {
    const area2End = DMR_ID_DATABASE_AREA2_ADDRESS + BLOCK_SIZE * 3;
    const pipe = new FakeRadioFoundryRadio({
      imageEnd: area2End,
      versionText: `proto=1\nboard=${MD9600_RADIOFOUNDRY_CABLE_BOARD.versionBoardNames[0]}\n`,
    });
    pipe.setBlock(DMR_ID_DATABASE_AREA2_ADDRESS, new Uint8Array(BLOCK_SIZE).fill(0xaa));
    const capture = await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    const parts = buildRadioFoundryDebugArchiveParts(capture);
    const cov = classifyRadioFoundryDebugCoverage(parts.manifest, parts.regions, parts.sidecars)!;
    expect(cov.area2.state).toBe('read');
    if (cov.area2.state === 'read') {
      expect(cov.area2.readTo).toBeGreaterThan(DMR_ID_DATABASE_AREA2_ADDRESS);
    }
    expect(parts.manifest.regions.some((r) => r.id === RADIOFOUNDRY_REGION.area2)).toBe(true);
  });

  it('says sums missing when the sidecar is absent', () => {
    const manifest = manifestBase([
      {
        id: RADIOFOUNDRY_REGION.eeprom,
        address: 0,
        byteLength: EEPROM_IMAGE_END,
        label: 'EEPROM',
        path: 'regions/eeprom-image.bin',
        restoreRole: 'inspect-only',
      },
      {
        id: RADIOFOUNDRY_REGION.flash,
        address: FLASH_IMAGE_START,
        byteLength: RADIOFOUNDRY_IMAGE_SIZE - FLASH_IMAGE_START,
        label: 'Flash',
        path: 'regions/flash-image.bin',
        restoreRole: 'inspect-only',
      },
    ]);
    const cov = classifyRadioFoundryDebugCoverage(manifest, {}, {})!;
    expect(cov.sums).toBe('missing');
    expect(cov.regions.every((r) => r.blocksRead === 0 && r.blocksBlank === 0)).toBe(true);
  });

  it('returns undefined for an OpenGD77 archive', () => {
    const og = buildOpenGd77DebugArchiveParts({
      modelId: OPENGD77_DM1701_MODEL_ID,
      capturedAt: '2026-01-01T00:00:00.000Z',
      capturedVia: 'web-serial',
      firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(0x08),
      calibrationWorkingCopy: new Uint8Array(512),
      settingsGap: new Uint8Array(0x60),
      image: createOpenUv380Image(),
    });
    expect(classifyRadioFoundryDebugCoverage(og.manifest, og.regions, og.sidecars)).toBeUndefined();
  });

  it('counts mixed blank and read rows in a region', () => {
    const sums = new Uint8Array([
      ...sumsRow(0, false),
      ...sumsRow(BLOCK_SIZE, true),
      ...sumsRow(FLASH_IMAGE_START, false),
    ]);
    const manifest = manifestBase([
      {
        id: RADIOFOUNDRY_REGION.eeprom,
        address: 0,
        byteLength: EEPROM_IMAGE_END,
        label: 'EEPROM',
        path: 'regions/eeprom-image.bin',
        restoreRole: 'inspect-only',
      },
    ]);
    const cov = classifyRadioFoundryDebugCoverage(
      manifest,
      {},
      {
        [RADIOFOUNDRY_DEBUG_SUMS_SIDECAR]: sums,
      },
    )!;
    const eeprom = cov.regions.find((r) => r.id === RADIOFOUNDRY_REGION.eeprom)!;
    expect(eeprom.blocksRead).toBe(1);
    expect(eeprom.blocksBlank).toBe(1);
  });
});
