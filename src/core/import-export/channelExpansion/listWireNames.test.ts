import { describe, expect, it } from 'vitest';
import { applyListWireNameLimits } from './listWireNames.ts';

describe('applyListWireNameLimits', () => {
  it('shortens long names when shortenNames is enabled', () => {
    const reserved = new Set<string>();
    const warnings: string[] = [];
    const name = applyListWireNameLimits(
      'Very Long Zone Name That Exceeds Limit',
      reserved,
      { shortenNames: true, profileId: 'opengd77-1701' },
      'opengd77-1701',
      warnings,
    );
    expect(name.length).toBeLessThanOrEqual(16);
    expect(reserved.has(name)).toBe(true);
  });

  it('does not shorten when shortenNames is false', () => {
    const reserved = new Set<string>();
    const longName = 'Very Long Zone Name That Exceeds Limit';
    const name = applyListWireNameLimits(
      longName,
      reserved,
      { shortenNames: false, profileId: 'opengd77-1701' },
      'opengd77-1701',
      [],
    );
    expect(name).toBe(longName);
  });

  it('disambiguates collisions in reserved set', () => {
    const reserved = new Set<string>();
    const warnings: string[] = [];
    const first = applyListWireNameLimits(
      'Scotland West Region',
      reserved,
      { shortenNames: true, profileId: 'opengd77-1701' },
      'opengd77-1701',
      warnings,
    );
    const second = applyListWireNameLimits(
      'Scotland West Region',
      reserved,
      { shortenNames: true, profileId: 'opengd77-1701' },
      'opengd77-1701',
      warnings,
    );
    expect(first).not.toBe(second);
  });
});
