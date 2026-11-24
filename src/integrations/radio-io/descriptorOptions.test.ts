import { describe, expect, it } from 'vitest';
import { listRadioDescriptors } from './registry.ts';
import { AT_D890_RESTART_AFTER_END_SECONDS } from './radios/at-d890uv/constants.ts';
import { DM32_POWER_CYCLE_AFTER_SESSION_NOTE } from './radios/dm32uv/writeRole.ts';
import { OPENGD77_RESTART_AFTER_END_SECONDS } from './radios/opengd77/constants.ts';

describe('RadioDescriptor Write shell options', () => {
  it('only the AT-D890UV and OpenGD77 descriptors declare a restart after END', () => {
    const descriptors = listRadioDescriptors();
    const withRestart = descriptors.filter((d) => d.restartAfterEnd !== undefined);
    expect(withRestart.map((d) => d.label).sort()).toEqual(
      [
        'Anytone AT-D890UV',
        'Baofeng DM-1701 / RT-84 (OpenGD77)',
        'TYT MD-9600 / RT-90 (OpenGD77)',
      ].sort(),
    );
    for (const d of withRestart) {
      const seconds = d.restartAfterEnd!.seconds;
      expect(seconds === AT_D890_RESTART_AFTER_END_SECONDS || seconds === OPENGD77_RESTART_AFTER_END_SECONDS).toBe(
        true,
      );
    }
  });

  it('contact stores are declared for the D890, OpenGD77 and DM-32UV', () => {
    const descriptors = listRadioDescriptors();
    const withStore = descriptors.filter((d) => d.contactStore !== undefined);
    expect(withStore.map((d) => d.label).sort()).toEqual(
      [
        'Anytone AT-D890UV',
        'Baofeng DM-1701 / RT-84 (OpenGD77)',
        'Baofeng DM-32UV',
        'TYT MD-9600 / RT-90 (OpenGD77)',
      ].sort(),
    );
    expect(descriptors.find((d) => d.label === 'Anytone AT-D890UV')?.contactStore).toBe(
      'separate-lookup-database',
    );
    expect(descriptors.find((d) => d.label === 'Baofeng DM-32UV')?.contactStore).toBe(
      'shared-address-book',
    );
    for (const d of withStore.filter((x) => x.label.includes('OpenGD77'))) {
      expect(d.contactStore).toBe('shared-contact-bank');
    }
  });

  it('only the DM-32UV declares a success note', () => {
    const descriptors = listRadioDescriptors();
    const withNote = descriptors.filter((d) => d.successNote !== undefined);
    expect(withNote).toHaveLength(1);
    expect(withNote[0]!.label).toBe('Baofeng DM-32UV');
    expect(withNote[0]!.successNote).toBe(DM32_POWER_CYCLE_AFTER_SESSION_NOTE);
  });
});