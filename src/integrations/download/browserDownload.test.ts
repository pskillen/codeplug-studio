import { describe, expect, it } from 'vitest';
import { isoTimestampForFilename } from './browserDownload.ts';

describe('isoTimestampForFilename', () => {
  it('replaces colons and periods so the stamp is filesystem-safe', () => {
    const date = new Date('2026-07-28T14:32:05.123Z');
    expect(isoTimestampForFilename(date)).toBe('2026-07-28T14-32-05-123Z');
  });

  it('contains no colon or period', () => {
    const stamp = isoTimestampForFilename(new Date());
    expect(stamp).not.toMatch(/[:.]/);
  });
});
