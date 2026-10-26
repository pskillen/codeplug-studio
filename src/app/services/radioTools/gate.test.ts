import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';

import { listOfferedRadioTools, resolveRadioToolGate } from './gate.ts';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const ENVS_PRE_PROD = ['staging', 'main', 'dev', 'local'];

describe('resolveRadioToolGate', () => {
  it('hides a prodDisabled tool on prod only', () => {
    expect(resolveRadioToolGate({ prodDisabled: true }, 'prod')).toBe('hidden');
    for (const env of ENVS_PRE_PROD) {
      expect(resolveRadioToolGate({ prodDisabled: true }, env)).toBe('allowed');
    }
  });

  it('allows a tool without the flag everywhere', () => {
    for (const env of ['prod', ...ENVS_PRE_PROD]) {
      expect(resolveRadioToolGate({ prodDisabled: false }, env)).toBe('allowed');
    }
  });
});

describe('listOfferedRadioTools', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('offers the D890 tool on pre-prod envs and not on prod', () => {
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedRadioTools('anytone-at-d890uv', env).map((t) => t.id)).toEqual([
        'd890-frequency-range',
      ]);
    }
    expect(listOfferedRadioTools('anytone-at-d890uv', 'prod')).toEqual([]);
  });

  it('never offers a tool for another radio', () => {
    for (const id of ['baofeng-dm32uv', 'opengd77-1701', undefined]) {
      expect(listOfferedRadioTools(id, 'dev')).toEqual([]);
    }
  });

  it('offers nothing in the Capacitor app', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedRadioTools('anytone-at-d890uv', 'dev')).toEqual([]);
  });
});
