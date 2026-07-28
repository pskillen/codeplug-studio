import { describe, expect, it } from 'vitest';
import { OPENGD77_MD9600_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/md9600/descriptor.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  isProdBuildEnv,
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
  RADIO_WRITE_PROD_DISABLED_MESSAGE,
} from './radioWriteEnvGate.ts';

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
