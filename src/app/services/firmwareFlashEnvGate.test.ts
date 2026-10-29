import { describe, expect, it, vi, beforeEach } from 'vitest';

import { radioTargetIdsForFirmwareRadio } from '@core/firmware/radioTargets.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';

import { listOfferedFirmwareUpdaters, resolveFirmwareFlashGate } from './firmwareFlashEnvGate.ts';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const ENVS_PRE_PROD = ['staging', 'main', 'dev', 'local'];

describe('resolveFirmwareFlashGate', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('hides a prod-disabled radio on prod only', () => {
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
    for (const env of ENVS_PRE_PROD) {
      expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, env)).toBe('allowed');
    }
  });

  it('allows a radio without the flag everywhere', () => {
    for (const env of ['prod', ...ENVS_PRE_PROD]) {
      expect(resolveFirmwareFlashGate({ prodFlashDisabled: false }, env)).toBe('allowed');
    }
  });

  it('does not exempt Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
  });
});

describe('listOfferedFirmwareUpdaters', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('offers all three radios on prod', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toEqual([
      'baofeng-dm32uv',
      'anytone-at-d890uv',
      'retevis-rt95-head',
    ]);
  });

  it('offers the RT95 front panel on prod, next, dev and staging', () => {
    for (const env of ['prod', 'staging', 'main', 'dev', 'local']) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('retevis-rt95-head');
    }
  });

  it('offers the DM-32UV on dev', () => {
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).toContain('baofeng-dm32uv');
  });

  it('hides the RT95 front panel on Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).not.toContain(
      'retevis-rt95-head',
    );
  });

  it('offers nothing on Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedFirmwareUpdaters('dev')).toEqual([]);
  });
});

describe('radioTargetIdsForFirmwareRadio', () => {
  it('maps each firmware radio to its codeplug targets', () => {
    expect(radioTargetIdsForFirmwareRadio('baofeng-dm32uv')).toEqual([
      'baofeng-dm32uv',
      'baofeng-dm32uv-mm9pdy',
    ]);
    expect(radioTargetIdsForFirmwareRadio('anytone-at-d890uv')).toContain('anytone-at-d890uv');
  });
});
