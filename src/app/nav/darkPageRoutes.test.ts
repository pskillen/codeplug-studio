import { describe, expect, it } from 'vitest';
import { isDarkPagePath } from './darkPageRoutes.ts';

describe('isDarkPagePath', () => {
  it('is true for a radio debug page only', () => {
    expect(isDarkPagePath('/debug/radios/rt95')).toBe(true);
    expect(isDarkPagePath('/debug/radios/rt95/')).toBe(true);
    expect(isDarkPagePath('/debug')).toBe(false);
    expect(isDarkPagePath('/debug/radios')).toBe(false);
    expect(isDarkPagePath('/library/channels')).toBe(false);
  });
});
