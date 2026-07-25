import { describe, expect, it } from 'vitest';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  isProdBuildEnv,
  resolveRadioWriteGate,
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

  it('exports a prod-disabled operator message', () => {
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/production/i);
    expect(RADIO_WRITE_PROD_DISABLED_MESSAGE).toMatch(/Anytone CSV/i);
  });
});
