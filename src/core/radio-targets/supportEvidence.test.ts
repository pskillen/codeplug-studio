import { describe, expect, it } from 'vitest';
import { RADIOFOUNDRY_STUDIO_PIN } from '@core/radios/radiofoundry/firmware.ts';
import { RADIO_TARGETS, listRadioTargets } from './catalog.ts';
import { getRadioRfCapabilities } from './rfCapabilities.ts';
import { SUPPORT_FACTS } from './supportEvidence.ts';

describe('SUPPORT_FACTS', () => {
  it('names only real targets and modes their RF row supports', () => {
    for (const [targetId, modes] of Object.entries(SUPPORT_FACTS.modes)) {
      expect(RADIO_TARGETS[targetId]).toBeDefined();
      const rf = getRadioRfCapabilities(targetId)!;
      expect(rf).toBeDefined();
      for (const mode of Object.keys(modes)) {
        expect(rf.supportedModes).toContain(mode);
      }
    }
  });

  it('records FM and DMR evidence for every RadioFoundry target', () => {
    for (const target of listRadioTargets()) {
      if (target.firmwareId !== 'radiofoundry') continue;
      expect(SUPPORT_FACTS.modes[target.id]?.fm?.evidence).toBeDefined();
      expect(SUPPORT_FACTS.modes[target.id]?.dmr?.evidence).toBeDefined();
    }
  });

  it('keeps the commit in one place', () => {
    expect(SUPPORT_FACTS.firmwareBuilds.radiofoundry.label).toContain(RADIOFOUNDRY_STUDIO_PIN.git);
  });
});