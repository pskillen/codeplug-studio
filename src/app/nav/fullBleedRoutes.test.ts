import { describe, expect, it } from 'vitest';
import { isFullBleedPath } from './fullBleedRoutes.ts';

describe('isFullBleedPath', () => {
  it('is true for the Field tools only', () => {
    expect(isFullBleedPath('/tools/nearby')).toBe(true);
    expect(isFullBleedPath('/tools/locator')).toBe(true);
    expect(isFullBleedPath('/reference')).toBe(false);
    expect(isFullBleedPath('/toolsmith')).toBe(false);
  });
});
