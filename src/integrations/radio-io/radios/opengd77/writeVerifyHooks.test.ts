import { describe, expect, it } from 'vitest';
import { OPENGD77_SECTOR } from './constants.ts';
import {
  captureWriteVerifyStaging,
  compareStagingAgainstLookup,
  memoryMapByteLookup,
  regionAtFromManifest,
} from '../../writeVerifyCompare.ts';
import { openUv380AbsToOffset } from './constants.ts';
import { collectDirtySectors, createOpenUv380Image, writeAbs } from './memory.ts';
import { buildOpenGd77VerifyManifest } from './writeVerifySupport.ts';

const MANIFEST = buildOpenGd77VerifyManifest();

describe('OpenGD77 write verify compare', () => {
  it('matches dirty sector payloads against downloaded image', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    writeAbs(next, 0x3780, new Uint8Array([0x11, 0x22, 0x33]));
    const sectors = collectDirtySectors(prior, next);
    expect(sectors.length).toBeGreaterThan(0);

    const staging = captureWriteVerifyStaging(
      sectors.map((s) => ({ address: s.sectorAbs, data: s.payload })),
    );
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(next, openUv380AbsToOffset),
      (addr) => regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches).toHaveLength(0);
  });

  it('detects sector mismatch after corrupt read image', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    writeAbs(next, 0x3780, new Uint8Array([0xaa]));
    const sectors = collectDirtySectors(prior, next);
    const sector = sectors[0]!;
    const corrupt = createOpenUv380Image();
    writeAbs(corrupt, 0x3780, new Uint8Array([0xbb]));

    const staging = captureWriteVerifyStaging([
      { address: sector.sectorAbs, data: sector.payload },
    ]);
    const mismatches = compareStagingAgainstLookup(
      staging,
      memoryMapByteLookup(corrupt, openUv380AbsToOffset),
      (addr) => regionAtFromManifest(MANIFEST, addr),
    );
    expect(mismatches.some((m) => m.kind === 'mismatch')).toBe(true);
    expect(sector.payload.length).toBe(OPENGD77_SECTOR);
  });
});
