import { describe, expect, it } from 'vitest';
import { OPENGD77_MD9600_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/md9600/descriptor.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  isProdBuildEnv,
  resolveRadioWriteGate,
  resolveRadioWriteExperimentalCopy,
  resolveRadioWriteProdDisabledMessage,
  RADIO_WRITE_PROD_DISABLED_MESSAGE,
  RT95_WRITE_PROD_DISABLED_MESSAGE,
  MD9600_WRITE_PROD_DISABLED_MESSAGE,
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
    expect(resolveRadioWriteGate(undefined, 'prod')).toBe('allowed');
  });

  it('hides AT-D890UV write on prod', () => {
    expect(resolveRadioWriteGate(AT_D890UV_DESCRIPTOR, 'prod')).toBe('hidden');
  });

  it('warns AT-D890UV write on pre-prod envs', () => {
    for (const env of ['local', 'dev', 'main', 'staging'] as const) {
      expect(resolveRadioWriteGate(AT_D890UV_DESCRIPTOR, env)).toBe('warn');
    }
  });

  it('hides RT95 write on prod and warns on pre-prod', () => {
    expect(resolveRadioWriteGate(RT95_DESCRIPTOR, 'prod')).toBe('hidden');
    expect(resolveRadioWriteGate(RT95_DESCRIPTOR, 'staging')).toBe('warn');
  });

  it('hides MD-9600 write on prod and warns on pre-prod', () => {
    expect(resolveRadioWriteGate(OPENGD77_MD9600_DESCRIPTOR, 'prod')).toBe('hidden');
    expect(resolveRadioWriteGate(OPENGD77_MD9600_DESCRIPTOR, 'staging')).toBe('warn');
    expect(resolveRadioWriteGate(OPENGD77_MD9600_DESCRIPTOR, 'local')).toBe('warn');
  });

  it('resolves profile-specific prod-disabled messages', () => {
    expect(resolveRadioWriteProdDisabledMessage('radio-io-rt95')).toBe(
      RT95_WRITE_PROD_DISABLED_MESSAGE,
    );
    expect(resolveRadioWriteProdDisabledMessage('radio-io-opengd77-md9600')).toBe(
      MD9600_WRITE_PROD_DISABLED_MESSAGE,
    );
    expect(resolveRadioWriteProdDisabledMessage('radio-io-at-d890uv')).toBe(
      RADIO_WRITE_PROD_DISABLED_MESSAGE,
    );
    expect(resolveRadioWriteProdDisabledMessage('radio-io-rt95')).toMatch(/CHIRP CSV/i);
    expect(resolveRadioWriteProdDisabledMessage('radio-io-opengd77-md9600')).toMatch(
      /OpenGD77 CSV/i,
    );
  });

  it('resolves experimental write copy for gated radios', () => {
    expect(resolveRadioWriteExperimentalCopy('radio-io-rt95')?.title).toMatch(/hardware/i);
    expect(resolveRadioWriteExperimentalCopy('radio-io-rt95')?.preferEgress).toMatch(/Sorry/i);
    expect(resolveRadioWriteExperimentalCopy('radio-io-at-d890uv')?.title).toMatch(/experimental/i);
    expect(resolveRadioWriteExperimentalCopy('radio-io-opengd77-md9600')?.title).toMatch(
      /hardware/i,
    );
    expect(resolveRadioWriteExperimentalCopy('radio-io-opengd77-md9600')?.lead).toMatch(
      /work in progress/i,
    );
  });

  it('exports a prod-disabled operator message', () => {
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/production/i);
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/Anytone CSV/i);
  });
});
