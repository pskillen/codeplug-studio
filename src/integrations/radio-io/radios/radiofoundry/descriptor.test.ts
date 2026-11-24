import { describe, expect, it } from 'vitest';
import { programHoldSafeMs, reviewNeedsReconnect } from '@integrations/radio-io/programHold.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import {
  createRadioFoundryDescriptor,
  DM1701_RADIOFOUNDRY_DESCRIPTOR,
  DM32_RADIOFOUNDRY_DESCRIPTOR,
  MD9600_RADIOFOUNDRY_DESCRIPTOR,
  RT84_RADIOFOUNDRY_DESCRIPTOR,
  RT90_RADIOFOUNDRY_DESCRIPTOR,
} from './descriptor.ts';
import { isRadioFoundryCableRadio } from './protocol.ts';

const RADIOFOUNDRY_DESCRIPTORS = [
  DM32_RADIOFOUNDRY_DESCRIPTOR,
  DM1701_RADIOFOUNDRY_DESCRIPTOR,
  RT84_RADIOFOUNDRY_DESCRIPTOR,
  MD9600_RADIOFOUNDRY_DESCRIPTOR,
  RT90_RADIOFOUNDRY_DESCRIPTOR,
] as const;

describe('RadioFoundry descriptor factory', () => {
  it('gives the DM-32UV descriptor it had before', () => {
    const d = DM32_RADIOFOUNDRY_DESCRIPTOR;
    expect(d.modelIds).toEqual(['DM-32UV-RadioFoundry']);
    expect(d.label).toBe('Baofeng DM-32UV (RadioFoundry)');
    expect(d.group).toBe('Baofeng');
    expect(d.capabilities.maxChannels).toBe(1024);
    expect(d.compatibleProfiles).toEqual([
      { formatId: 'radio-io', profileId: 'radio-io-dm32uv-radiofoundry' },
    ]);
    expect(d.writeStrategy).toBe('selective-ranges');
    expect(d.baudRate).toBe(115200);
    expect('prodWriteDisabled' in d).toBe(false);
    const radio = d.protocolFactory();
    expect(isRadioFoundryCableRadio(radio)).toBe(true);
    if (isRadioFoundryCableRadio(radio)) {
      expect(radio.board).toBe(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    }
    const hydration = d.hydration!.extractHydration(new Uint8Array(0) as never, undefined);
    expect(hydration.retain?.radioModelId).toBe('DM-32UV-RadioFoundry');
  });

  it('passes prodWriteDisabled through', () => {
    const d = createRadioFoundryDescriptor({
      ...DM32UV_RADIOFOUNDRY_CABLE_BOARD,
      modelId: 'X',
      prodWriteDisabled: true,
    });
    expect(d.prodWriteDisabled).toBe(true);
  });

  it.each(RADIOFOUNDRY_DESCRIPTORS)('program hold is infinite for $label', (descriptor) => {
    expect(programHoldSafeMs(descriptor)).toBe(Number.POSITIVE_INFINITY);
    expect(reviewNeedsReconnect(descriptor, 10 * 60_000)).toBe(false);
  });
});
