import { describe, expect, it } from 'vitest';
import {
  getRadioDescriptor,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from '../../../registry.ts';
import { OPENGD77_MD9600_MODEL_ID, OPENGD77_MD9600_DESCRIPTOR } from './descriptor.ts';
import { createOpenGd77Md9600Protocol } from '../protocol.ts';

describe('OpenGD77 MD-9600 descriptor / registry', () => {
  it('registers MD-9600 with Direct radio compatible profile', () => {
    expect(listRadioDescriptors().some((d) => d.modelIds.includes(OPENGD77_MD9600_MODEL_ID))).toBe(
      true,
    );
    const d = getRadioDescriptor(OPENGD77_MD9600_MODEL_ID);
    expect(d?.writeStrategy).toBe('full-image');
    expect(d?.hydrationRequiredForWrite).toBe(true);
    expect(d?.prodWriteDisabled).toBeUndefined();
    expect(d?.attributionIds).toEqual(['qdmr']);
    expect(d?.baudRate).toBe(115_200);
    expect(d?.compatibleProfiles).toEqual([
      { formatId: 'radio-io', profileId: 'radio-io-opengd77-md9600' },
    ]);
    expect(listDescriptorsForProfile('radio-io', 'radio-io-opengd77-md9600')).toHaveLength(1);
    expect(listDescriptorsForProfile('opengd77', 'opengd77-md9600')).toHaveLength(0);
    expect(OPENGD77_MD9600_DESCRIPTOR.capabilities.supportsZones).toBe(true);
  });

  it('protocolFactory returns a CloneImageRadio', () => {
    const radio = createOpenGd77Md9600Protocol();
    expect(typeof radio.connect).toBe('function');
    expect(typeof radio.download).toBe('function');
    expect(typeof radio.upload).toBe('function');
  });
});
