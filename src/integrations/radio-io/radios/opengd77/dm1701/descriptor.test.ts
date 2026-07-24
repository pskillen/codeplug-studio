import { describe, expect, it } from 'vitest';
import {
  getRadioDescriptor,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from '../../../registry.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_DM1701_DESCRIPTOR } from './descriptor.ts';
import { createOpenGd77Dm1701Protocol } from '../protocol.ts';

describe('OpenGD77 DM-1701 descriptor / registry', () => {
  it('registers DM-1701 with Direct radio compatible profile', () => {
    expect(listRadioDescriptors().some((d) => d.modelIds.includes(OPENGD77_DM1701_MODEL_ID))).toBe(
      true,
    );
    const d = getRadioDescriptor(OPENGD77_DM1701_MODEL_ID);
    expect(d?.writeStrategy).toBe('full-image');
    expect(d?.hydrationRequiredForWrite).toBe(true);
    expect(d?.attributionIds).toEqual(['qdmr']);
    expect(d?.baudRate).toBe(115_200);
    expect(d?.compatibleProfiles).toEqual([
      { formatId: 'radio-io', profileId: 'radio-io-opengd77-1701' },
    ]);
    expect(listDescriptorsForProfile('radio-io', 'radio-io-opengd77-1701')).toHaveLength(1);
    expect(listDescriptorsForProfile('opengd77', 'opengd77-1701')).toHaveLength(0);
    expect(OPENGD77_DM1701_DESCRIPTOR.capabilities.supportsZones).toBe(true);
  });

  it('protocolFactory returns a CloneImageRadio', () => {
    const radio = createOpenGd77Dm1701Protocol();
    expect(typeof radio.connect).toBe('function');
    expect(typeof radio.download).toBe('function');
    expect(typeof radio.upload).toBe('function');
  });
});
