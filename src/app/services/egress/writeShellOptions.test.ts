import { describe, expect, it } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import { listRadioDescriptors } from '@integrations/radio-io/registry.ts';
import { UV5R_MINI_MODEL_ID } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import { DM32_POWER_CYCLE_AFTER_SESSION_NOTE } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import { programHoldSafeMs } from '@integrations/radio-io/programHold.ts';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';
import { resolveWriteShellOptions } from './writeShellOptions.ts';

function egress(profileId: string): EgressPath {
  return {
    id: 'egress-1',
    revision: 1,
    formatId: 'radio-io',
    profileId,
    radioTargetId: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('resolveWriteShellOptions', () => {
  it('AT-D890UV restarts for 20 s, separate lookup database, check report labels', () => {
    const descriptor = getRadioDescriptor('AT-D890UV');
    const options = resolveWriteShellOptions(egress('radio-io-at-d890uv'), descriptor);
    expect(options.restartAfterEndSeconds).toBe(20);
    expect(options.contactStore).toBe('separate-lookup-database');
    expect(options.check.available).toBe(true);
    expect(options.check.reportLabels).toEqual({
      keptSectionTitle: 'Preserved settings',
      keptSummaryLabel: '6 sentinel regions',
    });
    expect(options.parts.contacts).toBe(true);
    expect(options.parts.keps).toBe(true);
  });

  it('OpenGD77 restarts for 20 s, shared contact bank', () => {
    const descriptor = getRadioDescriptor('DM-1701');
    const options = resolveWriteShellOptions(egress('radio-io-opengd77-1701'), descriptor);
    expect(options.restartAfterEndSeconds).toBe(20);
    expect(options.contactStore).toBe('shared-contact-bank');
    expect(options.parts.contacts).toBe(true);
    expect(options.parts.keps).toBe(true);
  });

  it('DM-32UV has the power-cycle success note and the shared address book', () => {
    const descriptor = getRadioDescriptor('DM-32UV');
    const options = resolveWriteShellOptions(egress('radio-io-dm32uv'), descriptor);
    expect(options.restartAfterEndSeconds).toBe(0);
    expect(options.contactStore).toBe('shared-address-book');
    expect(options.successNote).toBe(DM32_POWER_CYCLE_AFTER_SESSION_NOTE);
    expect(options.parts.contacts).toBe(true);
  });

  it('RadioFoundry does not restart and has no check', () => {
    const descriptor = listRadioDescriptors().find((d) =>
      d.compatibleProfiles.some((p) => p.profileId === 'radio-io-dm32uv-radiofoundry'),
    );
    const options = resolveWriteShellOptions(egress('radio-io-dm32uv-radiofoundry'), descriptor);
    expect(options.restartAfterEndSeconds).toBe(0);
    expect(options.check.available).toBe(false);
  });

  it('UV-5R Mini holds programming mode for 1.5 s', () => {
    const descriptor = getRadioDescriptor(UV5R_MINI_MODEL_ID);
    expect(descriptor).toBeDefined();
    const options = resolveWriteShellOptions(egress('radio-io-uv5r-mini'), descriptor);
    expect(programHoldSafeMs(descriptor!)).toBe(1500);
    expect(options.programHoldSafeMs).toBe(1500);
    expect(options.restartAfterEndSeconds).toBe(0);
    expect(options.parts.contacts).toBe(false);
  });

  it('restart wait is declared only by the D890 and OpenGD77', () => {
    for (const d of listRadioDescriptors()) {
      for (const profile of d.compatibleProfiles) {
        const options = resolveWriteShellOptions(egress(profile.profileId), d);
        if (options.restartAfterEndSeconds > 0) {
          expect(
            d.label === 'Anytone AT-D890UV' ||
              d.label === 'Baofeng DM-1701 / RT-84 (OpenGD77)' ||
              d.label === 'TYT MD-9600 / RT-90 (OpenGD77)',
          ).toBe(true);
        }
      }
    }
  });
});