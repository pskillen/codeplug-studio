import { describe, expect, it } from 'vitest';
import {
  getRadioDescriptor,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from '../../registry.ts';
import { AT_D890UV_DESCRIPTOR, AT_D890UV_MODEL_ID } from './descriptor.ts';
import { createAtD890uvProtocol } from './protocol.ts';

describe('AT-D890UV descriptor / registry', () => {
  it('registers AT-D890UV with Direct radio compatible profile', () => {
    expect(listRadioDescriptors().some((d) => d.modelIds.includes(AT_D890UV_MODEL_ID))).toBe(true);
    const d = getRadioDescriptor(AT_D890UV_MODEL_ID);
    expect(d?.writeStrategy).toBe('selective-ranges');
    expect(d?.hydrationRequiredForWrite).toBe(false);
    expect(d?.prodWriteDisabled).toBeUndefined();
    expect(d?.attributionIds).toEqual(['anytone-cps']);
    expect(d?.baudRate).toBe(921_600);
    expect(d?.compatibleProfiles).toEqual([
      { formatId: 'radio-io', profileId: 'radio-io-at-d890uv' },
    ]);
    expect(listDescriptorsForProfile('radio-io', 'radio-io-at-d890uv')).toHaveLength(1);
    expect(listDescriptorsForProfile('anytone', 'anytone-at-d890uv')).toHaveLength(0);
    expect(AT_D890UV_DESCRIPTOR.capabilities.supportsZones).toBe(true);
  });

  it('protocolFactory returns a CloneImageRadio', () => {
    const radio = createAtD890uvProtocol();
    expect(typeof radio.connect).toBe('function');
    expect(typeof radio.download).toBe('function');
    expect(typeof radio.restoreFromBackup).toBe('function');
  });
});
