import { afterEach, describe, expect, it } from 'vitest';
import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';

import {
  isProdBuildEnv,
  resolveDebugPagesGate,
  resolveProdFeatureGate,
} from './prodFeatureGate.ts';

const PRE_PROD = ['local', 'main', 'dev', 'staging'];

describe('resolveProdFeatureGate', () => {
  afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

  it('treats only prod as prod', () => {
    expect(isProdBuildEnv('prod')).toBe(true);
    for (const env of PRE_PROD) expect(isProdBuildEnv(env)).toBe(false);
  });

  it('hides a prod-hidden feature on prod with developer mode off', () => {
    expect(resolveProdFeatureGate(true, { buildEnv: 'prod', developerMode: false })).toBe('hidden');
  });

  it('shows a prod-hidden feature on prod with developer mode on', () => {
    expect(resolveProdFeatureGate(true, { buildEnv: 'prod', developerMode: true })).toBe('allowed');
  });

  it('shows a prod-hidden feature on every pre-prod build, developer mode or not', () => {
    for (const env of PRE_PROD) {
      expect(resolveProdFeatureGate(true, { buildEnv: env, developerMode: false })).toBe('allowed');
      expect(resolveProdFeatureGate(true, { buildEnv: env, developerMode: true })).toBe('allowed');
    }
  });

  it('never hides a feature that is not prod-hidden', () => {
    for (const env of ['prod', ...PRE_PROD]) {
      expect(resolveProdFeatureGate(false, { buildEnv: env, developerMode: false })).toBe(
        'allowed',
      );
    }
  });

  it('reads developer mode from this device when the caller does not pass it', () => {
    expect(resolveProdFeatureGate(true, { buildEnv: 'prod' })).toBe('hidden');
    setDeveloperMode(true);
    expect(resolveProdFeatureGate(true, { buildEnv: 'prod' })).toBe('allowed');
    setDeveloperMode(false);
    expect(resolveProdFeatureGate(true, { buildEnv: 'prod' })).toBe('hidden');
  });
});

describe('resolveDebugPagesGate', () => {
  it('hides the Debug pages on prod only, unless developer mode is on', () => {
    expect(resolveDebugPagesGate({ buildEnv: 'prod', developerMode: false })).toBe('hidden');
    expect(resolveDebugPagesGate({ buildEnv: 'prod', developerMode: true })).toBe('allowed');
    for (const env of PRE_PROD) {
      expect(resolveDebugPagesGate({ buildEnv: env, developerMode: false })).toBe('allowed');
    }
  });
});
