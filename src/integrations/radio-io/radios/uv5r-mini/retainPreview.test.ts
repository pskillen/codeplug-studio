import { describe, expect, it } from 'vitest';
import { UV5R_MINI_SETTINGS_OFFSET, UV5R_MINI_VFO_A_OFFSET } from './constants.ts';
import { encodeBcdFreq } from './channelCodec.ts';
import { settingsRetainPreview, ancillaryRetainPreview } from './retainPreview.ts';
import { createSyntheticImageBase } from './__fixtures__/syntheticImage.ts';
import { uv5rMiniWriteRole } from './writeRole.ts';

describe('uv5rMiniWriteRole', () => {
  it('marks channels replaced and settings kept', () => {
    expect(uv5rMiniWriteRole('channels')).toBe('replaced');
    expect(uv5rMiniWriteRole('settings')).toBe('kept');
    expect(uv5rMiniWriteRole('ani')).toBe('kept');
  });
});

describe('settingsRetainPreview', () => {
  it('returns empty when image too small', () => {
    expect(settingsRetainPreview(new Uint8Array(0))).toEqual([]);
  });

  it('maps beep off from settings byte', () => {
    const image = createSyntheticImageBase();
    image[UV5R_MINI_SETTINGS_OFFSET + 6] = 0;
    const rows = settingsRetainPreview(image);
    expect(rows.find((r) => r.label === 'Beep')?.value).toBe('Off');
  });
});

describe('ancillaryRetainPreview', () => {
  it('reports empty VFO when slot is 0xFF', () => {
    const image = createSyntheticImageBase();
    const { rows } = ancillaryRetainPreview(image);
    expect(rows.find((r) => r.label === 'VFO A')?.value).toBe('Empty');
  });

  it('decodes VFO frequency when slot has channel data', () => {
    const image = createSyntheticImageBase();
    const vfo = image.subarray(UV5R_MINI_VFO_A_OFFSET, UV5R_MINI_VFO_A_OFFSET + 32);
    vfo.fill(0);
    vfo.set(encodeBcdFreq(145_500_000), 0);
    vfo[12] = 1;
    const { rows } = ancillaryRetainPreview(image);
    expect(rows.find((r) => r.label === 'VFO A')?.value).toContain('145.500 MHz');
  });
});
