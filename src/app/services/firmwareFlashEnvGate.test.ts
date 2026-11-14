import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';

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

  it('offers four radios on prod', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toEqual([
      'baofeng-dm32uv',
      'anytone-at-d890uv',
      'retevis-rt95-head',
      'baofeng-uv5rmini',
    ]);
  });

  it('offers the RT95 front panel on prod, next, dev and staging', () => {
    for (const env of ['prod', 'staging', 'main', 'dev', 'local']) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('retevis-rt95-head');
    }
  });

  it('hides the RT95 main board on prod and offers it on next, dev and staging', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).not.toContain(
      'retevis-rt95-main',
    );
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('retevis-rt95-main');
    }
  });

  it('offers the DM-32UV on dev', () => {
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).toContain('baofeng-dm32uv');
  });

  it('offers the UV-5R Mini on prod with developer mode off, and on next, dev and staging', () => {
    expect(listOfferedFirmwareUpdaters('prod', false).map((d) => d.radioId)).toContain(
      'baofeng-uv5rmini',
    );
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('baofeng-uv5rmini');
    }
  });

  it('still hides the UV-5R Mini in the Android app on prod (not capacitorSupported)', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedFirmwareUpdaters('prod', false).map((d) => d.radioId)).not.toContain(
      'baofeng-uv5rmini',
    );
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

describe('developer mode (#1650)', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });
  afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

  const PROD_HIDDEN = ['retevis-rt95-main'];

  it('hides the prod-disabled radios on prod with developer mode off', () => {
    const ids = listOfferedFirmwareUpdaters('prod', false).map((d) => d.radioId);
    for (const id of PROD_HIDDEN) expect(ids).not.toContain(id);
  });

  it('offers every radio on prod with developer mode on', () => {
    const ids = listOfferedFirmwareUpdaters('prod', true).map((d) => d.radioId);
    for (const id of PROD_HIDDEN) expect(ids).toContain(id);
    expect(ids).toEqual(listOfferedFirmwareUpdaters('dev', false).map((d) => d.radioId));
  });

  it('offers every radio on pre-prod with developer mode off', () => {
    for (const env of ENVS_PRE_PROD) {
      const ids = listOfferedFirmwareUpdaters(env, false).map((d) => d.radioId);
      for (const id of PROD_HIDDEN) expect(ids).toContain(id);
    }
  });

  it('reads developer mode from this device when the caller does not pass it', () => {
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
    setDeveloperMode(true);
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('allowed');
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toContain(
      'retevis-rt95-main',
    );
  });

  it('never relaxes the platform check: Capacitor still offers only capacitorSupported radios', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    for (const d of listOfferedFirmwareUpdaters('prod', true)) {
      expect(d.capacitorSupported).toBe(true);
    }
    expect(listOfferedFirmwareUpdaters('prod', true)).toEqual(
      listOfferedFirmwareUpdaters('dev', false),
    );
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
