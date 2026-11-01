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
});
