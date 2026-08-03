import { describe, expect, it, vi } from 'vitest';
import * as platform from './isNativeApp.ts';
import {
  PROD_API_ORIGIN,
  resolveApiUrl,
  resolveNativeApiOrigin,
  STAGING_API_ORIGIN,
} from './resolveApiUrl.ts';

describe('resolveNativeApiOrigin', () => {
  it('returns prod apex for prod builds', () => {
    expect(resolveNativeApiOrigin('prod')).toBe(PROD_API_ORIGIN);
  });

  it('returns staging origin for non-prod builds', () => {
    for (const buildEnv of ['staging', 'main', 'dev', 'local', 'unknown']) {
      expect(resolveNativeApiOrigin(buildEnv)).toBe(STAGING_API_ORIGIN);
    }
  });
});

describe('resolveApiUrl', () => {
  it('returns relative path when on web (non-native)', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
    expect(resolveApiUrl('/api/radioid/dmr/user/')).toBe('/api/radioid/dmr/user/');
    expect(resolveApiUrl('/api/irts/repeaters')).toBe('/api/irts/repeaters');
  });

  it('returns absolute prod origin URL when on native app with prod build', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    expect(resolveApiUrl('/api/radioid/dmr/user/', 'prod')).toBe(
      `${PROD_API_ORIGIN}/api/radioid/dmr/user/`,
    );
    expect(resolveApiUrl('/api/irts/repeaters', 'prod')).toBe(
      `${PROD_API_ORIGIN}/api/irts/repeaters`,
    );
    expect(resolveApiUrl('api/repeaterbook/export?region=na', 'prod')).toBe(
      `${PROD_API_ORIGIN}/api/repeaterbook/export?region=na`,
    );
  });

  it('returns absolute staging origin URL when on native app with non-prod build', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    for (const buildEnv of ['staging', 'main', 'local']) {
      expect(resolveApiUrl('/api/radioid/dmr/user/', buildEnv)).toBe(
        `${STAGING_API_ORIGIN}/api/radioid/dmr/user/`,
      );
      expect(resolveApiUrl('/api/irts/repeaters', buildEnv)).toBe(
        `${STAGING_API_ORIGIN}/api/irts/repeaters`,
      );
    }
  });
});
