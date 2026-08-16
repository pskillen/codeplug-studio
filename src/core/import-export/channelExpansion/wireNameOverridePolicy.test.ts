import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { applyWireNameLimits, resolveMaxNameLength } from './exportWireNames.ts';
import { hardTruncateUniqueWireName } from './shortenName.ts';

/** Profiles with a known channel nameLimit — used for cross-format override policy. */
const PROFILES_WITH_NAME_LIMIT = [
  'anytone-at-d890uv',
  'opengd77-1701',
  'dm32-baofeng-dm32uv',
  'chirp-uv5r',
  'neonplug-dm32uv',
] as const;

describe('wire name override hard-truncate policy', () => {
  it.each(PROFILES_WITH_NAME_LIMIT)(
    '%s hard-truncates an over-length override (never smart-shortens)',
    (profileId) => {
      const maxLen = resolveMaxNameLength(profileId);
      expect(maxLen).toBeTypeOf('number');
      expect(maxLen!).toBeGreaterThan(0);

      const override = `Override${'X'.repeat(maxLen!)}DictionaryWord`;
      expect(override.length).toBeGreaterThan(maxLen!);

      const channel = newChannel('proj', 'Short', 'GB3XX');
      const reserved = new Set<string>();
      const warnings: ExportWarning[] = [];
      const exported = applyWireNameLimits(
        override,
        channel,
        reserved,
        { shortenNames: true, profileId },
        profileId,
        warnings,
        true,
        true,
      );

      expect(exported.length).toBeLessThanOrEqual(maxLen!);
      expect(
        override.startsWith(exported) || exported.startsWith(override.slice(0, maxLen! - 3)),
      ).toBe(true);
      // Smart shorten would drop vowels / apply dictionary — hard truncate is a strict prefix.
      expect(exported).toBe(override.slice(0, exported.length));
      expect(warnings.some((w) => formatExportWarning(w).includes('exceeds'))).toBe(true);
      expect(warnings.some((w) => formatExportWarning(w).includes('exported as'))).toBe(false);
    },
  );

  it('hardTruncateUniqueWireName reserves room for disambiguation suffixes', () => {
    const reserved = new Set<string>(['SameName']);
    const { name, collided } = hardTruncateUniqueWireName('SameName', reserved, 16, true);
    expect(collided).toBe(true);
    expect(name).toBe('SameName 2');
    expect(name.length).toBeLessThanOrEqual(16);
  });
});
