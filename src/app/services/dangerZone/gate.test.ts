import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';

import { listOfferedDangerZoneTools } from './gate.ts';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

describe('listOfferedDangerZoneTools', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('offers the D890 tool on both D890 targets, with no environment gate', () => {
    for (const id of ['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy']) {
      expect(listOfferedDangerZoneTools(id).map((t) => t.id)).toEqual(['d890-frequency-range']);
    }
  });

  it('never offers a tool for another radio', () => {
    for (const id of ['baofeng-dm32uv', 'opengd77-1701', undefined]) {
      expect(listOfferedDangerZoneTools(id)).toEqual([]);
    }
  });

  it('offers nothing in the Capacitor app', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedDangerZoneTools('anytone-at-d890uv')).toEqual([]);
  });
});
