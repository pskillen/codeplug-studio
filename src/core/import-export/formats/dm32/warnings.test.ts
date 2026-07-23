import { describe, expect, it } from 'vitest';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import { collectDm32ExportWarnings } from './warnings.ts';
import { expandAllDm32ChannelsForExport } from './channelExpansion.ts';
import {
  minimalDm32ExportBuild,
  minimalDm32ExportLibrary,
} from '../../../../test/dm32/minimalExportLibrary.ts';

describe('collectDm32ExportWarnings', () => {
  function assembled(): AssembledBuild {
    const build = minimalDm32ExportBuild();
    const library = minimalDm32ExportLibrary();
    return {
      ...assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' }),
      library,
    };
  }

  it('returns no warnings for minimal export library', () => {
    const library = minimalDm32ExportLibrary();
    const warnings = collectDm32ExportWarnings(assembled(), library);
    expect(warnings).toEqual([]);
  });

  it('warns when channel wire name exceeds profile name limit', () => {
    const library = minimalDm32ExportLibrary();
    const base = assembled();
    const longName = 'ThisNameIsWayTooLong';
    const next: AssembledBuild = {
      ...base,
      channels: base.channels.map((row, index) =>
        index === 0
          ? {
              ...row,
              wireName: longName,
              entity: { ...row.entity, name: longName },
            }
          : row,
      ),
    };
    const warnings = collectDm32ExportWarnings(next, library, {
      profileId: next.profileId,
      shortenNames: false,
    });
    expect(warnings.some((w) => w.includes('exceeds 16 characters'))).toBe(true);
  });

  it('warns when expanded channel row count exceeds profile cap', () => {
    const library = minimalDm32ExportLibrary();
    const base = assembled();
    const warnings: string[] = [];
    const expanded = expandAllDm32ChannelsForExport(
      base,
      library,
      { profileId: base.profileId },
      warnings,
    );
    expect(expanded.length).toBeLessThanOrEqual(4000);
    const capped = collectDm32ExportWarnings(base, library, {
      profileId: base.profileId,
      maxNameLength: 1,
    });
    expect(capped.length).toBeGreaterThan(0);
  });
});
