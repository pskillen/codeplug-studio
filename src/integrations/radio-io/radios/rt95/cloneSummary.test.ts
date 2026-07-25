import { describe, expect, it } from 'vitest';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { summariseRt95Clone } from './cloneSummary.ts';
import { rt95WriteRole } from './writeRole.ts';
import { settingsRetainPreview } from './retainPreview.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { RT95_MODEL_ID } from './constants.ts';

describe('rt95 writeRole', () => {
  it('marks channel span as replaced and settings as kept', () => {
    expect(rt95WriteRole(0x0000)).toBe('replaced');
    expect(rt95WriteRole(0x1940)).toBe('replaced');
    expect(rt95WriteRole(0x3200)).toBe('kept');
    expect(rt95WriteRole(0x326d)).toBe('kept');
  });
});

describe('summariseRt95Clone', () => {
  it('reports occupied count from bitfield', () => {
    const bag = createRadioCloneHydrationBag({
      radioModelId: RT95_MODEL_ID,
      imageBytes: buildSyntheticRt95Image(),
      capturedVia: 'web-serial',
    });
    const summary = summariseRt95Clone(bag);
    expect(summary?.occupiedChannelCount).toBe(1);
    expect(summary?.writtenFromBuild).toContain('Channels (200 slots)');
    expect(summary?.retainGroups.length).toBeGreaterThan(0);
    expect(summary?.settingsRetain.length).toBeGreaterThan(0);
  });
});

describe('settingsRetainPreview', () => {
  it('decodes squelch and bandlimit highlights', () => {
    const image = buildSyntheticRt95Image();
    const rows = settingsRetainPreview(image);
    expect(rows.some((r) => r.label === 'Bandlimit index')).toBe(true);
  });
});
