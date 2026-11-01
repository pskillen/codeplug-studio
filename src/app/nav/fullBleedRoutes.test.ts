import { describe, expect, it } from 'vitest';
import { isFullBleedPath } from './fullBleedRoutes.ts';

describe('isFullBleedPath', () => {
  it('is true for the Field tools only', () => {
    expect(isFullBleedPath('/tools/nearby')).toBe(true);
    expect(isFullBleedPath('/tools/locator')).toBe(true);
    expect(isFullBleedPath('/reference')).toBe(false);
    expect(isFullBleedPath('/toolsmith')).toBe(false);
  });

  it('is true for the Channels and Zones lists on mobile only', () => {
    expect(isFullBleedPath('/library/channels', true)).toBe(true);
    expect(isFullBleedPath('/library/zones/', true)).toBe(true);
    expect(isFullBleedPath('/library/channels')).toBe(false);
    expect(isFullBleedPath('/library/channels/new', true)).toBe(false);
    expect(isFullBleedPath('/library/zones/abc', true)).toBe(false);
  });
});
