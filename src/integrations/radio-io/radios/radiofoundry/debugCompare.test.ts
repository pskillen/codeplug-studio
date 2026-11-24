import { describe, expect, it } from 'vitest';
import { compareVerdict } from '../../debugCompare/index.ts';
import { EEPROM_IMAGE_END } from './constants.ts';
import { RADIOFOUNDRY_DEBUG_INFO_SIDECAR, RADIOFOUNDRY_REGION } from './debugCapture.ts';
import { radioFoundryCompareAdapter } from './debugCompare.ts';
import { buildOpenGd77DebugArchiveParts } from '../opengd77/debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from '../opengd77/hydration.ts';
import { createOpenUv380Image } from '../opengd77/memory.ts';
import { makeOpenGd77FirmwareInfoPayload } from '../opengd77/__fixtures__/scriptedPipe.ts';

function rfArchive(
  id: string,
  regions: Record<string, Uint8Array>,
  sidecars: Record<string, Uint8Array> = {},
) {
  return {
    manifest: {
      radioModelId: 'MD-9600-RadioFoundry',
      regions: Object.entries(regions).map(([regionId, bytes]) => ({
        id: regionId,
        address: regionId === RADIOFOUNDRY_REGION.flash ? 0x20000 : 0,
        byteLength: bytes.length,
        label: regionId,
        path: `regions/${regionId}.bin`,
        restoreRole: 'inspect-only' as const,
      })),
    },
    regions,
    sidecars,
  };
}

describe('radioFoundryCompareAdapter', () => {
  it('compares EEPROM bytes and reports one change', () => {
    const aBytes = new Uint8Array(EEPROM_IMAGE_END).fill(0xaa);
    const bBytes = aBytes.slice();
    bBytes[0x200] = 0xbb;
    const sections = radioFoundryCompareAdapter.sections!(
      rfArchive('a', { [RADIOFOUNDRY_REGION.eeprom]: aBytes }),
      rfArchive('b', { [RADIOFOUNDRY_REGION.eeprom]: bBytes }),
    );
    const eeprom = sections.sections.find((s) => s.id === RADIOFOUNDRY_REGION.eeprom)!;
    expect(eeprom.kind).toBe('compared');
    expect(eeprom.changed).toBe(1);
  });

  it('keeps area 2 reported so it never decides the verdict', () => {
    const a = rfArchive('a', {
      [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(EEPROM_IMAGE_END),
      [RADIOFOUNDRY_REGION.area2]: new Uint8Array(4096).fill(1),
    });
    const b = rfArchive('b', {
      [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(EEPROM_IMAGE_END),
    });
    const sections = radioFoundryCompareAdapter.sections!(a, b);
    const area2 = sections.sections.find((s) => s.id === RADIOFOUNDRY_REGION.area2)!;
    expect(area2.kind).toBe('reported');
    expect(compareVerdict(sections).verdict).toBe('identical');
  });

  it('reports INFO sidecar differences', () => {
    const sections = radioFoundryCompareAdapter.sections!(
      rfArchive(
        'a',
        { [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(16) },
        {
          [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: new Uint8Array([1, 2, 3]),
        },
      ),
      rfArchive(
        'b',
        { [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(16) },
        {
          [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: new Uint8Array([1, 2, 4]),
        },
      ),
    );
    const info = sections.sections.find((s) => s.id === 'info-reply')!;
    expect(info.kind).toBe('reported');
    expect(info.changed).toBeGreaterThan(0);
  });

  it('refuses an OpenGD77 archive against RadioFoundry', () => {
    const og = buildOpenGd77DebugArchiveParts({
      modelId: OPENGD77_DM1701_MODEL_ID,
      capturedAt: '2026-01-01T00:00:00.000Z',
      capturedVia: 'web-serial',
      firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(0x08),
      calibrationWorkingCopy: new Uint8Array(512),
      settingsGap: new Uint8Array(0x60),
      image: createOpenUv380Image(),
    });
    const out = radioFoundryCompareAdapter.sections!(
      { manifest: og.manifest, regions: og.regions, sidecars: og.sidecars },
      rfArchive('b', { [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(16) }),
    );
    expect(out.error).toMatch(/incompatible/);
  });

  it('tags compared EEPROM with regionId for sensitive ranges', () => {
    const sections = radioFoundryCompareAdapter.sections!(
      rfArchive('a', { [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(16) }),
      rfArchive('b', { [RADIOFOUNDRY_REGION.eeprom]: new Uint8Array(16) }),
    );
    expect(sections.sections.find((s) => s.id === RADIOFOUNDRY_REGION.eeprom)?.regionId).toBe(
      RADIOFOUNDRY_REGION.eeprom,
    );
  });
});
