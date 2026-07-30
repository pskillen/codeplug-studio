import { describe, expect, it, vi } from 'vitest';
import * as platform from './isNativeApp.ts';
import { PROD_API_ORIGIN, resolveApiUrl } from './resolveApiUrl.ts';

describe('resolveApiUrl', () => {
  it('returns relative path when on web (non-native)', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(false);
    expect(resolveApiUrl('/api/radioid/dmr/user/')).toBe('/api/radioid/dmr/user/');
    expect(resolveApiUrl('/api/irts/repeaters')).toBe('/api/irts/repeaters');
  });

  it('returns absolute prod origin URL when on native app', () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    expect(resolveApiUrl('/api/radioid/dmr/user/')).toBe(
      `${PROD_API_ORIGIN}/api/radioid/dmr/user/`,
    );
    expect(resolveApiUrl('/api/irts/repeaters')).toBe(`${PROD_API_ORIGIN}/api/irts/repeaters`);
    expect(resolveApiUrl('api/repeaterbook/export?region=na')).toBe(
      `${PROD_API_ORIGIN}/api/repeaterbook/export?region=na`,
    );
  });
});
