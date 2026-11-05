import { describe, expect, it } from 'vitest';
import {
  OPENGD77_FAMILY_LIMITS,
  OPENUV380_USER_DB_GEOMETRY,
  OPENUV380_USER_DB_SEGMENT0_ENTRIES,
  openUv380UserDatabaseCapacity,
} from './limits.ts';

describe('OpenUV380 User Database cap from the flash layout', () => {
  it('derives segment 0 as 9,708 entries', () => {
    expect(OPENUV380_USER_DB_SEGMENT0_ENTRIES).toBe(9_708);
  });

  it('derives the ceiling 520,646 up to the GPS log at 14 MiB', () => {
    expect(OPENUV380_USER_DB_GEOMETRY.FLASH_WRITE_LIMIT_ABS).toBe(0xe00000);
    expect(OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX).toBe(520_646);
  });

  it('derives 15,776 when voice prompts sit in the legacy slot', () => {
    expect(OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX_LEGACY_VOICE_PROMPTS).toBe(15_776);
  });

  it('keeps the unconfirmed-flash fallback at the older tested size', () => {
    expect(OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX_UNCONFIRMED_FLASH).toBe(69_600);
  });

  const g = OPENUV380_USER_DB_GEOMETRY;
  it.each([
    ['full', OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX, g.FLASH_WRITE_LIMIT_ABS],
    [
      'legacy voice prompts',
      OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX_LEGACY_VOICE_PROMPTS,
      g.LEGACY_VOICE_PROMPTS_ABS,
    ],
  ])(
    'segment 1 for the %s cap ends at or below its limit, and one more would not fit',
    (_n, cap, limit) => {
      const seg1Entries = cap - OPENUV380_USER_DB_SEGMENT0_ENTRIES;
      expect(g.SEGMENT1_ABS + seg1Entries * g.ENTRY_SIZE).toBeLessThanOrEqual(limit);
      expect(g.SEGMENT1_ABS + (seg1Entries + 1) * g.ENTRY_SIZE).toBeGreaterThan(limit);
      expect(openUv380UserDatabaseCapacity(limit)).toBe(cap);
    },
  );
});
