import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';
import { OPENGD77_MD9600_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/md9600/descriptor.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import {
  isProdBuildEnv,
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
  RADIO_WRITE_PROD_DISABLED_MESSAGE,
} from './radioWriteEnvGate.ts';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return {
    ...actual,
    isCapacitorSerialSupported: vi.fn(() => false),
  };
});

describe('radioWriteEnvGate', () => {
  it('detects prod build env', () => {
    expect(isProdBuildEnv('prod')).toBe(true);
    expect(isProdBuildEnv('staging')).toBe(false);
    expect(isProdBuildEnv('main')).toBe(false);
    expect(isProdBuildEnv('dev')).toBe(false);
    expect(isProdBuildEnv('local')).toBe(false);
  });

  it('allows write for radios without prodWriteDisabled', () => {
    expect(resolveRadioWriteGate(UV5R_MINI_DESCRIPTOR, 'prod')).toBe('allowed');
    expect(resolveRadioWriteGate(UV5R_MINI_DESCRIPTOR, 'local')).toBe('allowed');
    expect(resolveRadioWriteGate(RT95_DESCRIPTOR, 'prod')).toBe('allowed');
    expect(resolveRadioWriteGate(RT95_DESCRIPTOR, 'staging')).toBe('allowed');
    expect(resolveRadioWriteGate(OPENGD77_MD9600_DESCRIPTOR, 'prod')).toBe('allowed');
    expect(resolveRadioWriteGate(OPENGD77_MD9600_DESCRIPTOR, 'staging')).toBe('allowed');
    expect(resolveRadioWriteGate(AT_D890UV_DESCRIPTOR, 'prod')).toBe('allowed');
    expect(resolveRadioWriteGate(AT_D890UV_DESCRIPTOR, 'staging')).toBe('allowed');
    expect(resolveRadioWriteGate(undefined, 'prod')).toBe('allowed');
  });

  it('hides write on prod only when prodWriteDisabled is set', () => {
    const gated = { prodWriteDisabled: true as const };
    expect(resolveRadioWriteGate(gated, 'prod')).toBe('hidden');
    expect(resolveRadioWriteGate(gated, 'staging')).toBe('allowed');
    expect(resolveRadioWriteGate(gated, 'local')).toBe('allowed');
  });

  const profileGated = {
    compatibleProfiles: [
      { formatId: 'radio-io', profileId: 'p-stock' },
      { formatId: 'radio-io', profileId: 'p-mod', prodWriteDisabled: true },
    ],
  } as const;

  it('hides a prod-disabled profile on prod only; the other profiles stay allowed', () => {
    expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod')).toBe('hidden');
    for (const env of ['next', 'main', 'dev', 'staging', 'local']) {
      expect(resolveRadioWriteGate(profileGated, env, 'p-mod')).toBe('allowed');
    }
    for (const env of ['prod', 'staging', 'local']) {
      expect(resolveRadioWriteGate(profileGated, env, 'p-stock')).toBe('allowed');
      expect(resolveRadioWriteGate(profileGated, env)).toBe('allowed');
    }
  });

  it('gives a prod-disabled profile no native-platform exemption', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod')).toBe('hidden');
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('allows RT95 Write on prod for both profiles, MM9PDY included', () => {
    for (const p of ['radio-io-rt95', 'radio-io-rt95-mm9pdy']) {
      expect(resolveRadioWriteGate(RT95_DESCRIPTOR, 'prod', p)).toBe('allowed');
    }
  });

  it('allows UV-5R Mini Write on prod for both profiles, MM9PDY included', () => {
    for (const p of ['radio-io-uv5r-mini', 'radio-io-uv5r-mini-mm9pdy']) {
      for (const env of ['prod', 'next', 'dev', 'staging', 'local']) {
        expect(resolveRadioWriteGate(UV5R_MINI_DESCRIPTOR, env, p)).toBe('allowed');
      }
    }
  });

  it('allows write on native platforms even in prod', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    const gated = { prodWriteDisabled: true as const };
    expect(resolveRadioWriteGate(gated, 'prod')).toBe('allowed');
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  describe('developer mode (#1650)', () => {
    afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

    it('shows a prod-disabled descriptor and profile on prod with developer mode on', () => {
      const gated = { prodWriteDisabled: true as const };
      expect(resolveRadioWriteGate(gated, 'prod', undefined, false)).toBe('hidden');
      expect(resolveRadioWriteGate(gated, 'prod', undefined, true)).toBe('allowed');
      expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod', false)).toBe('hidden');
      expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod', true)).toBe('allowed');
    });

    it('stays allowed on pre-prod with developer mode off', () => {
      for (const env of ['main', 'dev', 'staging', 'local']) {
        expect(resolveRadioWriteGate(profileGated, env, 'p-mod', false)).toBe('allowed');
      }
    });

    it('reads developer mode from this device when the caller does not pass it', () => {
      expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod')).toBe('hidden');
      setDeveloperMode(true);
      expect(resolveRadioWriteGate(profileGated, 'prod', 'p-mod')).toBe('allowed');
    });
  });

  it('resolves profile-specific prod-disabled messages', () => {
    expect(resolveRadioWriteProdDisabledMessage('radio-io-at-d890uv')).toBe(
      RADIO_WRITE_PROD_DISABLED_MESSAGE,
    );
    expect(resolveRadioWriteProdDisabledMessage('radio-io-opengd77-md9600')).toBe(
      RADIO_WRITE_PROD_DISABLED_MESSAGE,
    );
    expect(resolveRadioWriteProdDisabledMessage('radio-io-rt95')).toBe(
      RADIO_WRITE_PROD_DISABLED_MESSAGE,
    );
  });

  it('exports a prod-disabled operator message', () => {
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/production/i);
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/file export/i);
  });
});
