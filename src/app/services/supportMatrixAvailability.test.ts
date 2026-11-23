import { describe, expect, it } from 'vitest';

import { buildSupportMatrix, listRadioTargets } from '@core/radio-targets/index.ts';

import { supportMatrixAvailability } from './supportMatrixAvailability.ts';

describe('supportMatrixAvailability', () => {
  it('has a radio-io descriptor for every web-serial egress in the catalog (keeps core and integrations in sync)', () => {
    const availability = supportMatrixAvailability('dev');
    for (const target of listRadioTargets()) {
      for (const egress of target.compatibleEgress.filter((e) => e.kind === 'web-serial')) {
        expect(availability.cableRead?.(egress), egress.profileId).toBe(true);
      }
    }
  });

  it('never advertises a flasher the site does not offer', () => {
    const none = { ...supportMatrixAvailability('dev'), firmwareFlash: () => false };
    for (const model of buildSupportMatrix({ availability: none }))
      for (const fw of model.firmware) expect(fw.cells.flash).not.toBe('supported');
  });

  it('offers the flasher where the dev build allows it', () => {
    const dm32 = buildSupportMatrix({ availability: supportMatrixAvailability('dev') })
      .find((m) => m.model.id === 'baofeng-dm32uv')!
      .firmware.find((f) => f.firmware.id === 'mm9pdy')!;
    expect(dm32.cells.flash).toBe('supported');
  });

  it('offers satellite keps where a keps write exists and Write is offered', () => {
    const availability = supportMatrixAvailability('dev');
    const matrix = (modelId: string, firmwareId: string) => {
      const model = buildSupportMatrix({ availability }).find((m) => m.model.id === modelId)!;
      return model.firmware.find((f) => f.firmware.id === firmwareId)!;
    };
    expect(matrix('anytone-at-d890uv', 'stock').cells.satelliteKeps).toBe('supported');
    expect(matrix('baofeng-dm1701', 'opengd77').cells.satelliteKeps).toBe('supported');
    expect(matrix('baofeng-uv5r-mini', 'stock').cells.satelliteKeps).toBe('unsupported');
    expect(matrix('baofeng-dm32uv', 'stock').cells.satelliteKeps).toBe('unsupported');
  });
});
