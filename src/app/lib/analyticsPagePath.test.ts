import { describe, expect, it } from 'vitest';
import { analyticsPagePath } from './analyticsPagePath.ts';

describe('analyticsPagePath', () => {
  it('maps static routes', () => {
    expect(analyticsPagePath('/')).toBe('/');
    expect(analyticsPagePath('/library/channels')).toBe('/library/channels');
    expect(analyticsPagePath('/help')).toBe('/help');
    expect(analyticsPagePath('/privacy')).toBe('/privacy');
  });

  it('replaces dynamic segments with route templates', () => {
    expect(analyticsPagePath('/library/channels/550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/library/:kind/:id',
    );
    expect(analyticsPagePath('/builds/abc-123/export')).toBe('/builds/:id/export');
    expect(analyticsPagePath('/builds/abc-123/overview')).toBe('/builds/:id/overview');
  });

  it('excludes debug and styleguide routes', () => {
    expect(analyticsPagePath('/debug')).toBe(null);
    expect(analyticsPagePath('/debug/local-storage')).toBe(null);
    expect(analyticsPagePath('/debug/indexed-db/channels/proj/id')).toBe(null);
    expect(analyticsPagePath('/styleguide')).toBe(null);
  });

  it('handles debug storage key paths', () => {
    expect(analyticsPagePath('/debug/local-storage/codeplug-studio%3AmapboxToken')).toBe(null);
  });

  it('normalizes trailing slashes', () => {
    expect(analyticsPagePath('/help/')).toBe('/help');
  });
});
