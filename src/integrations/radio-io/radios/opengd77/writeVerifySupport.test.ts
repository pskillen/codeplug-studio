import { describe, expect, it } from 'vitest';
import { captureWriteVerifyStaging } from '../../writeVerifyCompare.ts';
import { OPENGD77_SECTOR } from './constants.ts';
import { buildOpenGd77VerifyManifest, keptRegionOverlapsStaging } from './writeVerifySupport.ts';

describe('openGd77 write verify support', () => {
  it('detects staging overlap with kept regions', () => {
    const manifest = buildOpenGd77VerifyManifest();
    const additional = manifest.find((r) => r.id === 'additionalSettings')!;
    const staging = captureWriteVerifyStaging([
      {
        address: additional.start,
        data: new Uint8Array(OPENGD77_SECTOR).fill(0xff),
      },
    ]);
    expect(keptRegionOverlapsStaging('additionalSettings', manifest, staging)).toBe(true);
    expect(keptRegionOverlapsStaging('settings', manifest, staging)).toBe(false);
  });
});
