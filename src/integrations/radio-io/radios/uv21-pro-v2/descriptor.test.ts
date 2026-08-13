import { describe, expect, it } from 'vitest';
import {
  getRadioDescriptor,
  listDescriptorsForProfile,
  listRadioDescriptors,
} from '../../registry.ts';
import { UV21_PRO_V2_MODEL_ID } from './descriptor.ts';
import { UV21_PRO_V2_LAYOUT } from '../uv17pro-family/layout.ts';
import { createUv17ProProtocol } from '../uv17pro-family/protocol.ts';

describe('UV-21Pro V2 descriptor / registry', () => {
  it('registers UV-21 with Direct radio compatible profile only', () => {
    const list = listRadioDescriptors();
    expect(list.some((d) => d.modelIds.includes(UV21_PRO_V2_MODEL_ID))).toBe(true);
    const d = getRadioDescriptor(UV21_PRO_V2_MODEL_ID);
    expect(d?.writeStrategy).toBe('full-image');
    expect(d?.hydrationRequiredForWrite).toBe(false);
    expect(d?.attributionIds).toEqual(['chirp']);
    expect(d?.baudRate).toBe(115200);
    expect(d?.baudRateFallback).toBeUndefined();
    expect(d?.compatibleProfiles).toEqual([{ formatId: 'radio-io', profileId: 'radio-io-uv21' }]);
    expect(listDescriptorsForProfile('radio-io', 'radio-io-uv21')).toHaveLength(1);
    expect(listDescriptorsForProfile('chirp', 'chirp-uv21')).toHaveLength(0);
  });

  it('protocolFactory returns a CloneImageRadio with restoreFromBackup', () => {
    const radio = createUv17ProProtocol(UV21_PRO_V2_LAYOUT);
    expect(typeof radio.connect).toBe('function');
    expect(typeof radio.download).toBe('function');
    expect(typeof radio.restoreFromBackup).toBe('function');
  });
});
