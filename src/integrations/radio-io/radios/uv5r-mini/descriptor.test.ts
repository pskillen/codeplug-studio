import { describe, expect, it } from 'vitest';
import {
  getRadioDescriptor,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from '../../registry.ts';
import { UV5R_MINI_MODEL_ID } from './descriptor.ts';
import { createUv5rMiniProtocol } from './protocol.ts';

describe('UV-5R Mini descriptor / registry', () => {
  it('registers Mini with Direct radio compatible profile only', () => {
    const list = listRadioDescriptors();
    expect(list.some((d) => d.modelIds.includes(UV5R_MINI_MODEL_ID))).toBe(true);
    const d = getRadioDescriptor(UV5R_MINI_MODEL_ID);
    expect(d?.writeStrategy).toBe('full-image');
    expect(d?.hydrationRequiredForWrite).toBe(true);
    expect(d?.attributionIds).toEqual(['chirp', 'neonplug']);
    expect(d?.baudRate).toBe(38400);
    expect(d?.compatibleProfiles).toEqual([
      { formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' },
    ]);
    expect(listDescriptorsForProfile('radio-io', 'radio-io-uv5r-mini')).toHaveLength(1);
    expect(listDescriptorsForProfile('neonplug', 'neonplug-uv5rmini')).toHaveLength(0);
    expect(listDescriptorsForProfile('chirp', 'chirp-uv5r')).toHaveLength(0);
    expect(listDescriptorsForProfile('opengd77', 'opengd77-1701')).toHaveLength(0);
  });

  it('protocolFactory returns a CloneImageRadio', () => {
    const radio = createUv5rMiniProtocol();
    expect(typeof radio.connect).toBe('function');
    expect(typeof radio.download).toBe('function');
  });
});
